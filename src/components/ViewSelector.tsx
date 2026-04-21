import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ViewSelectorProps {
  regionLabel: string;
  viewLabel: string;
  onSelectRegion: (region: string) => void;
  onSelectView: (view: "all" | "favorites") => void;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({ 
    regionLabel, 
    viewLabel, 
    onSelectRegion, 
    onSelectView 
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="view-selector-container" ref={dropdownRef}>
      <div className="breadcrumb-path">
        <span className="breadcrumb-item link" onClick={() => setIsOpen(!isOpen)}>
            {regionLabel} Rivers
        </span>
        <span className="breadcrumb-separator">/</span>
        <div className={`view-switcher ${isOpen ? "active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
          <h2 className="breadcrumb-item current">{viewLabel}</h2>
          <span className="dropdown-caret">▼</span>
        </div>
      </div>

      {isOpen && (
        <div className="view-dropdownshadow">
          <div className="view-dropdown-menu">
            <div className="view-dropdown-header">Change View</div>
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
            <div className="view-dropdown-header">Change Region</div>
            <div 
              className={`view-dropdown-item ${regionLabel === "Global" ? "selected" : ""}`} 
              onClick={() => { onSelectRegion("global"); setIsOpen(false); }}
            >
              Global
            </div>
            <div 
              className={`view-dropdown-item ${regionLabel === "USA" ? "selected" : ""}`} 
              onClick={() => { onSelectRegion("usa"); setIsOpen(false); }}
            >
              USA
            </div>
            <div 
              className={`view-dropdown-item ${regionLabel === "EC" ? "selected" : ""}`} 
              onClick={() => { onSelectRegion("ec"); setIsOpen(false); }}
            >
              EC
            </div>
            <div 
              className={`view-dropdown-item ${regionLabel === "UK/Ireland" ? "selected" : ""}`} 
              onClick={() => { onSelectRegion("uk_ireland"); setIsOpen(false); }}
            >
              UK / Ireland
            </div>

            <div className="view-dropdown-divider"></div>
            <div 
                className="view-dropdown-item secondary" 
                onClick={() => { navigate("/lists"); setIsOpen(false); }}
            >
              Manage Lists
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
