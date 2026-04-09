import React, { useState, useEffect } from "react";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  query: AdvancedSearchQuery;
  setQuery: (q: AdvancedSearchQuery) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  query,
  setQuery,
}) => {
  // Use a local copy so changes aren't applied until "Apply" is pushed, or we can apply it live since performance is good.
  const [localQuery, setLocalQuery] = useState<AdvancedSearchQuery>(query);

  useEffect(() => {
    setLocalQuery(query);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    setQuery(localQuery);
    onClose();
  };

  const handleReset = () => {
    const resetQ = {
      normalSearch: query.normalSearch,
      skillMin: 1,
      skillMax: 8,
      flowMin: 0,
      flowMax: 4,
      ratingMin: 1,
      ratingMax: 5,
      includeUnknownSkill: true,
      includeUnknownFlow: true,
      includeUnknownRating: true,
      includeDams: true,
      sortBy: "none" as const,
      sortReverse: false,
    };
    setLocalQuery(resetQ);
    setQuery(resetQ);
  };

  return (
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
          backgroundColor: "#ffffff",
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
            backgroundColor: "#ffffff",
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
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
              color: "#1e293b",
            }}
          >
            Advanced Filters
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#64748b",
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
          <div style={sectionStyle}>
            <label style={labelStyle}>River Name Contains</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Potomac"
              value={localQuery.name || ""}
              onChange={(e) => {
                setLocalQuery({ ...localQuery, name: e.target.value });
              }}
            />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Section Contains</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Lower"
              value={localQuery.section || ""}
              onChange={(e) => {
                setLocalQuery({ ...localQuery, section: e.target.value });
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div style={sectionStyle}>
              <label style={labelStyle}>
                Skill Min ({localQuery.skillMin})
              </label>
              <input
                type="range"
                min={1}
                max={8}
                value={localQuery.skillMin}
                onChange={(e) => {
                  setLocalQuery({
                    ...localQuery,
                    skillMin: parseInt(e.target.value),
                  });
                }}
                style={{ width: "100%" }}
              />
            </div>
            <div style={sectionStyle}>
              <label style={labelStyle}>
                Skill Max ({localQuery.skillMax})
              </label>
              <input
                type="range"
                min={1}
                max={8}
                value={localQuery.skillMax}
                onChange={(e) => {
                  setLocalQuery({
                    ...localQuery,
                    skillMax: parseInt(e.target.value),
                  });
                }}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div style={sectionStyle}>
              <label style={labelStyle}>Flow Min ({localQuery.flowMin})</label>
              <input
                type="range"
                step={0.1}
                min={0}
                max={4}
                value={localQuery.flowMin}
                onChange={(e) => {
                  setLocalQuery({
                    ...localQuery,
                    flowMin: parseFloat(e.target.value),
                  });
                }}
                style={{ width: "100%" }}
              />
            </div>
            <div style={sectionStyle}>
              <label style={labelStyle}>Flow Max ({localQuery.flowMax})</label>
              <input
                type="range"
                step={0.1}
                min={0}
                max={4}
                value={localQuery.flowMax}
                onChange={(e) => {
                  setLocalQuery({
                    ...localQuery,
                    flowMax: parseFloat(e.target.value),
                  });
                }}
                style={{ width: "100%" }}
              />
            </div>
            <div className="filter-group">
              <h3>Include the Following:</h3>
              <label
                style={{ display: "block", margin: "8px 0", fontSize: "1.2em" }}
              >
                <input
                  type="checkbox"
                  checked={localQuery.includeUnknownSkill}
                  onChange={(e) => {
                    setLocalQuery({
                      ...localQuery,
                      includeUnknownSkill: e.target.checked,
                    });
                  }}
                />{" "}
                Unknown Skill Levels
              </label>
              <label
                style={{ display: "block", margin: "8px 0", fontSize: "1.2em" }}
              >
                <input
                  type="checkbox"
                  checked={localQuery.includeUnknownFlow}
                  onChange={(e) => {
                    setLocalQuery({
                      ...localQuery,
                      includeUnknownFlow: e.target.checked,
                    });
                  }}
                />{" "}
                Unknown Flow Values
              </label>
              <label
                style={{ display: "block", margin: "8px 0", fontSize: "1.2em" }}
              >
                <input
                  type="checkbox"
                  checked={localQuery.includeUnknownRating}
                  onChange={(e) => {
                    setLocalQuery({
                      ...localQuery,
                      includeUnknownRating: e.target.checked,
                    });
                  }}
                />{" "}
                Unknown Ratings
              </label>
              <label
                style={{ display: "block", margin: "8px 0", fontSize: "1.2em" }}
              >
                <input
                  type="checkbox"
                  checked={localQuery.includeDams}
                  onChange={(e) => {
                    setLocalQuery({
                      ...localQuery,
                      includeDams: e.target.checked,
                    });
                  }}
                />{" "}
                Dams / Flatwater
              </label>
              <label
                style={{
                  display: "block",
                  margin: "8px 0",
                  fontSize: "1.2em",
                  color: "#3b82f6",
                  fontWeight: "bold",
                }}
              >
                <input
                  type="checkbox"
                  checked={localQuery.favoritesOnly || false}
                  onChange={(e) => {
                    setLocalQuery({
                      ...localQuery,
                      favoritesOnly: e.target.checked,
                    });
                  }}
                />{" "}
                My Favorites Only
              </label>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            backgroundColor: "#f8fafc",
            padding: "20px 24px",
            borderTop: "1px solid #e2e8f0",
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
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#475569",
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
              backgroundColor: "#3b82f6",
              color: "#ffffff",
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
    </div>
  );
};

// Reusable Styles
const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "1rem",
  color: "#0f172a",
  outline: "none",
  transition: "border-color 0.2s",
};
