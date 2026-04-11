import React from "react";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";

interface TopBarProps {
  query: AdvancedSearchQuery;
  setQuery: (q: React.SetStateAction<AdvancedSearchQuery>) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ setQuery }) => {
  const toggleSort = (nextSort: NonNullable<AdvancedSearchQuery["sortBy"]>) => {
    setQuery((prev) => {
      // If clicking the same sort, toggle reverse. Else set to new sort.
      // Flow defaults to highest first (reverse=true). Other sorts default to A-Z/Lowest first (reverse=false).
      if (prev.sortBy === nextSort) {
        return { ...prev, sortReverse: !prev.sortReverse };
      }
      return { ...prev, sortBy: nextSort, sortReverse: nextSort === "running" };
    });
  };

  return (
    <button id="topbar" className="riverbutton">
      <span
        className="riverspan"
        onClick={() => {
          toggleSort("alphabetical");
        }}
        style={{ cursor: "pointer" }}
      >
        River⇅
      </span>
      <span className="riverspan">Section</span>
      <span
        className="riverspan skillspan"
        onClick={() => {
          toggleSort("skill");
        }}
        style={{ cursor: "pointer" }}
      >
        Skill⇅
      </span>
      <span
        className="riverspan classspan"
        onClick={() => {
          toggleSort("class");
        }}
        style={{ cursor: "pointer" }}
      >
        Class⇅
      </span>
      <span
        className="riverspan flowspan"
        onClick={() => {
          toggleSort("running");
        }}
        style={{ cursor: "pointer" }}
      >
        Flow⇅
      </span>
      <span
        className="riverspan statespan"
        onClick={() => {
          toggleSort("state" as any);
        }}
        style={{ cursor: "pointer" }}
      >
        State⇅
      </span>
    </button>
  );
};
