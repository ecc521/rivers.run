import React, { useEffect, useState, useMemo, useRef } from "react";
import { RiverItem } from "../components/RiverItem";
import { TopBar } from "../components/TopBar";
import { SearchOverlay } from "../components/SearchOverlay";

import { useLocation } from "../hooks/useLocation";
import { ViewSelector } from "../components/ViewSelector";
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
  serializeQueryToParams,
  parseParamsToQuery,
  normalizeHomeValue,
  SEARCH_PARAM_KEYS,
} from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { useSettings } from "../context/SettingsContext";
import { useModal } from "../context/ModalContext";
import { triggerReviewIfEligible } from "../utils/appReview";
import { useTranslation } from "react-i18next";

import { useSEO } from "../hooks/useSEO";
import { DEFAULT_STATE_MAP, getCountryName } from "../utils/regions";


const LazyRiverPage = React.lazy(() => import("./RiverPage"));

const Home: React.FC = () => {
  useSEO({
    title: "Whitewater Gauge Maps & Flow Data",
    description: "Real-time whitewater flow data, gauge maps, and river running status for over 250 rivers in the US, UK, Ireland, and Canada."
  });
  const { t } = useTranslation();
  const { isDarkMode, isColorBlindMode, homePageDefaultSearch, updateSetting } = useSettings();
  const { alert } = useModal();
  const { id } = useParams<{ id: string }>();
  const decodedId = id ? decodeURIComponent(id) : undefined;
  const routeLocation = useRouterLocation();
  const navigate = useNavigate();
  
  const isListOverlay = routeLocation.pathname.startsWith("/lists/") && !!decodedId;
  const isRiverOverlay = !isListOverlay && !!decodedId;

  const [sharedList, setSharedList] = useState<UserList | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const { createList } = useLists();

  useEffect(() => {
     if (isListOverlay && decodedId) {
        const fetchSharedList = async () => {
             try {
                const data = await fetchAPI(`/lists/${decodedId}`);
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
  }, [isListOverlay, decodedId, navigate]);

   const { rivers, loading: riversLoading, syncing: riversSyncing, error: riversError, isGlobalStale, dataGeneratedAt, availableStatesByCountry, refresh } = useRivers();
   const { syncError: listSyncError, refreshCloudState } = useLists();
   const [loading, setLoading] = useState(riversLoading && rivers.length === 0);
   const [error, setError] = useState<string | null>(null);
 
   // Sync internal loading state with rivers data hook
   useEffect(() => {
      // We only want to show the full-page loader if we have NO rivers and are fetching
      if (riversLoading && rivers.length === 0) {
          setLoading(true);
      } else {
          setLoading(false);
          if (riversError) setError(riversError);
      }
   }, [riversLoading, riversError, rivers.length]);

   // Defer map tile pre-fetching until after primary data load to avoid network saturation
   useEffect(() => {
     if (!riversLoading) {
       // Small 1-second delay to ensure the UI is fully hydrated before network noise starts
       const t = setTimeout(() => {

       }, 1000);
       return () => clearTimeout(t);
     }
   }, [riversLoading]);

  const [searchParams] = useSearchParams();

  // Search State — hydrate from URL params (list data itself loads async below)
  const [searchQuery, setSearchQuery] = useState<AdvancedSearchQuery>(() =>
    parseParamsToQuery(searchParams)
  );

  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [listTitle, setListTitle] = useState<string | null>(null);

  // Decoupled from searchQuery.normalSearch so typing stays instant — the
  // expensive filterRivers() pass over ~15k rivers is debounced instead of
  // running on every keystroke.
  const [searchInputValue, setSearchInputValue] = useState(searchQuery.normalSearch || "");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInputValue(searchQuery.normalSearch || "");
  }, [searchQuery.normalSearch]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("searchExpanded") === "true") {
      setIsAdvancedSearchOpen(true);
    }

    // Sync regional and filter params from URL to state
    const state = searchParams.get("state") || undefined;
    const country = searchParams.get("country") || undefined;
    
    setSearchQuery(prev => {
        if (prev.state === state && prev.country === country) return prev;
        return { ...prev, state, country };
    });
  }, [searchParams]);

  // Load persistence settings and list data
  useEffect(() => {
    async function loadPersistence() {
      const { persistentStorage } = await import("../utils/persistentStorage");
      
      const defaultSearch = await persistentStorage.get("homePageDefaultSearch");

      const listParam = searchParams.get("list");
      let targetListId = listParam;

      // Apply the saved "home" startup view only when the URL carries no search
      // intent of its own — a shared link or in-app navigation always wins.
      const urlHasIntent = SEARCH_PARAM_KEYS.some((k) => searchParams.has(k));
      if (!urlHasIntent && defaultSearch) {
        if (defaultSearch.startsWith("query:")) {
          const savedQuery = parseParamsToQuery(new URLSearchParams(defaultSearch.slice("query:".length)));
          // Apply the non-list filters immediately; any embedded list loads below.
          setSearchQuery((prev) => ({
            ...savedQuery,
            normalSearch: prev.normalSearch || savedQuery.normalSearch,
            listData: prev.listData,
          }));
          if (savedQuery.listId) targetListId = savedQuery.listId;
        } else if (defaultSearch.startsWith("list:")) {
          // Legacy format: a bare list id saved before arbitrary queries existed.
          targetListId = defaultSearch.replace("list:", "");
        }
      }

      if (targetListId) {
        // Attempt to load from cache immediately to guarantee offline UX
        const cachedListStr = await persistentStorage.get(`saved_list_${targetListId}`);
        const hadCache = !!cachedListStr;
        if (cachedListStr) {
            try {
                const cachedData = JSON.parse(cachedListStr);
                setSearchQuery((prev) => ({ ...prev, listId: targetListId, listData: cachedData.rivers || [] }));
                setListTitle(cachedData.title);
            } catch {
               // Silently catch json parse err
            }
        }

        // Once cache has painted the UI, don't gate loading on the network refresh
        // below — only block on it when there's nothing to show yet.
        if (!hadCache) setLoading(true);

        try {
            const data = await fetchAPI(`/lists/${targetListId}`);
            if (data) {
               setSearchQuery((prev) => ({ ...prev, listId: targetListId, listData: data.rivers || [] }));
               setListTitle(data.title);
               // Save it for offline
               await persistentStorage.set(`saved_list_${targetListId}`, JSON.stringify(data));
            } else if (!hadCache) {
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
               if (!foundOffline) {
                  setError("Requested list does not exist.");
                  // Clear the broken list filter so the site remains usable
                  setSearchQuery((prev) => ({ ...prev, listId: undefined, listData: undefined }));
               }
            }
        } catch (err: unknown) {
            if (err instanceof Error) console.error("Failed to load list from network, trying to rely on cache", err.message);
            // If network failed and we have no cache, clear the filter so they see something
            if (!hadCache) {
               setSearchQuery((prev) => ({ ...prev, listId: undefined, listData: undefined }));
            }
        } finally {
            if (!hadCache) setLoading(false);
        }
      }
    }
    loadPersistence();
  }, [searchParams.get("list")]);

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
    const result = filterRivers(rivers, searchQuery);
    return result;
  }, [rivers, searchQuery, isRiverInQuickList]);
  
  // Server-precomputed — no per-render walk over the full river list needed.
  const availableStates = useMemo(() => {
    if (searchQuery.country) {
      return availableStatesByCountry[searchQuery.country] || [];
    }
    const allStates = new Set<string>();
    Object.values(availableStatesByCountry).forEach(states => states.forEach(s => allStates.add(s)));
    return Array.from(allStates).sort((a, b) => a.localeCompare(b));
  }, [availableStatesByCountry, searchQuery.country]);

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
        <h2>{t("home.loadingData")}</h2>
      </div>
    );
  if (error)
    return (
      <div className="page-content center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '15px' }}>
        <h2 style={{ marginBottom: "5px" }}>{t("home.downloadFailed")}</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>{t("home.connectInternet")}</p>
        <button 
          onClick={() => refresh()}
          style={{
            padding: "10px 20px",
            fontSize: "1rem",
            fontWeight: "bold",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "var(--primary)",
            color: "#ffffff",
            cursor: "pointer",
            marginTop: "10px"
          }}
        >
          {t("home.tryAgain")}
        </button>
      </div>
    );

  // We use the globally defined LazyRiverPage to inject the UI seamlessly without breaking Suspense

  const handleViewChange = (view: "all" | string, listTitleToSet?: string) => {
    const params = new URLSearchParams(searchParams);
    if (view === "all") {
      ["list","state","country","name","section","distanceMax","radiusMode",
       "userLat","userLon","skillMin","skillMax","flowMin","flowMax",
       "sortBy","sortReverse"].forEach(k => params.delete(k));
      setListTitle(null);
      setSearchQuery(prev => ({ ...defaultAdvancedSearchQuery, normalSearch: prev.normalSearch }));
    } else {
      params.set("list", view);
      if (listTitleToSet) setListTitle(listTitleToSet);
      setSearchQuery(prev => ({ ...prev, listId: view }));
    }
    navigate(`/?${params.toString()}`);
  };

  // Does the currently-displayed view exactly match the saved startup ("home")?
  // Normalizing both sides through the same serializer makes the comparison
  // order-insensitive and tolerant of the legacy "list:" format.
  const isCurrentViewHome =
    !!homePageDefaultSearch &&
    normalizeHomeValue(homePageDefaultSearch) === serializeQueryToParams(searchQuery);

  const handleSetAsHome = () => {
    const cleaned: AdvancedSearchQuery = { ...searchQuery };
    // A "near me" home should track the user's live position, not freeze the
    // coordinates captured when it was pinned.
    if (cleaned.distanceMax) {
      cleaned.mapRadiusMode = "current";
      cleaned.userLat = undefined;
      cleaned.userLon = undefined;
    }
    const params = serializeQueryToParams(cleaned);
    updateSetting("homePageDefaultSearch", params ? `query:${params}` : null);
  };

  const handleClearHome = () => {
    updateSetting("homePageDefaultSearch", null);
  };

  const handleCountryChange = (country: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("state"); // Clear state when switching country
    if (country === "global") {
      params.delete("country");
      setSearchQuery(prev => ({ ...prev, country: undefined, state: undefined }));
    } else {
      params.set("country", country);
      setSearchQuery(prev => ({ ...prev, country, state: undefined }));
    }
    navigate(`/?${params.toString()}`);
  };

  const handleStateChange = (state: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (!state) {
      params.delete("state");
      setSearchQuery(prev => ({ ...prev, state: undefined }));
    } else {
      params.set("state", state);
      
      // Auto-select country if not already set or mismatched
      const countries = DEFAULT_STATE_MAP[state.toUpperCase()];
      if (countries && countries.length > 0) {
          const firstCountry = countries[0];
          if (searchQuery.country !== firstCountry) {
              params.set("country", firstCountry);
              setSearchQuery(prev => ({ ...prev, state, country: firstCountry }));
              navigate(`/?${params.toString()}`);
              return;
          }
      }
      setSearchQuery(prev => ({ ...prev, state }));
    }
    navigate(`/?${params.toString()}`);
  };

  const regionPrefix = getCountryName(searchQuery.country);
  const viewLabel = listTitle || (searchQuery.favoritesOnly ? "Favorites" : "Full List");

  let emptyStateTitle = t("home.noRiversTitle");
  let emptyStateDesc = t("home.noRiversDesc");
  let emptyStateIcon = "🔍";

  if (searchQuery.favoritesOnly) {
    emptyStateTitle = t("home.noFavsTitle");
    emptyStateDesc = t("home.noFavsDesc");
    emptyStateIcon = "⭐";
  } else if (searchQuery.listId) {
    emptyStateTitle = t("home.noListTitle");
    emptyStateDesc = t("home.noListDesc");
    emptyStateIcon = "📋";
  }


  return (
    <div className="page-content">
      <h1 className="visually-hidden">Whitewater Gauge Maps & River Flow Data</h1>
      {/* Search List Overlay Toggle */}
      <div style={{ display: isRiverOverlay ? "none" : "block" }}>
        {listSyncError && (
          <div style={{ 
            backgroundColor: "var(--surface-hover)", 
            color: "var(--text)", 
            padding: "10px", 
            textAlign: "center", 
            borderRadius: "8px", 
            marginBottom: "15px",
            border: "1px solid var(--border)",
            fontSize: "0.85em",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px"
          }}>
            <span>
              {t("home.cloudSyncFailed")}
            </span>
            <button 
              onClick={() => refreshCloudState()}
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                padding: "2px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.9em"
              }}
            >
              {t("home.retry")}
            </button>
          </div>
        )}
        {isGlobalStale && (
          <div style={{ 
            backgroundColor: "var(--warning-bg)", 
            color: "var(--warning-text)", 
            padding: "12px", 
            textAlign: "center", 
            borderRadius: "8px", 
            marginBottom: "15px",
            border: "1px solid var(--warning)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px"
          }}>
            <span>
              {t("home.lastSynced", { mins: dataGeneratedAt ? Math.round((Date.now() - dataGeneratedAt) / 60000) : "?" })}
            </span>
            {(riversLoading || riversSyncing) ? (
              <span style={{ fontStyle: "italic", fontWeight: "bold", marginLeft: "5px" }}>
                 {t("home.syncing")}
              </span>
            ) : (
              <button 
                onClick={() => refresh()}
                style={{
                  backgroundColor: "var(--warning)",
                  color: "var(--warning-text)",
                  border: "1px solid var(--warning-text)",
                  padding: "4px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "900"
                }}
              >
                {t("home.update")}
              </button>
            )}
          </div>
        )}
        <ViewSelector 
          regionLabel={regionPrefix}
          stateLabel={searchQuery.state}
          viewLabel={viewLabel}
          currentViewId={searchQuery.listId || "all"}
          currentCountry={searchQuery.country}
          availableStates={availableStates}
          onSelectRegion={handleCountryChange}
          onSelectState={handleStateChange}
          onSelectView={handleViewChange}
        />
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
          placeholder={t("home.searchPlaceholder")}
          value={searchInputValue}
          onChange={(e) => {
            const value = e.target.value;
            setSearchInputValue(value);

            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => {
              const hasText = value.trim().length > 0;
              // When typing starts (hasText), default to relevance sort ("none").
              // When cleared, revert back to alphabetical.
              // Preserve explicit sorts only if they manually clicked a sort header.
              // Since there's no easy way to know if they manually clicked vs just had the default,
              // we will strictly follow: "typing resets any sorting".
              setSearchQuery((prev) => {
                let nextSort = prev.sortBy;
                if (hasText) {
                  nextSort = "none";
                } else if (prev.sortBy === "none") {
                  nextSort = prev.listId ? undefined : "alphabetical";
                }

                return {
                  ...prev,
                  normalSearch: value,
                  sortBy: nextSort
                };
              });
            }, 200);
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
          {t("home.advanced")}
        </button>
      </div>

      {location.loading && (!searchQuery.mapRadiusMode || searchQuery.mapRadiusMode === "current") && searchQuery.distanceMax !== undefined && searchQuery.userLat === undefined && (
          <div style={{ textAlign: "center", marginBottom: "15px", color: "var(--text-muted)", fontSize: "0.9em" }}>
             <em>{t("home.reqLocation")}</em>
          </div>
      )}
      
      {location.error && (!searchQuery.mapRadiusMode || searchQuery.mapRadiusMode === "current") && searchQuery.distanceMax !== undefined && searchQuery.userLat === undefined && (
          <div style={{ textAlign: "center", marginBottom: "15px", color: "var(--danger)", fontSize: "0.9em" }}>
             <em>{t("home.failLocation", { error: location.error })}</em>
          </div>
      )}

      {hasActiveFilters(searchQuery) && (
         <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "15px" }}>
            {/* Transient: clear this session's filters */}
            <button
                onClick={() => handleViewChange("all")}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--text-muted)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: "0.85em"
                }}
            >
                {t("home.clearFilters")}
            </button>
            {/* Persistent: pin (or unpin) this view as the startup home */}
            <button
                onClick={isCurrentViewHome ? handleClearHome : handleSetAsHome}
                title={isCurrentViewHome ? t("home.unsetHomeTitle") : t("home.setHomeTitle")}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 14px",
                    borderRadius: "50px",
                    border: "1px solid var(--primary)",
                    backgroundColor: isCurrentViewHome ? "var(--primary)" : "transparent",
                    color: isCurrentViewHome ? "#ffffff" : "var(--primary)",
                    cursor: "pointer",
                    fontSize: "0.85em",
                    fontWeight: 600,
                    transition: "all 0.2s"
                }}
            >
                <span aria-hidden="true">{isCurrentViewHome ? "✓" : "⌂"}</span>
                {isCurrentViewHome ? t("home.isYourHome") : t("home.setAsHome")}
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
        <span id="toolow">{t("home.legend.tooLow")}</span>
        <span id="lowflow">{t("home.legend.lowFlow")}</span>
        <span id="midflow">{t("home.legend.midFlow")}</span>
        <span id="highflow">{t("home.legend.highFlow")}</span>
        <span id="toohigh">{t("home.legend.tooHigh")}</span>
      </div>

      {/* Rivers List */}
      <div id="Rivers">
        <TopBar setQuery={setSearchQuery} filteredRivers={filteredRivers} />
        {filteredRivers.length === 0 && (
          <div className="empty-state-view">
            <div className="empty-state-icon">
                {emptyStateIcon}
            </div>
            <h2>
                {emptyStateTitle}
            </h2>
            <p>
                {emptyStateDesc}
            </p>
            <div className="empty-state-actions">
              <button className="clear-filters-btn" onClick={() => handleViewChange("all")}>
                  {t("home.showAllRivers")}
              </button>
              {(searchQuery.favoritesOnly || searchQuery.listId) && (
                <button 
                  className="secondary-action-btn" 
                  onClick={() => navigate("/lists")}
                >
                  {t("home.manageLists")}
                </button>
              )}
            </div>
          </div>
        )}
        {renderedRiverItems}
        </div>
      </div>

      {isRiverOverlay && (
        <React.Suspense fallback={<div className="page-content center"><h2>{t("home.loadingRiver")}</h2></div>}>
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
