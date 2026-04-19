import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ViewSelectorProps {
  currentTitle: string;
  onSelectView: (view: "all" | "favorites") => void;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({ currentTitle, onSelectView }) => {
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
        <span className="breadcrumb-item link" onClick={() => navigate("/")}>Rivers</span>
        <span className="breadcrumb-separator">/</span>
        <div className={`view-switcher ${isOpen ? "active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
          <h1 className="breadcrumb-item current">{currentTitle}</h1>
          <span className="dropdown-caret">▼</span>
        </div>
      </div>

      {isOpen && (
        <div className="view-dropdownshadow">
          <div className="view-dropdown-menu">
            <div 
              className={`view-dropdown-item ${currentTitle === "River Information" || currentTitle === "All Rivers" ? "selected" : ""}`} 
              onClick={() => { onSelectView("all"); setIsOpen(false); }}
            >
              All Rivers
            </div>
            <div 
              className={`view-dropdown-item ${currentTitle === "Favorites" ? "selected" : ""}`} 
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
          </div>
        </div>
      )}
    </div>
  );
};
