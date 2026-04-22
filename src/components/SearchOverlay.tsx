import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { useLocation } from "../hooks/useLocation";
import { FilterCheckbox } from "./FilterCheckbox";
import { useLists } from "../context/ListsContext";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { getShareBaseUrl } from "../utils/url";


interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  query: AdvancedSearchQuery;
  setQuery: (q: AdvancedSearchQuery) => void;
  isMapMode?: boolean;
  portalTarget?: HTMLElement | null;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  query,
  setQuery,
  isMapMode = false,
  portalTarget
}) => {
  const [localQuery, setLocalQuery] = useState<AdvancedSearchQuery>(query);
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const { myLists } = useLists();
  useEffect(() => {
    setLocalQuery(query);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const handleApply = async () => {
    const finalQuery = { ...localQuery };
    
    const shouldRequestLocation = finalQuery.distanceMax && 
                                finalQuery.distanceMax > 0 && 
                                finalQuery.mapRadiusMode !== "center" && 
                                finalQuery.mapRadiusMode !== "custom";

    if (shouldRequestLocation) {
      if (!location.latitude || !location.longitude) {
         const coords = await location.requestLocation();
         if (coords) {
            finalQuery.userLat = coords.latitude;
            finalQuery.userLon = coords.longitude;
         } else {
            finalQuery.distanceMax = undefined;
         }
      } else {
         finalQuery.userLat = location.latitude;
         finalQuery.userLon = location.longitude;
      }
    }

    setQuery(finalQuery);
    onClose();
  };


  const handleReset = () => {
    const resetQ = {
      normalSearch: query.normalSearch,
      skillMin: 1,
      skillMax: 8,
      flowMin: 0,
      flowMax: 4,
      includeUnknownSkill: true,
      includeUnknownFlow: true,
      includeDams: true,
      distanceMax: undefined,
      userLat: undefined,
      userLon: undefined,
      mapRadiusMode: undefined,
      listId: undefined,
      favoritesOnly: false,
      listData: undefined,
      country: undefined,
      state: undefined,
    };
    setLocalQuery(resetQ);
    setQuery(resetQ);
  };

  const getShareUrl = () => {
      const url = new URL(getShareBaseUrl(window.location.pathname));

      const params = url.searchParams;

      const setIfValid = (key: string, val: any, defaultVal?: any) => {
          if (val !== undefined && val !== null && val !== defaultVal) {
              params.set(key, val.toString());
          }
      };

      setIfValid("search", localQuery.normalSearch);
      setIfValid("name", localQuery.name);
      setIfValid("section", localQuery.section);
      
      if (localQuery.distanceMax) {
          params.set("distanceMax", localQuery.distanceMax.toString());
          setIfValid("radiusMode", localQuery.mapRadiusMode);
          setIfValid("userLat", localQuery.userLat);
          setIfValid("userLon", localQuery.userLon);
      }

      setIfValid("skillMin", localQuery.skillMin, 1);
      setIfValid("skillMax", localQuery.skillMax, 8);
      setIfValid("flowMin", localQuery.flowMin, 0);
      setIfValid("flowMax", localQuery.flowMax, 4);
      setIfValid("sortBy", localQuery.sortBy, "none");
      
      if (localQuery.sortReverse) params.set("sortReverse", "true");
      
      return url.toString();
  };
  const shareUrl = getShareUrl();

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "85vh",
          backgroundColor: "var(--surface)",
          borderRadius: "16px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
        onClick={(e) => {
          e.stopPropagation();
        }} // Prevent close on modal click
      >
        {/* Sticky Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            backgroundColor: "var(--surface)",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
            zIndex: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {isMapMode ? "Map Filters" : "Advanced Filters"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {!localQuery.favoritesOnly && (
            <div style={{...getSectionStyle(), backgroundColor: "var(--surface-hover)", padding: "15px", borderRadius: "8px", border: "1px solid var(--border)"}}>
              <label style={getLabelStyle()}>Sharable Link to This Search</label>
              <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                <input 
                    type="text" 
                    readOnly 
                    value={shareUrl}
                    style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface)",
                        color: "var(--text)",
                        fontSize: "0.85rem"
                    }}
                />
                <button 
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(shareUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        } catch (err) {
                            console.error("Failed to copy", err);
                        }
                    }}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: copied ? "var(--success, #10b981)" : "var(--primary)",
                        color: "white",
                        fontWeight: "bold",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        transition: "all 0.2s"
                    }}
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div style={getSectionStyle()}>
            <label style={getLabelStyle()}>River Name Contains</label>
            <input
              style={getInputStyle()}
              type="text"
              placeholder="e.g. Potomac"
              value={localQuery.name || ""}
              onChange={(e) => {
                setLocalQuery({ ...localQuery, name: e.target.value });
              }}
            />
          </div>

          <div style={getSectionStyle()}>
            <label style={getLabelStyle()}>Section Contains</label>
            <input
              style={getInputStyle()}
              type="text"
              placeholder="e.g. Lower"
              value={localQuery.section || ""}
              onChange={(e) => {
                setLocalQuery({ ...localQuery, section: e.target.value });
              }}
            />
          </div>

          <div style={getSectionStyle()}>
            <label style={getLabelStyle()}>
              {isMapMode ? "Draw Radius Circle" : "Search within Radius"}: {(() => {
                if (!localQuery.distanceMax || localQuery.distanceMax > 500) {
                  return isMapMode ? 'No Circle' : 'Any Distance';
                }
                return `${localQuery.distanceMax} Miles`;
              })()}
            </label>


            <div style={{ display: "flex", gap: "10px", marginTop: "5px", marginBottom: "15px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="radiusMode" 
                  checked={localQuery.mapRadiusMode === "current" || (!localQuery.mapRadiusMode && !localQuery.userLat)} 
                  onChange={() => setLocalQuery({ ...localQuery, mapRadiusMode: "current" })}
                /> 
                From Current Location
              </label>
              {isMapMode && (
                <label style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="radiusMode" 
                    checked={localQuery.mapRadiusMode === "center"} 
                    onChange={() => setLocalQuery({ ...localQuery, mapRadiusMode: "center" })}
                  /> 
                  From Center of Map
                </label>
              )}
              <label style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="radiusMode" 
                  checked={localQuery.mapRadiusMode === "custom" || (!localQuery.mapRadiusMode && localQuery.userLat !== undefined)} 
                  onChange={() => setLocalQuery({ ...localQuery, mapRadiusMode: "custom" })}
                /> 
                Custom Coordinates
              </label>
            </div>

            { (localQuery.mapRadiusMode === "custom" || (!localQuery.mapRadiusMode && localQuery.userLat !== undefined)) && (
                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <input 
                        style={{ ...getInputStyle(), flex: 1, padding: "8px 12px", fontSize: "0.9rem" }}
                        type="number"
                        placeholder="Latitude (e.g. 39.8283)"
                        step="0.00001"
                        value={localQuery.userLat ?? ""}
                        onChange={(e) => setLocalQuery({ ...localQuery, userLat: parseFloat(e.target.value) || undefined, mapRadiusMode: "custom" })}
                    />
                    <input 
                        style={{ ...getInputStyle(), flex: 1, padding: "8px 12px", fontSize: "0.9rem" }}
                        type="number"
                        placeholder="Longitude (e.g. -98.5795)"
                        step="0.00001"
                        value={localQuery.userLon ?? ""}
                        onChange={(e) => setLocalQuery({ ...localQuery, userLon: parseFloat(e.target.value) || undefined, mapRadiusMode: "custom" })}
                    />
                </div>
            )}

            <input
              type="range"
              min={10}
              max={510}
              step={10}
              value={520 - (localQuery.distanceMax || 510)}
              onChange={(e) => {
                const rawVal = parseInt(e.target.value);
                const actualDistance = 520 - rawVal;
                setLocalQuery({ ...localQuery, distanceMax: actualDistance > 500 ? undefined : actualDistance });
              }}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
              <span>Unlimited</span>
              <span>10 Mi</span>
            </div>
            {location.loading && (!isMapMode || (localQuery.mapRadiusMode !== "center" && localQuery.mapRadiusMode !== "custom")) && <span style={{fontSize: '0.8em', color: "var(--text-muted)"}}>Requesting location hardware...</span>}
            {location.error && (!isMapMode || (localQuery.mapRadiusMode !== "center" && localQuery.mapRadiusMode !== "custom")) && <span style={{fontSize: '0.8em', color: "var(--danger)"}}>{location.error}</span>}
          </div>

          <div style={getSectionStyle()}>
            <label style={getLabelStyle()}>
              Skill Range
            </label>
            <div style={{ padding: "10px 10px 30px" }}>
              <Slider
                range
                min={1}
                max={8}
                marks={{
                  1: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "FW" },
                  2: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "B" },
                  3: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "N" },
                  4: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "LI" },
                  5: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "I" },
                  6: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "HI" },
                  7: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "A" },
                  8: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "E" }
                }}
                value={[localQuery.skillMin ?? 1, localQuery.skillMax ?? 8]}
                onChange={(val) => {
                  if (Array.isArray(val)) {
                    setLocalQuery({
                      ...localQuery,
                      skillMin: val[0],
                      skillMax: val[1],
                    });
                  }
                }}
                styles={{
                  track: { backgroundColor: "var(--primary)", height: 6 },
                  handle: { borderColor: "var(--primary)", backgroundColor: "var(--surface)", height: 22, width: 22, marginTop: -8, boxShadow: "0 2px 4px rgba(0,0,0,0.2)" },
                  rail: { backgroundColor: "var(--border)", height: 6 }
                }}
              />
            </div>
          </div>

          <div style={getSectionStyle()}>
            <label style={getLabelStyle()}>
              Relative Flow
            </label>
            <div style={{ padding: "10px 10px 30px" }}>
              <Slider
                range
                min={0}
                max={4}
                step={0.1}
                marks={{
                  0: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "Min" },
                  1: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "Low" },
                  2: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "Mid" },
                  3: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "High" },
                  4: { style: { color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }, label: "Max" }
                }}
                value={[localQuery.flowMin ?? 0, localQuery.flowMax ?? 4]}
                onChange={(val) => {
                  if (Array.isArray(val)) {
                    setLocalQuery({
                      ...localQuery,
                      flowMin: val[0],
                      flowMax: val[1],
                    });
                  }
                }}
                styles={{
                  track: { backgroundColor: "var(--primary)", height: 6 },
                  handle: { borderColor: "var(--primary)", backgroundColor: "var(--surface)", height: 22, width: 22, marginTop: -8, boxShadow: "0 2px 4px rgba(0,0,0,0.2)" },
                  rail: { backgroundColor: "var(--border)", height: 6 }
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div className="filter-group" style={{ color: "var(--text-secondary)" }}>
              <h3 style={{ color: "var(--text)" }}>Include the Following:</h3>
              <FilterCheckbox
                label="Unknown Skill Levels"
                checked={localQuery.includeUnknownSkill || false}
                onChange={(checked) => setLocalQuery({ ...localQuery, includeUnknownSkill: checked })}
              />
              <FilterCheckbox
                label="Unknown Flow Values"
                checked={localQuery.includeUnknownFlow || false}
                onChange={(checked) => setLocalQuery({ ...localQuery, includeUnknownFlow: checked })}
              />

              <FilterCheckbox
                label="Include Dam Controlled Rivers"
                checked={localQuery.includeDams || false}
                onChange={(checked) => setLocalQuery({ ...localQuery, includeDams: checked })}
              />
              
              <div style={{...getSectionStyle(), marginTop: '10px'}}>
                <label style={{...getLabelStyle(), color: "var(--primary)"}}>Limit to Specific Lists</label>
                <select
                  style={{...getInputStyle(), padding: "8px 12px", width: "100%", maxWidth: "300px"}}
                  value={localQuery.favoritesOnly ? "favorites" : (localQuery.listId || "none")}
                  onChange={(e) => {
                     const val = e.target.value;
                     if (val === "none") {
                         setLocalQuery({ ...localQuery, favoritesOnly: false, listId: undefined, listData: undefined });
                     } else if (val === "favorites") {
                         setLocalQuery({ ...localQuery, favoritesOnly: true, listId: undefined, listData: undefined });
                     } else {
                         const list = myLists.find(l => l.id === val);
                         if (list) {
                            setLocalQuery({ 
                                ...localQuery, 
                                favoritesOnly: false, 
                                listId: list.id,
                                listData: list.rivers.map((r, i) => ({ id: r.id, order: i })) 
                            });
                         }
                     }
                  }}
                >
                  <option value="none">All Available Rivers</option>
                  <option value="favorites">Favorites</option>
                  {myLists.map(l => (
                     <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            backgroundColor: "var(--surface-hover)",
            padding: "20px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            onClick={handleReset}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--surface)",
              fontWeight: 600,
              boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.5)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>,
    portalTarget || document.body
  );
};

// Reusable Styles
const getSectionStyle = (): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const getLabelStyle = (): React.CSSProperties => ({
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const getInputStyle = (): React.CSSProperties => ({
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface)",
  fontSize: "1rem",
  color: "var(--text)",
  outline: "none",
  transition: "border-color 0.2s",
});
