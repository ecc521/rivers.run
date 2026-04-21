import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RiverData } from "../types/River";
import { getSkillAbbreviation, getSkillFull } from "../utils/skillTranslations";
import { calculateColor } from "../utils/flowInfoCalculations";
import { slugify } from "../utils/url";


import { useLists } from "../context/ListsContext";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { ListSelectModal } from "./ListSelectModal";

interface RiverItemProps {
  river: RiverData;
  index: number;
  isDarkMode?: boolean;
  isColorBlindMode?: boolean;
  initiallyExpanded?: boolean; // legacy prop, preserved for safety

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
  const { quickActionPref } = useSettings();
  const { user, setAuthModalOpen } = useAuth();
  const { confirm } = useModal();
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

  const handleActionClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
        const shouldSignIn = await confirm("Please sign in to save favorites and sync them across your devices.", "Sign In Required");
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
                 "You are currently viewing a community list that you don't own. To add or remove rivers, please create a personal copy of this list on the Lists page. Would you like to go there now?",
                 "List Ownership"
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
         await toggleRiverInQuickList(river, "favorites");
      } else {
         setModalOpen(true);
      }
    } catch (e: any) {
      console.error("Failed to perform list action:", e);
      await confirm(e.message || "Failed to update your list. Please try again.", "Error Updating List");
    }
  };

  const handleCloseModal = () => setModalOpen(false);

  const handleNavigate = () => {
     let slug = slugify(river.name);
     if (river.section) slug += '-' + slugify(river.section);
     const prefix = river.isGauge ? '/gauge/' : '/river/';
     navigate(`${prefix}${river.id}/${slug}`);
  };

  const getFlowDisplay = () => {
    if (river.isReadingStale) {
      return (
        <span className="riverspan flowspan" style={{ fontSize: "0.85em", fontStyle: "italic", opacity: 0.8 }}>
          (stale)
        </span>
      );
    }
    if (river.flowInfo || typeof river.flow === "string") {
      return (
        <span className="riverspan flowspan">
          {river.flowInfo || (typeof river.flow === "string" ? river.flow : "")}
        </span>
      );
    }
    if (river.dam) {
      return <span className="riverspan flowspan">Dam</span>;
    }
    return <span className="riverspan flowspan"></span>;
  };

  const getFavTitle = () => {
    if (quickActionPref.startsWith("list:")) {
      return isActive ? "Remove from List" : "Add to List";
    }
    if (quickActionPref === "ask" && myLists.length > 0) {
      return "Save River to Lists";
    }
    return isActive ? "Remove River from Lists" : "Add River to Lists";
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
            {skillAbbr}
            <span className="tooltiptext">{translatedSkill}</span>
          </div>
        </span>

        {/* Class Span */}
        <span className="riverspan classspan">{(!riverClass || riverClass.trim().toLowerCase() === "unknown") ? "?" : riverClass}</span>


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
      </button>

    </React.Fragment>
  );
};

