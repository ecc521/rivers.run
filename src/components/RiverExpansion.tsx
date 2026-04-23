import React, { useState, useEffect } from "react";
import type { RiverData } from "../types/River";
import { USGSGraphs } from "./USGSGraphs";
import { useDynamicFlow } from "../hooks/useDynamicFlow";
import DOMPurify from "dompurify";
import { SharedMap } from "./SharedMap";

interface RiverExpansionProps {
  river: RiverData;
  isMapOverlay?: boolean;
  onShowAccessPoints?: () => void;
  dataGeneratedAt?: number | null;
  onScrub?: (reading: any | null) => void;
  clickedPoint?: [number, number];
}

export const RiverExpansion: React.FC<RiverExpansionProps> = ({ river, isMapOverlay, dataGeneratedAt, onScrub, clickedPoint }) => {
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
     // We intentionally default to false and defer the map initialization by ~50ms. 
     // Leaflet calculates synchronous bounding box sizes during DOM insertion, 
     // which blocks the main thread thread and makes navigation feel "janky".
     // This allows the River UI overlay to paint instantly first.
     const timer = setTimeout(() => setShowMap(true), 50);
     return () => clearTimeout(timer);
  }, []);

  // The hook directly yields a fully cloned, flow-hydrated RiverData precisely compiled
  const displayRiver = useDynamicFlow(river, dataGeneratedAt) || river;

  return (
    <div className="riverWriteup" style={{ padding: "6px" }}>

      <div className="textInfo">
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(river.writeup || "") }} />
        <br />

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
                        initialCenter={clickedPoint || [displayRiver.accessPoints[0].lat, displayRiver.accessPoints[0].lon]}
                        initialZoom={12}
                        height="350px"
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




      <USGSGraphs river={displayRiver} dataGeneratedAt={dataGeneratedAt} onScrub={onScrub} />
    </div>
  );
};
