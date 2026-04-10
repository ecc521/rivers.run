import React from "react";
import type { RiverData } from "../types/River";
import { skillTranslations } from "../utils/skillTranslations";
import { USGSGraphs } from "./USGSGraphs";
import { useDynamicUSGS } from "../hooks/useDynamicUSGS";
import { useAuth } from "../context/AuthContext";
import DOMPurify from "dompurify";

interface RiverExpansionProps {
  river: RiverData;
}

export const RiverExpansion: React.FC<RiverExpansionProps> = ({ river }) => {
  const { isAdmin } = useAuth();
  
  // The hook directly yields a fully cloned, flow-hydrated RiverData precisely compiled
  const displayRiver = useDynamicUSGS(river) || river;

  const getSkillAndClassText = () => {
    if (river.class && river.skill) {
      return `This river is class ${river.class} and is rated ${skillTranslations[river.skill] || "Unknown"}.`;
    } else if (river.class) {
      return `This river is rated class ${river.class}.`;
    } else if (river.skill) {
      return `This river is rated ${skillTranslations[river.skill] || "Unknown"}.`;
    }
    return null;
  };

  const getFlowRangeText = () => {
    const keys = ["min", "low", "mid", "high", "max"] as const;
    const labels = ["minrun", "lowflow", "midflow", "highflow", "maxrun"];
    const relativeFlowType = river.flow?.unit || "cfs";
    const range: string[] = [];

    keys.forEach((key, index) => {
      const val = river.flow?.[key];
      if (val !== undefined && !isNaN(val)) {
        const rounded =
          relativeFlowType === "cfs"
            ? Math.round(val)
            : Math.round(val * 100) / 100;
        range.push(`${labels[index]}:${rounded}${relativeFlowType}`);
      }
    });

    return range.length > 0 ? range.join(" ") : null;
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

        {river.accessPoints && river.accessPoints.length > 0 && (
          <div className="accessPoints">
            {river.accessPoints.map((accessPoint, index) => (
              <p key={index}>
                {accessPoint.name} GPS Coordinates:{" "}
                <a
                  href={`https://www.google.com/maps/dir//${accessPoint.lat},${accessPoint.lon}/@${accessPoint.lat},${accessPoint.lon},14z`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {accessPoint.lat}, {accessPoint.lon}
                </a>
              </p>
            ))}
          </div>
        )}
      </div>

      {river.accessPoints && river.accessPoints.length > 0 && (
        <a
          className="mapButton"
          style={{ display: 'inline-block', backgroundColor: "var(--border)", padding: '8px 16px', borderRadius: '6px', color: "var(--text-secondary)", textDecoration: 'none', margin: '8px 0', fontSize: '0.9em' }}
          href={`/map?lat=${river.accessPoints[0].lat}&lon=${river.accessPoints[0].lon}`}
        >
          View Area on Map
        </a>
      )}

      {getFlowRangeText() && <p>{getFlowRangeText()}</p>}

      <p style={{ margin: "10px 0" }}>
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
      </p>

      <USGSGraphs river={displayRiver} />
    </div>
  );
};
