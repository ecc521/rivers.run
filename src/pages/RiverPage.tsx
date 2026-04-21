import React, { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useRivers } from "../hooks/useRivers";
import { RiverExpansion } from "../components/RiverExpansion";
import { useSEO } from "../hooks/useSEO";
import { useDynamicFlow } from "../hooks/useDynamicFlow";
import { calculateColor, calculateRelativeFlow } from "../utils/flowInfoCalculations";
import { useSettings } from "../context/SettingsContext";


const RiverPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { rivers, loading, error, dataGeneratedAt } = useRivers();


  const river = rivers.find((r) => r.id === id);
  const { isDarkMode, isColorBlindMode } = useSettings();
  const [scrubbedReading, setScrubbedReading] = useState<any | null>(null);
  
  // NEVER call hooks conditionally! This caused the infinite HMR crash loop. 
  // We pass an empty object if river isn't loaded yet to preserve the exact hook call order safely.
  const dynamicRiver = useDynamicFlow(river || ({} as any), dataGeneratedAt);
  const displayRiver = river ? (dynamicRiver || river) : null;

  const pillRiver = useMemo(() => {
    if (!displayRiver) return null;
    if (!scrubbedReading) return displayRiver;
    
    // N.B.: We duplicate displayRiver here and recalculate its live readings 
    // based on the hovered graph point (scrubbedReading) so the pill and gradient dynamically update on scrub.
    const temp = { ...displayRiver };
    if (scrubbedReading.cfs !== undefined) temp.cfs = scrubbedReading.cfs;
    if (scrubbedReading.ft !== undefined) temp.ft = scrubbedReading.ft;
    if (scrubbedReading.m !== undefined) temp.m = scrubbedReading.m;
    if (scrubbedReading.cms !== undefined) temp.cms = scrubbedReading.cms;
    
    temp.running = calculateRelativeFlow(temp) ?? temp.running;
    temp.isReadingStale = false; // Hide stale badge when scrubbing historical data
    
    return temp;
  }, [displayRiver, scrubbedReading]);

  const getFlowValueWithUnit = (val?: number) => val != null ? `${val} ${pillRiver?.flow?.unit ?? ''}` : '?';

  useSEO({
    title: river ? `${river.name} - ${river.section}` : undefined,
    description: river 
      ? `Detailed flow info, running status, and description for ${river.name} (${river.section}) in ${river.states || 'the USA'}.` 
      : undefined
  });

  if (loading) {
    return (
      <div className="page-content center">
        <h2>Loading River Data...</h2>
      </div>
    );
  }

  if (error || !river) {
    return (
      <div className="page-content center">
        <h2>Error: Could not find river.</h2>
        <button onClick={() => navigate("/")} style={{ padding: "10px", marginTop: "20px" }}>
          Return Home
        </button>
      </div>
    );
  }

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate("/");
      }
  };

  return (
    <div className="page-content" style={{ maxWidth: "800px", margin: "0 auto", padding: "10px 20px" }}>
      <button 
        onClick={handleBack}
        style={{
           background: "none",
           border: "none",
           color: "var(--primary)",
           cursor: "pointer",
           fontWeight: "bold",
           fontSize: "1.05rem",
           padding: "0",
           marginBottom: "20px",
           display: "flex",
           alignItems: "center",
           gap: "5px"
        }}
      >
         &#8592; {window.history.state && window.history.state.idx > 0 ? "Back to Results" : "See All Rivers"}
      </button>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "clamp(40px, 10vw, 120px)", flexWrap: "wrap", marginBottom: "30px" }}>
        <div style={{ flex: "0 1 auto", minWidth: "200px", textAlign: "center" }}>
          <h1 style={{ margin: 0 }}>{river.name}</h1>
          <h2 style={{ marginTop: "5px", marginBottom: 0, color: "var(--text-muted)", fontWeight: "normal" }}>{river.section}</h2>
          <Link 
            to={`/edit/${river.id}`}
            style={{
              display: "inline-block",
              marginTop: "10px",
              fontSize: "0.85rem",
              color: "var(--primary)",
              textDecoration: "none",
              opacity: 0.8,
              fontWeight: "600",
              transition: "opacity 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = "1"}
            onMouseOut={(e) => e.currentTarget.style.opacity = "0.8"}
          >
            Edit This River
          </Link>
        </div>

        {pillRiver && pillRiver.running != null && (
            <div 
               className="tooltip tooltip-bottom"
               style={{ 
                flex: "0 1 auto", 
                display: "flex",
                flexDirection: "column",
                alignItems: "center", 
                justifyContent: "center",
                gap: "12px",
                cursor: "pointer",
                borderBottom: "none"
            }}>
                <div className="tooltiptext" style={{ textAlign: "left", lineHeight: "1.4", padding: "10px 15px", whiteSpace: "pre", fontWeight: "normal", zIndex: 10 }}>
                    {`Minimum: ${getFlowValueWithUnit(pillRiver.flow?.min)}\nLow: ${getFlowValueWithUnit(pillRiver.flow?.low)}\nRunnable: ${getFlowValueWithUnit(pillRiver.flow?.mid)}\nHigh: ${getFlowValueWithUnit(pillRiver.flow?.high)}\nMaximum: ${getFlowValueWithUnit(pillRiver.flow?.max)}`}
                </div>
                <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      backgroundColor: calculateColor(pillRiver.running, isDarkMode, isColorBlindMode),
                      color: isDarkMode ? "#fff" : "#000",
                      padding: "10px 24px",
                      borderRadius: "24px",
                      textShadow: "none",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                    }}
                >
                    {/* Last Readings Inside Pill */}
                    {(pillRiver.cfs !== undefined || pillRiver.ft !== undefined) && (
                        <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "4px" }}>
                           {pillRiver.cfs !== undefined && <div style={{ fontSize: "1.4rem", fontWeight: "900" }}>{Math.round(pillRiver.cfs)} <span style={{ fontSize: "0.85rem", fontWeight: "normal", opacity: 0.85 }}>cfs</span></div>}
                           {pillRiver.ft !== undefined && <div style={{ fontSize: "1.4rem", fontWeight: "900" }}>{Math.round(pillRiver.ft * 100) / 100} <span style={{ fontSize: "0.85rem", fontWeight: "normal", opacity: 0.85 }}>ft</span></div>}
                        </div>
                    )}

                    {/* Status Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "1rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {pillRiver.isReadingStale && <span>⚠️</span>}
                        {(() => {
                           if (pillRiver.running === 0) return "Too Low";
                           if (pillRiver.running < 1) return "Low";
                           if (pillRiver.running < 3) return "Runnable";
                           if (pillRiver.running < 4) return "High";
                           return "Too High";
                        })()}
                    </div>
                    {pillRiver.isReadingStale && <div style={{ fontSize: "0.75rem", color: "var(--warning-text)", fontWeight: "800", letterSpacing: "0.5px" }}>STALE DATA</div>}
                </div>
                
                {/* Min/Max Bar below */}
                <div style={{ display: "flex", alignItems: "center", gap: "15px", fontSize: "0.85rem", width: "100%", maxWidth: "200px", marginTop: "15px", marginBottom: "15px" }}>
                   <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: "var(--text-muted)", lineHeight: 1.2 }}>
                      <span style={{ fontSize: "0.6rem", textTransform: "uppercase" }}>Min</span>
                      <strong style={{ color: "var(--text)" }}>{pillRiver.flow?.min ?? '?'}</strong>
                   </div>
                   
                   <div style={{ 
                       flex: 1, 
                       height: "8px", 
                       borderRadius: "4px",
                       backgroundImage: `linear-gradient(to right, ${[0, 1, 2, 3, 4].map((i) => calculateColor(i, isDarkMode, isColorBlindMode)).join(",")})`,
                       position: "relative"
                   }}>
                      {/* Threshold Tick Marks & Labels */}
                      {/* 25% - Low (Top) */}
                      <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "1px", backgroundColor: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)", zIndex: 1 }} />
                      <div style={{ position: "absolute", left: "25%", bottom: "100%", transform: "translateX(-50%)", paddingBottom: "5px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                         <strong style={{ fontSize: "0.75rem", color: "var(--text)" }}>{pillRiver.flow?.low ?? '?'}</strong>
                      </div>

                      {/* 50% - Mid (Bottom) */}
                      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", backgroundColor: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)", zIndex: 1 }} />
                      <div style={{ position: "absolute", left: "50%", top: "100%", transform: "translateX(-50%)", paddingTop: "5px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                         <strong style={{ fontSize: "0.75rem", color: "var(--text)" }}>{pillRiver.flow?.mid ?? '?'}</strong>
                      </div>

                      {/* 75% - High (Top) */}
                      <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: "1px", backgroundColor: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)", zIndex: 1 }} />
                      <div style={{ position: "absolute", left: "75%", bottom: "100%", transform: "translateX(-50%)", paddingBottom: "5px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                         <strong style={{ fontSize: "0.75rem", color: "var(--text)" }}>{pillRiver.flow?.high ?? '?'}</strong>
                      </div>

                      <div style={{
                          position: "absolute",
                          top: "50%",
                          left: `${Math.max(0, Math.min(100, (pillRiver.running / 4) * 100))}%`,
                          transform: "translate(-50%, -50%)",
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          backgroundColor: isDarkMode ? "#fff" : "#000",
                          border: "2px solid",
                          borderColor: isDarkMode ? "#000" : "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          zIndex: 2
                      }} />
                   </div>
                   
                   <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", color: "var(--text-muted)", lineHeight: 1.2 }}>
                      <span style={{ fontSize: "0.6rem", textTransform: "uppercase" }}>Max</span>
                      <strong style={{ color: "var(--text)" }}>{pillRiver.flow?.max ?? '?'}</strong>
                   </div>
                </div>
            </div>
        )}
      </div>

      {/* Wrapping the expansion in a styled container for professional typography padding */}
      <div style={{
          backgroundColor: "var(--surface)",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          fontSize: "1.1rem",
          lineHeight: "1.6"
      }}>
         <RiverExpansion river={displayRiver || river} dataGeneratedAt={dataGeneratedAt} onScrub={setScrubbedReading} />
      </div>
    </div>
  );
};

export default RiverPage;
