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
            {river.skill}
            <span className="tooltiptext">{translatedSkill}</span>
          </div>
        </span>

        {/* Class Span */}
        <span className="riverspan classspan">{riverClass}</span>

        {/* Rating Span */}
        {river.rating === "Error" || river.rating === undefined ? (
          <span className="riverspan emptyStars" style={{ opacity: 0.2 }}>
            ☆☆☆☆☆
          </span>
        ) : (
          <span className="riverspan">
            <span className="emptyStars" style={{ opacity: 0 }}>
              ☆☆☆☆☆
            </span>
            <span
              className="emptyStars"
              style={{ position: "absolute", zIndex: 1 }}
            >
              ☆☆☆☆☆
            </span>
            <span
              className="fullStars"
              style={{ width: `${river.rating * 20}%` }}
            >
              ★★★★★
            </span>
          </span>
        )}

        {/* Flow Span */}
        {river.flow ? (
          <span className="riverspan flowspan">{river.flow}</span>
        ) : river.dam ? (
          <span className="riverspan flowspan">Dam</span>
        ) : null}

        {/* Favorite Span (Moved to Right) */}
        <span
          className="riverspan"
          style={{
            marginLeft: "auto",
            paddingRight: "8px",
            cursor: "pointer",
            color: isFav ? "#ffd700" : "inherit",
            fontSize: "1.2em",
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
