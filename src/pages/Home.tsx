import React, { useEffect, useState, useMemo } from "react";
import { RiverItem } from "../components/RiverItem";
import { TopBar } from "../components/TopBar";
import { SearchOverlay } from "../components/SearchOverlay";
import { useFavorites } from "../context/FavoritesContext";
import { useLocation } from "../hooks/useLocation";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useRivers } from "../hooks/useRivers";
import {
  calculateColor,
} from "../utils/flowInfoCalculations";
import {
  filterRivers,
  defaultAdvancedSearchQuery,
  hasActiveFilters,
} from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { useSettings } from "../context/SettingsContext";

const Home: React.FC = () => {
  const { isDarkMode, isColorBlindMode } = useSettings();
  const { rivers, loading: riversLoading, error: riversError } = useRivers();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync internal loading state with rivers data hook
  useEffect(() => {
     if (riversLoading) {
         setLoading(true);
     } else {
         setLoading(false);
         if (riversError) setError(riversError);
     }
  }, [riversLoading, riversError]);

  const [searchParams] = useSearchParams();

  // Search State
  const [searchQuery, setSearchQuery] = useState<AdvancedSearchQuery>(() => {
    const q = { ...defaultAdvancedSearchQuery };
    const searchParamVal = searchParams.get("search");
    if (searchParamVal) {
      q.normalSearch = searchParamVal;
    }
    
    const nameVal = searchParams.get("name");
    if (nameVal) q.name = nameVal;
    
    const sectionVal = searchParams.get("section");
    if (sectionVal) q.section = sectionVal;
    
    const distMax = searchParams.get("distanceMax");
    if (distMax) {
        q.distanceMax = parseInt(distMax);
        q.mapRadiusMode = (searchParams.get("radiusMode") as "current" | "center" | "custom" | null) || "current";
        const customLat = searchParams.get("userLat");
        const customLon = searchParams.get("userLon");
        if (customLat) q.userLat = parseFloat(customLat);
        if (customLon) q.userLon = parseFloat(customLon);
    }
    
    const favOnly = searchParams.get("favoritesOnly");
    if (favOnly) q.favoritesOnly = favOnly === "true";
    
    const sMin = searchParams.get("skillMin");
    if (sMin) q.skillMin = parseInt(sMin);
    
    const sMax = searchParams.get("skillMax");
    if (sMax) q.skillMax = parseInt(sMax);
    
    const fMin = searchParams.get("flowMin");
    if (fMin) q.flowMin = parseFloat(fMin);
    
    const fMax = searchParams.get("flowMax");
    if (fMax) q.flowMax = parseFloat(fMax);

    return q;
  });

  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [listTitle, setListTitle] = useState<string | null>(null);

  // Load persistence settings and list data
  useEffect(() => {
    async function loadPersistence() {
      const { persistentStorage } = await import("../utils/persistentStorage");
      
      const defaultSearch = await persistentStorage.get("homePageDefaultSearch");
      if (defaultSearch === "favorites") {
        setSearchQuery(prev => ({ ...prev, favoritesOnly: true }));
      }

      const listParam = searchParams.get("list");
      let targetListId = listParam;
      if (!targetListId && defaultSearch && defaultSearch.startsWith("list:")) {
          targetListId = defaultSearch.replace("list:", "");
      }

      if (targetListId) {
        setLoading(true);
        
        // Attempt to load from cache immediately to guarantee offline UX
        const cachedListStr = await persistentStorage.get(`saved_list_${targetListId}`);
        if (cachedListStr) {
            try {
                const cachedData = JSON.parse(cachedListStr);
                setSearchQuery((prev) => ({ ...prev, listData: cachedData.rivers || [] }));
                setListTitle(cachedData.title);
            } catch {
               // Silently catch json parse err
            }
        }

        try {
            const snapshot = await getDoc(doc(db, "community_lists", targetListId));
            if (snapshot.exists()) {
               const data = snapshot.data();
               setSearchQuery((prev) => ({ ...prev, listData: data.rivers || [] }));
               setListTitle(data.title);
               // Save it for offline
               await persistentStorage.set(`saved_list_${targetListId}`, JSON.stringify(data));
            } else if (!cachedListStr) {
               setError("Requested list does not exist.");
            }
        } catch (err: unknown) {
            if (err instanceof Error) console.error("Failed to load list from network, trying to rely on cache", err.message);
        } finally {
            setLoading(false);
        }
      }
    }
    loadPersistence();
  }, [searchParams]);

  const location = useLocation();

  // Evaluate "current location" requests if a shared link or default search relies on runtime proximity
  useEffect(() => {
    if (searchQuery.distanceMax && (!searchQuery.mapRadiusMode || searchQuery.mapRadiusMode === "current") && searchQuery.userLat === undefined) {
      if (location.latitude && location.longitude) {
         setSearchQuery(prev => ({ ...prev, userLat: location.latitude!, userLon: location.longitude! }));
      } else if (!location.loading && !location.error) {
         location.requestLocation();
      }
    }
  }, [searchQuery.distanceMax, searchQuery.mapRadiusMode, searchQuery.userLat, location.latitude, location.longitude, location.loading, location.error]);


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
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      
      // If we are within 1200px of the bottom of the page
      if (
        window.innerHeight + scrollY >=
        scrollHeight - 1200
      ) {
        setDisplayCount((prev) => Math.min(prev + 50, filteredRivers.length));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [filteredRivers.length]);

  useEffect(() => {
    // Debugging only
    const gaugeCount = rivers.filter(r => r.isGauge).length;
    console.log("TOTAL GAUGES IN RIVERS:", gaugeCount, "TOTAL RIVERS:", rivers.length);
  }, [rivers]);

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
      <div 
        className="searchcontain"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          margin: "0 auto 20px auto",
          maxWidth: "700px",
          width: "100%",
          padding: "0 15px",
          boxSizing: "border-box"
        }}
      >
        <input
          id="searchbox"
          type="text"
          aria-label="Type in the box to search for a river"
          placeholder="Search for a river..."
          value={searchQuery.normalSearch || ""}
          onChange={(e) => {
            setSearchQuery({ ...searchQuery, normalSearch: e.target.value });
          }}
          style={{
            flex: 1,
            padding: "10px 20px",
            fontSize: "1rem",
            borderRadius: "50px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            outline: "none",
            boxShadow: isDarkMode 
                ? "inset 0 1px 2px rgba(0,0,0,0.5)" 
                : "inset 0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.2s"
          }}
        />
        <button
          id="advancedsearch"
          onClick={() => {
            setIsAdvancedSearchOpen(true);
          }}
          style={{
            padding: "10px 20px",
            fontSize: "0.95rem",
            fontWeight: 600,
            borderRadius: "50px",
            border: "none",
            backgroundColor: "var(--primary)",
            color: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            transition: "all 0.2s"
          }}
        >
          Advanced
        </button>
      </div>

      {location.loading && (!searchQuery.mapRadiusMode || searchQuery.mapRadiusMode === "current") && searchQuery.distanceMax !== undefined && searchQuery.userLat === undefined && (
          <div style={{ textAlign: "center", marginBottom: "15px", color: "var(--text-muted)", fontSize: "0.9em" }}>
             <em>Requesting device location to evaluate shared radius search...</em>
          </div>
      )}
      
      {location.error && (!searchQuery.mapRadiusMode || searchQuery.mapRadiusMode === "current") && searchQuery.distanceMax !== undefined && searchQuery.userLat === undefined && (
          <div style={{ textAlign: "center", marginBottom: "15px", color: "var(--danger)", fontSize: "0.9em" }}>
             <em>Failed to get location for radius search: {location.error}</em>
          </div>
      )}

      {hasActiveFilters(searchQuery) && (
         <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <span style={{ fontSize: "0.9em", color: "var(--text-muted)", fontStyle: "italic", marginRight: "10px" }}>
                Custom Filters Active
            </span>
            <button 
                onClick={() => {
                   setSearchQuery({
                     ...defaultAdvancedSearchQuery,
                     normalSearch: searchQuery.normalSearch,
                     sortBy: searchQuery.sortBy,
                     sortReverse: searchQuery.sortReverse
                   });
                   setListTitle(null);
                }}
                style={{
                    padding: "4px 10px",
                    backgroundColor: "var(--danger)",
                    color: "var(--surface)",
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
          backgroundImage: `linear-gradient(to right, ${[0, 1, 2, 3, 4].map((i) => calculateColor(i, isDarkMode, isColorBlindMode)).join(",")})`,
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
            isDarkMode={isDarkMode}
            isColorBlindMode={isColorBlindMode}
          />
        ))}
      </div>
    </div>
  );
};

export default Home;
