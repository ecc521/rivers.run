import React, { useEffect, useState, useMemo } from "react";
import type { RiverData } from "../types/River";
import { RiverItem } from "../components/RiverItem";
import { TopBar } from "../components/TopBar";
import { SearchOverlay } from "../components/SearchOverlay";
import { useFavorites } from "../context/FavoritesContext";
import { useSearchParams } from "react-router-dom";
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
    try {
      if (localStorage.getItem("homePageDefaultSearch") === "favorites") {
        q.favoritesOnly = true;
      }
    } catch {}
    return q;
  });

  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);

  useEffect(() => {
    const fetchRivers = async () => {
      try {
        const riverDataUrl = import.meta.env.DEV
          ? "https://rivers.run/riverdata.json"
          : "/riverdata.json";
        const flowDataUrl = import.meta.env.DEV
          ? "https://rivers.run/flowdata3.json"
          : "/flowdata3.json";

        const [riverRes, flowRes] = await Promise.all([
          fetch(riverDataUrl),
          fetch(flowDataUrl),
        ]);

        if (!riverRes.ok) throw new Error("Failed to fetch river data");
        let data: RiverData[] = await riverRes.json();

        // If flow data is ok, enrich the rivers
        if (flowRes.ok) {
          const flowData = await flowRes.json();
          data = data.map((river) => {
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
      <h1 className="center">River Information</h1>
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
