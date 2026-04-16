import React, { useState, useEffect } from "react";
import type { RiverData } from "../types/River";
import { getSkillFull } from "../utils/skillTranslations";
import { USGSGraphs } from "./USGSGraphs";
import { useDynamicFlow } from "../hooks/useDynamicFlow";
import { useAuth } from "../context/AuthContext";
import DOMPurify from "dompurify";
import { SharedMap } from "./SharedMap";
import { useModal } from "../context/ModalContext";
import { fetchAPI } from "../services/api";

interface RiverExpansionProps {
  river: RiverData;
  isMapOverlay?: boolean;
  onShowAccessPoints?: () => void;
  dataGeneratedAt?: number | null;
}

export const RiverExpansion: React.FC<RiverExpansionProps> = ({ river, isMapOverlay, dataGeneratedAt }) => {
  const [showMap, setShowMap] = useState(false);
  const { user, isAdmin } = useAuth();
  const { prompt, alert } = useModal();
  
  const handleReport = async (e: React.MouseEvent) => {
    e.preventDefault();
    const reason = await prompt(`Please explain the problem with the data for ${river.name}:`, "Report Content");
    if (!reason || !reason.trim()) return;

    try {
      await fetchAPI("/reports", {
        method: "POST",
        body: JSON.stringify({
          target_id: river.id,
          type: "river",
          reason: reason.trim(),
          email: user?.email || ""
        })
      });
      await alert("Report submitted successfully. Our moderators will review it shortly.", "Report Sent");
    } catch (e: any) {
      await alert("Failed to submit report: " + e.message);
    }
  };

  useEffect(() => {
     // We intentionally default to false and defer the map initialization by ~50ms. 
     // Leaflet calculates synchronous bounding box sizes during DOM insertion, 
     // which blocks the main thread thread and makes navigation feel "janky".
     // This allows the River UI overlay to paint instantly first.
     const timer = setTimeout(() => setShowMap(true), 50);
     return () => clearTimeout(timer);
  }, []);

  // The hook directly yields a fully cloned, flow-hydrated RiverData precisely compiled
  const displayRiver = useDynamicFlow(river) || river;

  const getSkillAndClassText = () => {
    const skillFull = getSkillFull(river.skill);
    const hasSkill = river.skill && skillFull !== "Skill Unknown";

    if (river.class && hasSkill) {
      return `This river is class ${river.class} and is rated ${skillFull}.`;
    } else if (river.class) {
      return `This river is rated class ${river.class}.`;
    } else if (hasSkill) {
      return `This river is rated ${skillFull}.`;
    }
    return null;
  };



  return (
    <div className="riverWriteup" style={{ padding: "6px" }}>

      <div className="textInfo">
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(river.writeup || "") }} />
        <br />
        <p>{getSkillAndClassText()}</p>

        {river.averagegradient && (
          <p>Average gradient: {river.averagegradient} feet per mile.</p>
        )}
        {river.maxgradient && (
          <p>Maximum gradient: {river.maxgradient} feet per mile.</p>
        )}

        {displayRiver.accessPoints && displayRiver.accessPoints.length > 0 && (
          <div className="accessPoints" style={{ marginTop: "15px" }}>
            {isMapOverlay ? (
               <h4 style={{ margin: "0 0 15px 0", color: "var(--text-muted)", fontWeight: "normal" }}>
                 {displayRiver.accessPoints.length} Access {displayRiver.accessPoints.length === 1 ? 'Point' : 'Points'} displayed on map
               </h4>
            ) : (
               <>
                 {showMap ? (
                   <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", marginBottom: "15px" }}>
                     <SharedMap 
                        focusRiver={displayRiver}
                        initialCenter={[displayRiver.accessPoints[0].lat, displayRiver.accessPoints[0].lon]}
                        initialZoom={12}
                        height="250px"
                     />
                   </div>
                 ) : (
                     <button
                       onClick={() => setShowMap(true)}
                       style={{
                         display: 'block',
                         width: '100%',
                         padding: '12px',
                         backgroundColor: 'var(--surface-hover)',
                         border: '1px solid var(--border)',
                         borderRadius: '8px',
                         color: 'var(--primary)',
                         fontWeight: 600,
                         marginBottom: '15px',
                         cursor: 'pointer'
                       }}
                     >
                       Load Mini Map ({displayRiver.accessPoints.length} Access {displayRiver.accessPoints.length === 1 ? 'Point' : 'Points'})
                     </button>
                 )}
               </>
            )}
          </div>
        )}
      </div>


      <div style={{ margin: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
            {isAdmin ? (
            <a
                href={`/edit/${river.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 'bold', color: "var(--danger)", marginRight: '10px' }}
            >
                [Admin] Edit River Data
            </a>
            ) : (
            <a
                href={`/suggest/${river.id}`}
                style={{ fontWeight: 'bold' }}
            >
                Suggest an Edit
            </a>
            )}
        </div>
        <button
            type="button"
            onClick={handleReport}
            style={{
                padding: "4px 8px",
                backgroundColor: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline"
            }}
        >
            🚩 Report a Problem
        </button>
      </div>

      <USGSGraphs river={displayRiver} dataGeneratedAt={dataGeneratedAt} />
    </div>
  );
};
