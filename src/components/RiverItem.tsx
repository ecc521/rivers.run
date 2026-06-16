import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RiverData } from "../types/River";
import { getSkillAbbreviation, getSkillFull } from "../utils/skillTranslations";
import { calculateColor, calculateTrend } from "../utils/flowInfoCalculations";
import { slugify } from "../utils/url";


import { useLists } from "../context/ListsContext";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { ListSelectModal } from "./ListSelectModal";
import { useTranslation } from "react-i18next";

interface RiverItemProps {
  river: RiverData;
  index: number;
  isDarkMode?: boolean;
  isColorBlindMode?: boolean;
  initiallyExpanded?: boolean; // legacy prop, preserved for safety
  onClickOverride?: () => void;
}



export const RiverItem: React.FC<RiverItemProps> = ({
  river,
  index,
  isDarkMode = false,
  isColorBlindMode = false,
  onClickOverride
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const baseId = `b${index}`;

  const riverClass = river.class ? river.class.split("(").join("\u200b(") : "";
  const translatedSkill = getSkillFull(river.skill);
  const skillAbbr = getSkillAbbreviation(river.skill);

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
  const { quickActionPref, updateSetting } = useSettings();
  const { user, setAuthModalOpen } = useAuth();
  const { confirm } = useModal();
  const [isModalOpen, setModalOpen] = useState(false);
  
  let targetListId: string | null = null;
  
  if (myLists.length === 1) {
    targetListId = myLists[0].id;
  } else if (quickActionPref && quickActionPref.startsWith("list:")) {
    targetListId = quickActionPref.split(":")[1];
  }

  let isActive = false;
  let displayIcon = "☆";
  let displayColor = "inherit";

  if (targetListId) {
    // Check both My Lists and local cache effectively
    const list = myLists.find(l => l.id === targetListId);
    if (list) {
      isActive = list.rivers.some(r => r.id === river.id);
      displayIcon = isActive ? "★" : "☆";
      displayColor = isActive ? "#ffd700" : "inherit";
    } else {
       // It's likely a community list we are viewing/targeting
       // We can still show it as 'active' (starred) if we are currently looking at that list's content
       // but we won't be able to modify it without the redirect.
       // For now, if we don't have the list object, we default to outline star.
    }
  }

  const handleActionClick = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (!user) {
        const shouldSignIn = await confirm(t("riverItem.signInPrompt"), t("riverItem.signInRequired"));
        if (shouldSignIn) {
            setAuthModalOpen(true);
        }
        return;
    }

    try {
      if (targetListId) {
         const ownedList = myLists.find(l => l.id === targetListId);
         if (!ownedList) {
             const goToLists = await confirm(
                 t("riverItem.listOwnershipPrompt"),
                 t("riverItem.listOwnership")
             );
             if (goToLists) navigate("/lists");
             return;
         }

         if (isActive) {
            await removeRiverFromList(targetListId, river.id);
         } else {
            await addRiverToList(targetListId, river);
         }
      } else if (myLists.length === 0) {
         const newTargetId = await toggleRiverInQuickList(river, null);
         if (newTargetId) updateSetting("quickActionPref", `list:${newTargetId}`);
      } else {
         setModalOpen(true);
      }
    } catch (e: any) {
      console.error("Failed to perform list action:", e);
      await confirm(e.message || t("riverItem.updateError"), t("riverItem.updateErrorTitle"));
    }
  };

  const handleCloseModal = () => setModalOpen(false);

  const handleNavigate = () => {
     if (onClickOverride) {
         onClickOverride();
         return;
     }
     let slug = slugify(river.name);
     if (river.section) slug += '-' + slugify(river.section);
     const prefix = river.isGauge ? '/gauge/' : '/river/';
     navigate(`${prefix}${river.id}/${slug}${window.location.search}`);
  };

  const getTrendArrow = () => {
    const primaryGauge = river.gauges?.find((g: any) => g.isPrimary) || river.gauges?.[0];
    const primaryGaugeId = primaryGauge?.id;
    const readings = primaryGaugeId ? river.gaugeData?.[primaryGaugeId] : undefined;
    const trend = calculateTrend(readings);

    if (trend === "up") return <span className="trend-arrow">⬆</span>;
    if (trend === "down") return <span className="trend-arrow">⬇</span>;
    if (trend === "flat") return <span className="trend-arrow trend-flat">‐</span>;
    return null;
  };

  const getFlowDisplay = () => {
    if (river.isReadingStale) {
      return (
        <span className="riverspan flowspan" style={{ fontSize: "0.85em", fontStyle: "italic", opacity: 0.8 }}>
          {t("riverItem.stale")}
        </span>
      );
    }
    if (river.flowInfo || typeof river.flow === "string") {
      const flowText = river.flowInfo || (typeof river.flow === "string" ? river.flow : "");
      return (
        <span className="riverspan flowspan">
          {flowText}
          {getTrendArrow()}
        </span>
      );
    }
    if (river.dam) {
      return (
        <span className="riverspan flowspan">
          {t("riverItem.dam")}
          {getTrendArrow()}
        </span>
      );
    }
    return <span className="riverspan flowspan"></span>;
  };

  const getFavTitle = () => {
    if (quickActionPref && quickActionPref.startsWith("list:")) {
      return isActive ? t("riverItem.removeFromList") : t("riverItem.addToList");
    }
    if (myLists.length > 0) {
      return t("riverItem.saveRiverToLists");
    }
    return isActive ? t("riverItem.removeRiverFromLists") : t("riverItem.addRiverToLists");
  };


  return (
    <React.Fragment>
      <div
        id={`${baseId}1`}
        className={buttonClassNames}
        style={bgColor ? { backgroundColor: bgColor } : {}}
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              handleNavigate();
            }
          }
        }}
      >
        <span className="riverspan">{river.name}</span>
        <span className="riverspan">{river.section}</span>

        {/* Skill Span */}
        <span
          className="riverspan skillspan"
          style={{ borderBottom: "none" }}
        >
          {skillAbbr && skillAbbr !== "?" && (
            <div className="tooltip">
              {skillAbbr}
              <span className="tooltiptext">{translatedSkill}</span>
            </div>
          )}
        </span>

        {/* Class Span */}
        <span className="riverspan classspan">{(riverClass && riverClass !== "?") ? riverClass : ""}</span>


        {/* Flow Span */}
        {getFlowDisplay()}


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
          title={getFavTitle()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              handleActionClick(e);
            }
          }}
          style={{
            color: displayColor,
            fontWeight: "bold",
            fontSize: "1.3em"
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
      </div>

    </React.Fragment>
  );
};

