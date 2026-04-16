import React, { useEffect, useState, useMemo, useRef } from "react";
import { RiverItem } from "../components/RiverItem";
import { TopBar } from "../components/TopBar";
import { SearchOverlay } from "../components/SearchOverlay";

import { useLocation } from "../hooks/useLocation";
import { useSearchParams, useParams, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { fetchAPI } from "../services/api";
import { useRivers } from "../hooks/useRivers";
import { useLists, type UserList } from "../context/ListsContext";
import { ListEditorModal } from "../components/ListEditorModal";
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
import { useModal } from "../context/ModalContext";
import { triggerReviewIfEligible } from "../utils/appReview";


const LazyRiverPage = React.lazy(() => import("./RiverPage"));

const Home: React.FC = () => {
  const { isDarkMode, isColorBlindMode } = useSettings();
  const { alert } = useModal();
  const { id } = useParams<{ id: string }>();
  const routeLocation = useRouterLocation();
  const navigate = useNavigate();
  
  const isListOverlay = routeLocation.pathname.startsWith("/lists/") && !!id;
  const isRiverOverlay = !isListOverlay && !!id;

  const [sharedList, setSharedList] = useState<UserList | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const { createList } = useLists();

  useEffect(() => {
     if (isListOverlay && id) {
        const fetchSharedList = async () => {
            try {
               const data = await fetchAPI(`/lists/${id}`);
               if (data) {
                  setSharedList(data as UserList);
                  setShowListModal(true);
               } else {
                  await alert("This list could not be found. It may have been deleted.");
                  navigate("/");
               }
           } catch (e) {
              console.error(e);
              navigate("/");
           }
        };
        fetchSharedList();
     } else {
        setShowListModal(false);
        setSharedList(null);
     }
  }, [isListOverlay, id, navigate]);

  const { rivers, loading: riversLoading, error: riversError, isGlobalStale, dataGeneratedAt, refresh } = useRivers();
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

    const sortByVal = searchParams.get("sortBy") as AdvancedSearchQuery["sortBy"];
    if (sortByVal) {
      q.sortBy = sortByVal;
    } else if (searchParamVal) {
      q.sortBy = "none";
    }

    const sortReverseVal = searchParams.get("sortReverse");
    if (sortReverseVal) q.sortReverse = sortReverseVal === "true";

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
                setSearchQuery((prev) => ({ ...prev, listId: targetListId, listData: cachedData.rivers || [] }));
                setListTitle(cachedData.title);
            } catch {
               // Silently catch json parse err
            }
        }

        try {
            const data = await fetchAPI(`/lists/${targetListId}`);
            if (data) {
               setSearchQuery((prev) => ({ ...prev, listId: targetListId, listData: data.rivers || [] }));
               setListTitle(data.title);
               // Save it for offline
               await persistentStorage.set(`saved_list_${targetListId}`, JSON.stringify(data));
            } else if (!cachedListStr) {
               let foundOffline = false;
               const customListsCache = await persistentStorage.get("my_custom_lists");
               if (customListsCache) {
                 try {
                   const lists = JSON.parse(customListsCache);
                   const found = lists.find((l: any) => l.id === targetListId);
                   if (found) {
                     setSearchQuery((prev) => ({ ...prev, listId: targetListId, listData: found.rivers || [] }));
                     setListTitle(found.title);
                     foundOffline = true;
                   }
                 } catch {}
               }
               if (!foundOffline) setError("Requested list does not exist.");
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


  const { isRiverInQuickList } = useLists();

  const filteredRivers = useMemo(() => {
    let result = filterRivers(rivers, searchQuery);
    if (searchQuery.favoritesOnly) {
      result = result.filter((r) => isRiverInQuickList(r.id, "favorites"));
    }
    return result;
  }, [rivers, searchQuery, isRiverInQuickList]);

  // Infinite Scroll State - Purely internal, no session storage needed because we never unmount!
  const [displayCount, setDisplayCount] = useState(100);

  const isInitialFilterRef = useRef(true);

  // Reset display count when the filter actually changes, avoiding initial mount overrides
  useEffect(() => {
    if (isInitialFilterRef.current) {
        isInitialFilterRef.current = false;
        return;
    }
    setDisplayCount(100);
  }, [searchQuery, isRiverInQuickList]);

  // Keep track of scroll position manually when switching to river view
  const scrollPositionRef = useRef(0);
  const prevIsRiverOverlay = useRef(isRiverOverlay);

  useEffect(() => {
    if (isRiverOverlay) {
       // Save position precisely when mounting overlay
       scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
       window.scrollTo(0, 0);
    } else {
       // Instantly restore when closing overlay
       window.scrollTo(0, scrollPositionRef.current);
       // Trigger review prompt option when navigating back from a river view
       if (prevIsRiverOverlay.current) {
         triggerReviewIfEligible();
       }
    }
    prevIsRiverOverlay.current = isRiverOverlay;
  }, [isRiverOverlay]);

  useEffect(() => {
    const handleScroll = () => {
      // Don't trigger infinite load expansion if we are currently looking at single river
      if (isRiverOverlay) return;

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
  }, [filteredRivers.length, isRiverOverlay]);

  useEffect(() => {

    // Debugging only
    const gaugeCount = rivers.filter(r => r.isGauge).length;
    console.log("TOTAL GAUGES IN RIVERS:", gaugeCount, "TOTAL RIVERS:", rivers.length);
  }, [rivers]);

  const renderedRiverItems = useMemo(() => {
    return filteredRivers.slice(0, displayCount).map((river, index) => (
      <RiverItem
        key={river.id || `${river.name}-${index}`}
        river={river}
        index={index}
        isDarkMode={isDarkMode}
        isColorBlindMode={isColorBlindMode}
      />
    ));
  }, [filteredRivers, displayCount, isDarkMode, isColorBlindMode]);

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

  // We use the globally defined LazyRiverPage to inject the UI seamlessly without breaking Suspense

  return (
    <div className="page-content">
      {/* Search List Overlay Toggle */}
      <div style={{ display: isRiverOverlay ? "none" : "block" }}>
        {isGlobalStale && (
          <div style={{ 
            backgroundColor: "var(--danger-bg)", 
            color: "var(--danger-text)", 
            padding: "12px", 
            textAlign: "center", 
            borderRadius: "8px", 
            marginBottom: "15px",
            border: "1px solid var(--danger)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px"
          }}>
            <span>
              ⚠️ Data was last synced {dataGeneratedAt ? Math.round((Date.now() - dataGeneratedAt) / 60000) : "?"} mins ago.
            </span>
            <button 
              onClick={() => refresh()}
              style={{
                backgroundColor: "var(--danger)",
                color: "#fff",
                border: "none",
                padding: "4px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Update
            </button>
          </div>
        )}
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
            const hasText = e.target.value.trim().length > 0;
            // When typing starts (hasText), default to relevance sort ("none"). 
            // When cleared, revert back to alphabetical. 
            // Preserve explicit sorts only if they manually clicked a sort header. 
            // Since there's no easy way to know if they manually clicked vs just had the default,
            // we will strictly follow: "typing resets any sorting".
            setSearchQuery({ 
              ...searchQuery, 
              normalSearch: e.target.value,
              sortBy: hasText ? "none" : (searchQuery.sortBy === "none" ? "alphabetical" : searchQuery.sortBy)
            });
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
        <TopBar query={searchQuery} setQuery={setSearchQuery} filteredRivers={filteredRivers} />
        {renderedRiverItems}
        </div>
      </div>

      {isRiverOverlay && (
        <React.Suspense fallback={<div className="page-content center"><h2>Loading River...</h2></div>}>
           <LazyRiverPage />
        </React.Suspense>
      )}

      {showListModal && sharedList && (
         <ListEditorModal
            isOpen={showListModal}
            mode="shared"
            initialTitle={sharedList.title}
            initialDescription={sharedList.description}
            targetList={sharedList}
            onClose={() => {
              setShowListModal(false);
              navigate(`/?list=${sharedList.id}`);
            }}
            onSave={async () => {}}
            onCopySharedList={async (list) => {
               try {
                  const newId = await createList(`Copy of ${list.title}`, list.description || "", false, list.rivers);
                  if (newId) {
                      await alert("Successfully imported list to your lists!");
                      setShowListModal(false);
                      navigate(`/lists`);
                  }
               } catch (e: any) {
                  await alert(e.message);
               }
            }}
         />
      )}
    </div>
  );
};

export default Home;
