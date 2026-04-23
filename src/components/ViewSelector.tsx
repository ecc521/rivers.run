import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getStateName, getRegionName } from "../utils/regions";

interface ViewSelectorProps {
  regionLabel: string;
  stateLabel?: string;
  viewLabel: string;
  currentCountry?: string;
  availableStates?: string[];
  onSelectRegion: (region: string) => void;
  onSelectState: (state: string | null) => void;
  onSelectView: (view: "all" | "favorites") => void;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({ 
    regionLabel, 
    stateLabel,
    viewLabel, 
    currentCountry,
    availableStates = [],
    onSelectRegion, 
    onSelectState,
    onSelectView 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"view" | "region" | "state">("view");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const popularStates = ["CA", "CO", "WA", "OR", "NC", "WV", "PA", "MD", "VA", "TN"];
  
  // Combine popular states (if available) and the rest of the available states
  const statesToShow = useMemo(() => {
    if (availableStates.length > 0) {
        return availableStates;
    }
    return popularStates;
  }, [availableStates]);

  const handleToggle = (tab: "view" | "region" | "state") => {
    if (isOpen && activeTab === tab) {
        setIsOpen(false);
    } else {
        setActiveTab(tab);
        setIsOpen(true);
    }
  };

  return (
    <div className="view-selector-container" ref={dropdownRef}>
      <div className="breadcrumb-path">
        <span 
            className={`breadcrumb-item link ${isOpen && activeTab === "region" ? "active-link" : ""}`} 
            onClick={() => handleToggle("region")}
        >
            {regionLabel}
        </span>
        <span className="breadcrumb-separator">/</span>
        <span 
            className={`breadcrumb-item link ${isOpen && activeTab === "state" ? "active-link" : ""}`}
            onClick={() => handleToggle("state")}
        >
            {getRegionName(stateLabel)}
        </span>
        <span className="breadcrumb-separator">/</span>
        <div 
            className={`view-switcher ${isOpen && activeTab === "view" ? "active" : ""}`} 
            onClick={() => handleToggle("view")}
        >
          <h2 className="breadcrumb-item current">{viewLabel}</h2>
          <span className="dropdown-caret">▼</span>
        </div>
      </div>

      {isOpen && (
        <div className="view-dropdownshadow">
          <div className="view-dropdown-menu">
            {activeTab === "view" && (
              <>
                <div className="view-dropdown-header">View Type</div>
                <div 
                  className={`view-dropdown-item ${viewLabel === "Full List" || viewLabel === "All Rivers" ? "selected" : ""}`} 
                  onClick={() => { onSelectView("all"); setIsOpen(false); }}
                >
                  Full List
                </div>
                <div 
                  className={`view-dropdown-item ${viewLabel === "Favorites" ? "selected" : ""}`} 
                  onClick={() => { onSelectView("favorites"); setIsOpen(false); }}
                >
                  Favorites
                </div>
                <div className="view-dropdown-divider"></div>
                <div 
                    className="view-dropdown-item secondary" 
                    onClick={() => { navigate("/lists"); setIsOpen(false); }}
                >
                  Manage Lists
                </div>
              </>
            )}

            {activeTab === "region" && (
              <>
                <div className="view-dropdown-header">Country / Region</div>
                <div 
                  className={`view-dropdown-item ${regionLabel === "All Countries" ? "selected" : ""}`} 
                  onClick={() => { onSelectRegion("global"); setIsOpen(false); }}
                >
                  All Countries
                </div>
                <div 
                  className={`view-dropdown-item ${regionLabel === "United States" ? "selected" : ""}`} 
                  onClick={() => { onSelectRegion("usa"); setIsOpen(false); }}
                >
                  United States
                </div>
                <div 
                  className={`view-dropdown-item ${regionLabel === "Canada" ? "selected" : ""}`} 
                  onClick={() => { onSelectRegion("ec"); setIsOpen(false); }}
                >
                  Canada
                </div>
                <div 
                  className={`view-dropdown-item ${regionLabel === "UK / Ireland" ? "selected" : ""}`} 
                  onClick={() => { onSelectRegion("uk_ireland"); setIsOpen(false); }}
                >
                  UK / Ireland
                </div>
              </>
            )}

            {activeTab === "state" && (
              <>
                <div className="view-dropdown-header">{currentCountry === "ec" ? "Provinces" : "All Regions"}</div>
                <div 
                  className={`view-dropdown-item ${!stateLabel ? "selected" : ""}`} 
                  onClick={() => { onSelectState(null); setIsOpen(false); }}
                >
                  {currentCountry === "ec" ? "All Provinces" : "All Regions"}
                </div>
                {statesToShow.map((st: string) => (
                    <div 
                        key={st}
                        className={`view-dropdown-item ${stateLabel === st ? "selected" : ""}`} 
                        onClick={() => { onSelectState(st); setIsOpen(false); }}
                    >
                        {getStateName(st)}
                    </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
