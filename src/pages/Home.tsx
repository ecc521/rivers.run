import React, { useEffect, useState, useMemo } from "react";
import type { RiverData } from "../types/River";
import { RiverItem } from "../components/RiverItem";
import { TopBar } from "../components/TopBar";
import { SearchOverlay } from "../components/SearchOverlay";
import { useFavorites } from "../context/FavoritesContext";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  calculateRelativeFlow,
  calculateColor,
} from "../utils/flowInfoCalculations";
import {
  filterRivers,
  defaultAdvancedSearchQuery,
} from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";

const Home: React.FC = () => {
  const [rivers, setRivers] = useState<RiverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();

  // Search State
  const [searchQuery, setSearchQuery] = useState<AdvancedSearchQuery>(() => {
    const q = { ...defaultAdvancedSearchQuery };
    const searchParamVal = searchParams.get("search");
    if (searchParamVal) {
      q.normalSearch = searchParamVal;
    }
    // Check local storage for default search settings
    const defaultSearch = localStorage.getItem("homePageDefaultSearch");
    try {
      if (defaultSearch === "favorites") {
        q.favoritesOnly = true;
      }
    } catch {}
    return q;
  });

  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [listTitle, setListTitle] = useState<string | null>(null);

  // Fetch List Data if applicable
  useEffect(() => {
    const listParam = searchParams.get("list");
    const defaultSearch = localStorage.getItem("homePageDefaultSearch");
    
    let targetListId = listParam;
    if (!targetListId && defaultSearch && defaultSearch.startsWith("list:")) {
        targetListId = defaultSearch.replace("list:", "");
    }

    if (targetListId) {
      setLoading(true);
      
      // Attempt to load from cache immediately to guarantee offline UX
      const cachedListStr = localStorage.getItem(`saved_list_${targetListId}`);
      if (cachedListStr) {
          try {
              const cachedData = JSON.parse(cachedListStr);
              setSearchQuery((prev) => ({ ...prev, listData: cachedData.rivers || [] }));
              setListTitle(cachedData.title);
          } catch {
             // Silently catch json parse err
          }
      }

      getDoc(doc(db, "community_lists", targetListId)).then((snapshot) => {
          if (snapshot.exists()) {
             const data = snapshot.data();
             setSearchQuery((prev) => ({ ...prev, listData: data.rivers || [] }));
             setListTitle(data.title);
             // Save it for offline
             localStorage.setItem(`saved_list_${targetListId}`, JSON.stringify(data));
          } else if (!cachedListStr) {
             setError("Requested list does not exist.");
          }
          setLoading(false);
      }).catch(err => {
          console.error("Failed to load list from network, trying to rely on cache", err);
          if (!cachedListStr) {
              setLoading(false);
          } else {
              setLoading(false); 
          }
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchRivers = async () => {
      try {
        const riverDataUrl = "/riverdata.json";
        const flowDataUrl = "https://storage.googleapis.com/rivers-run.appspot.com/public/flowdata3.json";

        const [riverRes, flowRes] = await Promise.all([
          fetch(riverDataUrl),
          fetch(flowDataUrl),
        ]);

        if (!riverRes.ok || !riverRes.headers.get("content-type")?.includes("json")) {
           throw new Error("Failed to fetch valid river data JSON");
        }
        let data: RiverData[] = await riverRes.json();

        // If flow data is ok, enrich the rivers
        if (flowRes.ok && flowRes.headers.get("content-type")?.includes("json")) {
          const flowData = await flowRes.json();
          const usedGauges = new Set<string>();

          data = data.map((river: any, index: number) => {
            river.index = index; // Inject index to be able to map to legacy IDs if needed
            
            if (river.gauge) {
                usedGauges.add(river.gauge);
            }

            const gaugeRecord = flowData[river.gauge];
            if (
              gaugeRecord &&
              gaugeRecord.readings &&
              gaugeRecord.readings.length > 0
            ) {
              const latest =
                gaugeRecord.readings[gaugeRecord.readings.length - 1];
              river.cfs = latest.cfs;
              river.feet = latest.feet;
              river.flowData = gaugeRecord.readings;

              river.running = calculateRelativeFlow(river) ?? undefined;

              if (river.cfs && river.feet)
                river.flow = `${Math.round(river.cfs)} cfs ${Math.round(river.feet * 100) / 100} ft`;
              else if (river.cfs) river.flow = `${Math.round(river.cfs)} cfs`;
              else if (river.feet)
                river.flow = `${Math.round(river.feet * 100) / 100} ft`;
            }
            return river;
          });

          // Create virtual rivers for any gauge present in flowdata3 that isn't mapped to a river
          const virtualGauges: RiverData[] = [];
          let virtualIndex = data.length;

          for (const [gaugeId, gaugeData] of Object.entries(flowData)) {
              if (!usedGauges.has(gaugeId)) {
                  const gData: any = gaugeData;
                  if (gData.readings && gData.readings.length > 0) {
                      const latest = gData.readings[gData.readings.length - 1];
                      let flowStr = "";
                      if (latest.cfs && latest.feet) flowStr = `${Math.round(latest.cfs)} cfs ${Math.round(latest.feet * 100) / 100} ft`;
                      else if (latest.cfs) flowStr = `${Math.round(latest.cfs)} cfs`;
                      else if (latest.feet) flowStr = `${Math.round(latest.feet * 100) / 100} ft`;

                      virtualGauges.push({
                          id: gaugeId,
                          name: gData.name || gaugeId,
                          gauge: gaugeId,
                          isGauge: true,
                          index: virtualIndex++,
                          cfs: latest.cfs,
                          feet: latest.feet,
                          flowData: gData.readings,
                          flow: flowStr,
                          access: gData.lat && gData.lon ? [{lat: gData.lat, lon: gData.lon, name: "Gauge Marker", type: "other"}] : undefined
                      } as unknown as RiverData);
                  }
              }
          }
          
          data = [...data, ...virtualGauges];
        }

        setRivers(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "An error occurred");
        setLoading(false);
      }
    };

    fetchRivers();
  }, []);

  const { isFavorite } = useFavorites();

  const filteredRivers = useMemo(() => {
    let result = filterRivers(rivers, searchQuery);
    if (searchQuery.favoritesOnly) {
      result = result.filter((r) => isFavorite(r.id));
    }
    return result;
  }, [rivers, searchQuery, isFavorite]);

  // Infinite Scroll State
  const [displayCount, setDisplayCount] = useState(100);

  // Reset display count when the filter changes
  useEffect(() => {
    setDisplayCount(100);
  }, [filteredRivers]);

  useEffect(() => {
    const handleScroll = () => {
      // If we are within 500px of the bottom of the page
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 500
      ) {
        setDisplayCount((prev) => Math.min(prev + 50, filteredRivers.length));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [filteredRivers.length]);

  if (loading)
    return (
      <div className="page-content center">
        <h2>Loading River Data...</h2>
      </div>
    );
  if (error)
    return (
      <div className="page-content center">
        <h2>Error: {error}</h2>
      </div>
    );

  return (
    <div className="page-content">
      {/* Search Header Area */}
      <h1 className="center">{listTitle ? listTitle : "River Information"}</h1>
      <div className="searchcontain">
        <input
          id="searchbox"
          type="text"
          aria-label="Type in the box to search for a river"
          placeholder="Search.."
          value={searchQuery.normalSearch || ""}
          onChange={(e) => {
            setSearchQuery({ ...searchQuery, normalSearch: e.target.value });
          }}
        />
        <button
          id="advancedsearch"
          onClick={() => {
            setIsAdvancedSearchOpen(true);
          }}
        >
          Advanced
        </button>
        <button id="addAllToFavorites">Add to Favorites</button>
      </div>

      {(searchQuery.favoritesOnly || searchQuery.listData || searchQuery.distanceMax !== undefined || searchQuery.sortBy !== "none") && (
         <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <span style={{ fontSize: "0.9em", color: "#64748b", fontStyle: "italic", marginRight: "10px" }}>
                Custom Sorting / Filters Active
            </span>
            <button 
                onClick={() => {
                   setSearchQuery({ ...defaultAdvancedSearchQuery });
                   setListTitle(null);
                }}
                style={{
                    padding: "4px 10px",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85em",
                    fontWeight: "bold"
                }}
            >
                Clear Filters (View All)
            </button>
         </div>
      )}

      <SearchOverlay
        isOpen={isAdvancedSearchOpen}
        onClose={() => {
          setIsAdvancedSearchOpen(false);
        }}
        query={searchQuery}
        setQuery={setSearchQuery}
      />

      <div
        id="legend"
        style={{
          backgroundImage: `linear-gradient(to right, ${[0, 1, 2, 3, 4].map((i) => calculateColor(i)).join(",")})`,
        }}
      >
        <span id="toolow">Too Low</span>
        <span id="lowflow">Low Flow</span>
        <span id="midflow">Mid Flow</span>
        <span id="highflow">High Flow</span>
        <span id="toohigh">Too High</span>
      </div>

      {/* Rivers List */}
      <div id="Rivers">
        <TopBar query={searchQuery} setQuery={setSearchQuery} />
        {filteredRivers.slice(0, displayCount).map((river, index) => (
          <RiverItem
            key={river.id || `${river.name}-${index}`}
            river={river}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default Home;
