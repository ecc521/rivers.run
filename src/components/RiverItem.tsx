/* eslint-disable sonarjs/no-nested-functions */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RiverData } from "../types/River";
import { skillTranslations } from "../utils/skillTranslations";
import { calculateColor } from "../utils/flowInfoCalculations";

import { useLists } from "../context/ListsContext";
import { useSettings } from "../context/SettingsContext";
import { ListSelectModal } from "./ListSelectModal";

interface RiverItemProps {
  river: RiverData;
  index: number;
  isDarkMode?: boolean;
  isColorBlindMode?: boolean;
  initiallyExpanded?: boolean; // legacy prop, preserved for safety

}

function slugify(text: string) {
  if (!text) return '';
  const cleaned = text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
  return cleaned.split('-').filter(Boolean).join('-');
}

export const RiverItem: React.FC<RiverItemProps> = ({
  river,
  index,
  isDarkMode = false,
  isColorBlindMode = false,

}) => {
  const navigate = useNavigate();
  const baseId = `b${index}`;

  const riverClass = river.class ? river.class.split("(").join("\u200b(") : "";
  const translatedSkill = skillTranslations[river.skill] || "Unknown";

  const buttonClassNames = [
    "riverbutton",
    river.isGauge ? "riverbuttonGauge" : "",
    river.dam ? "riverbuttonDam" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const bgColor = calculateColor(
    river.running ?? null,
    isDarkMode,
    isColorBlindMode,
  );
  
  const { myLists, addRiverToList, removeRiverFromList, toggleRiverInQuickList } = useLists();
  const { quickActionPref } = useSettings();
  const [isModalOpen, setModalOpen] = useState(false);
  
  let targetListId: string | null = null;
  
  if (myLists.length === 1) {
    targetListId = myLists[0].id;
  } else if (quickActionPref.startsWith("list:")) {
    targetListId = quickActionPref.split(":")[1];
  } else if (quickActionPref === "favorites") {
    const favList = myLists.find(l => l.title === "Favorites");
    if (favList) targetListId = favList.id;
  }

  let isActive = false;
  let displayIcon = "☆";
  let displayColor = "inherit";

  if (targetListId) {
    const list = myLists.find(l => l.id === targetListId);
    if (list) {
      isActive = list.rivers.some(r => r.id === river.id);
      
      if (myLists.length === 1 || quickActionPref === "favorites") {
        displayIcon = isActive ? "★" : "☆";
      } else {
        displayIcon = isActive ? "✓" : "+";
      }
      displayColor = isActive ? "#ffd700" : "inherit";
    }
  }

  const handleActionClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (targetListId) {
       if (isActive) {
          await removeRiverFromList(targetListId, river.id);
       } else {
          await addRiverToList(targetListId, river);
       }
    } else if (myLists.length === 0) {
       toggleRiverInQuickList(river, "favorites");
    } else {
       setModalOpen(true);
    }
  };

  const handleCloseModal = () => setModalOpen(false);

  const handleNavigate = () => {
     let slug = slugify(river.name);
     if (river.section) slug += '-' + slugify(river.section);
     navigate(`/river/${river.id}/${slug}`);
  };

  return (
    <React.Fragment>
      <button
        id={`${baseId}1`}
        className={buttonClassNames}
        style={bgColor ? { backgroundColor: bgColor } : {}}
        onClick={handleNavigate}
      >
        <span className="riverspan">{river.name}</span>
        <span className="riverspan">{river.section}</span>

        {/* Skill Span */}
        <span
          className="riverspan skillspan tooltip"
          style={{ borderBottom: "none" }}
        >
          <div className="tooltip">
            {(!river.skill || river.skill.toLowerCase() === "unknown") ? "?" : river.skill}
            <span className="tooltiptext">{translatedSkill}</span>
          </div>
        </span>

        {/* Class Span */}
        <span className="riverspan classspan">{(!riverClass || riverClass.trim().toLowerCase() === "unknown") ? "?" : riverClass}</span>


        {/* Flow Span */}
        {(river.flowInfo || typeof river.flow === "string") ? (
          <span className="riverspan flowspan">{river.flowInfo || (typeof river.flow === "string" ? river.flow : "")}</span>
        ) : (river.dam ? (
          <span className="riverspan flowspan">Dam</span>
        ) : <span className="riverspan flowspan"></span>)}

        {/* State Span */}
        <span 
          className={`riverspan statespan ${river.states?.includes(',') ? "tooltip tooltip-bottom" : ""}`}
          style={river.states?.includes(',') ? { borderBottom: "none", cursor: "pointer" } : {}}
        >
          {river.states?.includes(',') ? `${river.states.split(',')[0].trim()}+` : (river.states || "")}
          {river.states?.includes(',') && (
             <span className="tooltiptext" style={{ fontWeight: "normal", fontSize: "0.95em", padding: "6px 10px" }}>
                 {river.states.split(',').map((s: string)=>s.trim()).join(', ')}
             </span>
          )}
        </span>

        {/* Favorite Span (Moved to Right) */}
        <span
          className="riverspan favspan"
          title={quickActionPref.startsWith("list:") ? (isActive ? "Remove from List" : "Add to List") : (quickActionPref === "ask" && myLists.length > 0 ? "Save River to Lists" : (isActive ? "Remove River from Lists" : "Add River to Lists"))}
          style={{
            color: displayColor,
            fontWeight: quickActionPref.startsWith("list:") ? "bold" : "normal",
            fontSize: quickActionPref.startsWith("list:") ? "1.3em" : "1.2em"
          }}
          onClick={handleActionClick}
        >
          {displayIcon}
        </span>

        {isModalOpen && (
           <ListSelectModal 
              isOpen={isModalOpen} 
              onClose={handleCloseModal} 
              riverId={river.id} 
           />
        )}
      </button>

    </React.Fragment>
  );
};

