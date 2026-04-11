import React, { useState } from "react";
import type { RiverData } from "../types/River";
import { skillTranslations } from "../utils/skillTranslations";
import { calculateColor } from "../utils/flowInfoCalculations";
import { RiverExpansion } from "./RiverExpansion";
import { useFavorites } from "../context/FavoritesContext";

interface RiverItemProps {
  river: RiverData;
  index: number;
  isDarkMode?: boolean;
  isColorBlindMode?: boolean;
}

export const RiverItem: React.FC<RiverItemProps> = ({
  river,
  index,
  isDarkMode = false,
  isColorBlindMode = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const baseId = `b${index}`;

  // Format class string with zero-width space for wrapping
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
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(river.id);

  return (
    <>
      <button
        id={`${baseId}1`}
        className={buttonClassNames}
        style={bgColor ? { backgroundColor: bgColor } : {}}
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
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
          className="riverspan statespan"
          title={river.states?.includes(',') ? river.states.split(',').map((s: string)=>s.trim()).join(', ') : ""}
        >
          {river.states?.includes(',') ? `${river.states.split(',')[0].trim()}+` : (river.states || "")}
        </span>

        {/* Favorite Span (Moved to Right) */}
        <span
          className="riverspan favspan"
          title={isFav ? "Remove River from Favorites" : "Add River to Favorites"}
          style={{
            color: isFav ? "#ffd700" : "inherit",
          }}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(river);
          }}
        >
          {isFav ? "★" : "☆"}
        </span>
      </button>

      {isExpanded && <RiverExpansion river={river} />}
    </>
  );
};
