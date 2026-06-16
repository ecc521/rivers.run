import React, { useState } from "react";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { ListSelectModal } from "./ListSelectModal";
import { useTranslation } from "react-i18next";

interface TopBarProps {
  setQuery: React.Dispatch<React.SetStateAction<AdvancedSearchQuery>>;
  filteredRivers: any[];
}

export const TopBar: React.FC<TopBarProps> = ({ setQuery, filteredRivers }) => {
  const { t } = useTranslation();
  const [isListModalOpen, setListModalOpen] = useState(false);

  const toggleSort = (nextSort: NonNullable<AdvancedSearchQuery["sortBy"]>) => {
    setQuery((prev) => {
      if (prev.sortBy === nextSort) {
        return { ...prev, sortReverse: !prev.sortReverse };
      }
      return { ...prev, sortBy: nextSort, sortReverse: nextSort === "running" };
    });
  };

  return (
    <div id="topbar" className="riverbutton" style={{ overflow: "visible" }}>
      <span
        className="riverspan"
        onClick={() => {
          toggleSort("alphabetical");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSort("alphabetical");
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        {t("topBar.river")}
      </span>
      <span className="riverspan">{t("topBar.section")}</span>
      <span
        className="riverspan skillspan"
        onClick={() => {
          toggleSort("skill");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSort("skill");
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        {t("topBar.skill")}
      </span>
      <span
        className="riverspan classspan"
        onClick={() => {
          toggleSort("class");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSort("class");
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        {t("topBar.class")}
      </span>
      <span
        className="riverspan flowspan"
        onClick={() => {
          toggleSort("running");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSort("running");
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        {t("topBar.flow")}
      </span>
      <span
        className="riverspan statespan"
        onClick={() => {
          toggleSort("state" as any);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSort("state" as any);
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        {t("topBar.state")}
      </span>

      <span
        className="riverspan favspan"
        style={{ position: "relative", overflow: "visible", cursor: "pointer", fontSize: "1.2em", fontWeight: "bold" }}
        title="Configure Quick Save Target"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setListModalOpen(true);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setListModalOpen(true);
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", fontSize: "1.05em" }}>
           ⚙
        </div>

        {isListModalOpen && (
          <ListSelectModal 
             isOpen={isListModalOpen} 
             onClose={() => setListModalOpen(false)} 
             riverId={null} 
             filteredRivers={filteredRivers}
          />
        )}
      </span>
    </div>
  );
};
