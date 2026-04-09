import React from "react";
import type { RiverData } from "../types/River";
import { skillTranslations } from "../utils/skillTranslations";
import { USGSGraphs } from "./USGSGraphs";
import { useAuth } from "../context/AuthContext";

interface RiverExpansionProps {
  river: RiverData;
}

export const RiverExpansion: React.FC<RiverExpansionProps> = ({ river }) => {
  const { isAdmin } = useAuth();

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
    const values = [
      "minrun",
      "lowflow",
      "midflow",
      "highflow",
      "maxrun",
    ] as const;
    const relativeFlowType = river.relativeflowtype || "";
    const range: string[] = [];

    values.forEach((name) => {
      // @ts-expect-error accessing dynamic keys
      const val = parseFloat(river[name]);
      if (!isNaN(val)) {
        const rounded =
          relativeFlowType === "cfs"
            ? Math.round(val)
            : Math.round(val * 100) / 100;
        range.push(`${name}:${rounded}${relativeFlowType}`);
      }
    });

    return range.length > 0 ? range.join(" ") : null;
  };

  return (
    <div className="riverWriteup" style={{ padding: "6px" }}>
      {/* 
        TODO: FavoritesWidget
        <FavoritesWidget river={river} gauge={river.gauge} />
      */}

      <div className="textInfo">
        <div dangerouslySetInnerHTML={{ __html: river.writeup }} />
        <br />
        <p>{getSkillAndClassText()}</p>

        {river.averagegradient && (
          <p>Average gradient: {river.averagegradient} feet per mile.</p>
        )}
        {river.maxgradient && (
          <p>Maximum gradient: {river.maxgradient} feet per mile.</p>
        )}

        {river.access && river.access.length > 0 && (
          <div className="accessPoints">
            {river.access.map((accessPoint, index) => (
              <p key={index}>
                {/* @ts-expect-error dynamic fields */}
                {accessPoint.name} ({accessPoint.label}) GPS Coordinates:{" "}
                <a
                  href={`https://www.google.com/maps/dir//${accessPoint.lat || accessPoint.latitude},${accessPoint.lon || accessPoint.longitude || accessPoint.lng}/@${accessPoint.lat || accessPoint.latitude},${accessPoint.lon || accessPoint.longitude || accessPoint.lng},14z`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {accessPoint.lat || accessPoint.latitude},{" "}
                  {accessPoint.lon || accessPoint.longitude || accessPoint.lng}
                </a>
              </p>
            ))}
          </div>
        )}
      </div>

      {river.access && river.access.length > 0 && (
        <a
          className="mapButton"
          style={{ display: 'inline-block', backgroundColor: '#e2e8f0', padding: '8px 16px', borderRadius: '6px', color: '#475569', textDecoration: 'none', margin: '8px 0', fontSize: '0.9em' }}
          href={`/map?lat=${river.access[0].lat || river.access[0].latitude}&lon=${river.access[0].lon || river.access[0].longitude || river.access[0].lng}`}
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
            style={{ fontWeight: 'bold', color: '#B33', marginRight: '10px' }}
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

      <USGSGraphs river={river} />
    </div>
  );
};
