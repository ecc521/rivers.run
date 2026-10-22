import React, { useState, useEffect } from "react";
import type { RiverData } from "../types/River";
import { USGSGraphs } from "./USGSGraphs";
import { useDynamicFlow } from "../hooks/useDynamicFlow";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { SharedMap } from "./SharedMap";

interface RiverExpansionProps {
  river: RiverData;
  isMapOverlay?: boolean;
  onShowAccessPoints?: () => void;
  dataGeneratedAt?: number | null;
  onScrub?: (reading: any | null) => void;
  clickedPoint?: [number, number];
  skipHydration?: boolean;
}

export const RiverExpansion: React.FC<RiverExpansionProps> = ({ river, isMapOverlay, dataGeneratedAt, onScrub, clickedPoint, skipHydration }) => {
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
     // Defer map initialization so the river content can paint first.
     // The wrapper reserves the map's height throughout this delay.
     const timer = setTimeout(() => setShowMap(true), 50);
     return () => clearTimeout(timer);
  }, []);

  // The hook directly yields a fully cloned, flow-hydrated RiverData precisely compiled
  const displayRiver = useDynamicFlow(river, dataGeneratedAt, skipHydration) || river;

  return (
    <div className="riverWriteup" style={{ padding: "6px" }}>

      <div className="textInfo">
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(river.writeup || "") }} />
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
               <div style={{ height: "350px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", marginBottom: "15px" }}>
                 {showMap ? (
                     <SharedMap
                        focusRiver={displayRiver}
                        initialCenter={clickedPoint || [displayRiver.accessPoints[0].lat, displayRiver.accessPoints[0].lon]}
                        initialZoom={12}
                        height="350px"
                        hideSearchBar
                        skipLocationRequest={true}
                     />
                 ) : (
                     <div
                       role="status"
                       style={{
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         width: '100%',
                         height: '100%',
                         backgroundColor: 'var(--map-loading-bg)',
                         color: 'var(--text-muted)'
                       }}
                     >
                       Loading map…
                     </div>
                 )}
               </div>
            )}
          </div>
        )}
      </div>




      <USGSGraphs river={displayRiver} dataGeneratedAt={dataGeneratedAt} onScrub={onScrub} />
    </div>
  );
};
