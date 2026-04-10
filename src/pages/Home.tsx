import React, { useEffect, useState, useMemo } from "react";
import { RiverItem } from "../components/RiverItem";
import { TopBar } from "../components/TopBar";
import { SearchOverlay } from "../components/SearchOverlay";
import { useFavorites } from "../context/FavoritesContext";
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
} from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";

const Home: React.FC = () => {
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

        getDoc(doc(db, "community_lists", targetListId)).then(async (snapshot) => {
            if (snapshot.exists()) {
               const data = snapshot.data();
               setSearchQuery((prev) => ({ ...prev, listData: data.rivers || [] }));
               setListTitle(data.title);
               // Save it for offline
               await persistentStorage.set(`saved_list_${targetListId}`, JSON.stringify(data));
            } else if (!cachedListStr) {
               setError("Requested list does not exist.");
            }
            setLoading(false);
        }).catch(err => {
            console.error("Failed to load list from network, trying to rely on cache", err);
            setLoading(false);
        });
      }
    }
    loadPersistence();
  }, [searchParams]);


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
