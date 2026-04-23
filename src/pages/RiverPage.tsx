import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useRivers } from "../hooks/useRivers";
import { RiverExpansion } from "../components/RiverExpansion";
import { useSEO } from "../hooks/useSEO";
import { useDynamicFlow } from "../hooks/useDynamicFlow";
import { calculateColor, calculateRelativeFlow } from "../utils/flowInfoCalculations";
import { useSettings } from "../context/SettingsContext";
import { useModal } from "../context/ModalContext";
import { useAuth } from "../context/AuthContext";
import { getRiverShareUrl } from "../utils/url";
import { fetchAPI } from "../services/api";
import { Capacitor } from "@capacitor/core";
import { calculateParsedThresholds } from "../utils/flowInfoCalculations";
import { lambert } from "../utils/distance";
import { getCountryName, getRiverCountries } from "../utils/regions";
import { getSkillFull } from "../utils/skillTranslations";
import type { RiverData } from "../types/River";



const RiverPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { rivers, loading, error, dataGeneratedAt } = useRivers();

  // Reset scroll position to top when navigating to a different river
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);


  const river = rivers.find((r) => r.id === id);
  const { isDarkMode, isColorBlindMode } = useSettings();
  const { alert, prompt } = useModal();
  const { user } = useAuth();
  const [scrubbedReading, setScrubbedReading] = useState<any | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleReport = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!river) return;
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


  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!river) return;
    const url = getRiverShareUrl(river);
    
    if (Capacitor.isNativePlatform() && navigator.share) {
      try {
        await navigator.share({
          title: `${river.name} - ${river.section}`,
          url: url
        });
      } catch (err) {
        // user cancelled or share failed - logging for diagnostic purposes
        console.warn("Share failed or was cancelled", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Clipboard copy failed", err);
        await alert("Failed to copy link. Please manually copy the URL.", "Error");
      }
    }
  };


  
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

  const parsedThresholds = useMemo(() => {
    if (!pillRiver || !pillRiver.flow) return [undefined, undefined, undefined, undefined, undefined];
    return calculateParsedThresholds([
      pillRiver.flow.min,
      pillRiver.flow.low,
      pillRiver.flow.mid,
      pillRiver.flow.high,
      pillRiver.flow.max
    ]);
  }, [pillRiver]);

  const formatInterpolated = (val: number) => {
    return val >= 100 ? Math.round(val) : Math.round(val * 10) / 10;
  };

  const renderTooltipRow = (label: string, rawVal: any, interpolatedVal: number | undefined) => {
    const hasRaw = rawVal != null && (rawVal as any) !== "";
    if (hasRaw) {
      return <div>{label}: {rawVal} {pillRiver?.flow?.unit ?? ''}</div>;
    }
    if (interpolatedVal == null) {
      return <div>{label}: ?</div>;
    }
    return (
      <div>
        {label}: <em style={{ fontStyle: "italic", fontWeight: "normal" }}>({formatInterpolated(interpolatedVal)} {pillRiver?.flow?.unit ?? ''})</em>
      </div>
    );
  };

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
      navigate(`/${routeLocation.search}`);
  };

  return (
    <div className="page-content river-page-container">
      <div className="river-page-card">
        <div style={{ 
            position: "relative",
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            gap: "clamp(40px, 10vw, 120px)", 
            flexWrap: "wrap", 
            width: "100%",
            boxSizing: "border-box",
            padding: "50px 20px 20px 20px",
            borderBottom: "1px solid var(--border)"
        }}>
         {/* Absolute-positioned Back Button & Breadcrumbs */}
         <div style={{
              position: "absolute",
              top: "16px",
              left: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
         }}>
          <nav aria-label="Breadcrumb" style={{ 
              fontSize: "0.85rem", 
              color: "var(--text-muted)", 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              flexWrap: "wrap"
          }}>
            <span 
                onClick={handleBack}
                style={{ 
                    color: "var(--primary)", 
                    cursor: "pointer", 
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 4px",
                    borderRadius: "4px",
                    transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--surface-hover)"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
                &#8592; Results
            </span>
            {(() => {
              const countries = Array.from(getRiverCountries(river)).filter(c => c !== "global");
              if (countries.length === 0) return null;
              const firstCountry = countries[0];
              return (
                <>
                  <span style={{ opacity: 0.5 }}>/</span>
                  <Link 
                    to={`/?country=${firstCountry}${routeLocation.search ? '&' + routeLocation.search.substring(1) : ''}`} 
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {getCountryName(firstCountry, true)}
                  </Link>
                </>
              );
            })()}
            {river.states && (
              <>
                <span style={{ opacity: 0.5 }}>/</span>
                <Link 
                  to={`/?state=${river.states.split(',')[0].trim()}${routeLocation.search ? '&' + routeLocation.search.substring(1) : ''}`} 
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {river.states.split(',')[0].trim().toUpperCase()}
                </Link>
              </>
            )}
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ fontWeight: "600", color: "var(--text)" }}>{river.name}</span>
          </nav>
         </div>

        <div style={{ flex: "0 1 auto", minWidth: "200px", textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 5vw, 2.5rem)", letterSpacing: "-0.02em" }}>{river.name}</h1>
          <h2 style={{ marginTop: "4px", marginBottom: "12px", color: "var(--text-muted)", fontWeight: "500", fontSize: "1.2rem" }}>{river.section}</h2>
          
          {/* Class & Skill Level Metadata */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            gap: "10px", 
            marginBottom: "20px",
            flexWrap: "wrap"
          }}>
            {river.class && river.class !== "?" && (
              <span style={{ 
                backgroundColor: "var(--surface-hover)", 
                padding: "4px 12px", 
                borderRadius: "20px", 
                fontSize: "0.9rem", 
                fontWeight: "700",
                border: "1px solid var(--border)",
                color: "var(--primary)"
              }}>
                Class {river.class}
              </span>
            )}
            {(() => {
              const skillFull = getSkillFull(river.skill);
              if (!skillFull || skillFull === "Skill Unknown") return null;
              return (
                <span style={{ 
                  backgroundColor: "var(--surface-hover)", 
                  padding: "4px 12px", 
                  borderRadius: "20px", 
                  fontSize: "0.9rem", 
                  fontWeight: "600",
                  border: "1px solid var(--border)",
                  color: "var(--primary)"
                }}>
                  {skillFull}
                </span>
              );
            })()}
          </div>

          {/* Action Row */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            gap: "12px", 
            flexWrap: "wrap",
            opacity: 0.9
          }}>
            <Link 
              to={`/edit/${river.id}`}
              style={{
                display: "inline-block",
                fontSize: "0.85rem",
                color: "var(--primary)",
                textDecoration: "none",
                fontWeight: "600",
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                e.currentTarget.style.borderColor = "var(--primary)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              Edit River
            </Link>

            <button 
              onClick={handleShare}
              style={{
                display: "inline-block",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "0.85rem",
                color: "var(--primary)",
                cursor: "pointer",
                fontWeight: "600",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                e.currentTarget.style.borderColor = "var(--primary)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              {isCopied ? "Link Copied!" : "Share"}
            </button>

            {river.aw && (
              <a 
                href={`https://www.americanwhitewater.org/content/River/view/river-detail/${river.aw}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  fontSize: "0.85rem",
                  color: "var(--primary)",
                  textDecoration: "none",
                  fontWeight: "600",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                View on AW
              </a>
            )}

            <button 
              onClick={handleReport}
              style={{
                display: "inline-block",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "0.85rem",
                color: "var(--primary)",
                cursor: "pointer",
                fontWeight: "600",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                e.currentTarget.style.borderColor = "var(--primary)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              Report Problem
            </button>
          </div>
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
                <div className="tooltiptext" style={{ textAlign: "left", lineHeight: "1.4", padding: "10px 15px", whiteSpace: "nowrap", fontWeight: "normal", zIndex: 10 }}>
                    {renderTooltipRow("Minimum", pillRiver.flow?.min, parsedThresholds[0])}
                    {renderTooltipRow("Low", pillRiver.flow?.low, parsedThresholds[1])}
                    {renderTooltipRow("Runnable", pillRiver.flow?.mid, parsedThresholds[2])}
                    {renderTooltipRow("High", pillRiver.flow?.high, parsedThresholds[3])}
                    {renderTooltipRow("Maximum", pillRiver.flow?.max, parsedThresholds[4])}
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
                      {(() => {
                        const raw = pillRiver.flow?.min;
                        if (raw != null && (raw as any) !== "") return <strong style={{ color: "var(--text)" }}>{raw}</strong>;
                        const interpolated = parsedThresholds[0];
                        if (interpolated == null) return <strong style={{ opacity: 0 }}>?</strong>;
                        return <strong style={{ color: "var(--text)", fontWeight: "normal", fontStyle: "italic" }}>({formatInterpolated(interpolated)})</strong>;
                      })()}
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
                        {(() => {
                          const raw = pillRiver.flow?.low;
                          if (raw != null && (raw as any) !== "") return <strong style={{ fontSize: "0.75rem", color: "var(--text)" }}>{raw}</strong>;
                          const interpolated = parsedThresholds[1];
                          if (interpolated == null) return <strong style={{ fontSize: "0.75rem", opacity: 0 }}>?</strong>;
                          return <strong style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: "normal", fontStyle: "italic" }}>({formatInterpolated(interpolated)})</strong>;
                        })()}
                      </div>

                      {/* 50% - Mid (Bottom) */}
                      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", backgroundColor: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)", zIndex: 1 }} />
                      <div style={{ position: "absolute", left: "50%", top: "100%", transform: "translateX(-50%)", paddingTop: "5px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                        {(() => {
                          const raw = pillRiver.flow?.mid;
                          if (raw != null && (raw as any) !== "") return <strong style={{ fontSize: "0.75rem", color: "var(--text)" }}>{raw}</strong>;
                          const interpolated = parsedThresholds[2];
                          if (interpolated == null) return <strong style={{ fontSize: "0.75rem", opacity: 0 }}>?</strong>;
                          return <strong style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: "normal", fontStyle: "italic" }}>({formatInterpolated(interpolated)})</strong>;
                        })()}
                      </div>

                      {/* 75% - High (Top) */}
                      <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: "1px", backgroundColor: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)", zIndex: 1 }} />
                      <div style={{ position: "absolute", left: "75%", bottom: "100%", transform: "translateX(-50%)", paddingBottom: "5px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                        {(() => {
                          const raw = pillRiver.flow?.high;
                          if (raw != null && (raw as any) !== "") return <strong style={{ fontSize: "0.75rem", color: "var(--text)" }}>{raw}</strong>;
                          const interpolated = parsedThresholds[3];
                          if (interpolated == null) return <strong style={{ fontSize: "0.75rem", opacity: 0 }}>?</strong>;
                          return <strong style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: "normal", fontStyle: "italic" }}>({formatInterpolated(interpolated)})</strong>;
                        })()}
                      </div>

                      <div style={{
                          position: "absolute",
                          top: "50%",
                          left: `${Math.max(0, Math.min(100, ((pillRiver.running ?? 0) / 4) * 100))}%`,
                          transform: "translate(-50%, -50%)",
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          backgroundColor: isDarkMode ? "#fff" : "#000",
                          border: "2px solid",
                          borderColor: isDarkMode ? "#000" : "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          zIndex: 2,
                          display: pillRiver.running == null ? 'none' : 'block'
                      }} />
                   </div>
                   
                   <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", color: "var(--text-muted)", lineHeight: 1.2 }}>
                      <span style={{ fontSize: "0.6rem", textTransform: "uppercase" }}>Max</span>
                      {(() => {
                        const raw = pillRiver.flow?.max;
                        if (raw != null && (raw as any) !== "") return <strong style={{ color: "var(--text)" }}>{raw}</strong>;
                        const interpolated = parsedThresholds[4];
                        if (interpolated == null) return <strong style={{ opacity: 0 }}>?</strong>;
                        return <strong style={{ color: "var(--text)", fontWeight: "normal", fontStyle: "italic" }}>({formatInterpolated(interpolated)})</strong>;
                      })()}
                   </div>
                </div>
            </div>
        )}
        </div>
      {/* Container for professional typography padding below header */}
      <div style={{
          padding: "20px",
          fontSize: "1.1rem",
          lineHeight: "1.6"
      }}>
          <RiverExpansion 
             river={displayRiver || river} 
             dataGeneratedAt={dataGeneratedAt} 
             onScrub={setScrubbedReading} 
             clickedPoint={
                routeLocation.state && (routeLocation.state as any).clickedLat 
                   ? [(routeLocation.state as any).clickedLat, (routeLocation.state as any).clickedLon]
                   : undefined
             }
          />
 
          {/* Internal Linking: Nearby Rivers */}
          {(() => {
            const currentSkill = (() => {
              const s = river.skill || "";
              if (typeof s === "number") return s;
              const map: Record<string, number> = { FW: 1, B: 2, N: 3, LI: 4, I: 5, HI: 6, A: 7, E: 8 };
              return map[s.toUpperCase()] || 0;
            })();

            const currentLat = river.accessPoints?.[0]?.lat;
            const currentLon = river.accessPoints?.[0]?.lon;

            const allNearby = rivers
              .filter(r => {
                if (r.id === river.id) return false;
                
                // Skill filter: +1 / -2
                const s = r.skill || "";
                const rSkill = typeof s === "number" ? s : ({ FW: 1, B: 2, N: 3, LI: 4, I: 5, HI: 6, A: 7, E: 8 } as any)[s.toUpperCase()] || 0;
                if (currentSkill > 0 && rSkill > 0) {
                    if (rSkill < currentSkill - 2 || rSkill > currentSkill + 1) return false;
                }
                (r as any)._rSkill = rSkill;

                // Distance filter: < 200 miles
                if (currentLat && currentLon && r.accessPoints?.[0]) {
                    const d = lambert(currentLat, currentLon, r.accessPoints[0].lat, r.accessPoints[0].lon);
                    (r as any)._dist = d;
                    if (d > 200) return false;
                } else {
                    return false;
                }

                return true;
              })
              .map(r => {
                const skillDiff = Math.abs((r as any)._rSkill - currentSkill);
                const skillScore = 1 - (skillDiff / 3);
                const distScore = 1 - ((r as any)._dist / 200);
                const flowScore = (r.running || 0) > 0 ? 1 : 0;
                (r as any)._score = (skillScore * 0.4) + (distScore * 0.4) + (flowScore * 0.2);
                return r;
              })
              .sort((a, b) => (b as any)._score - (a as any)._score);

            const harder = allNearby.find(r => (r as any)._rSkill > currentSkill);
            const easier = allNearby.find(r => (r as any)._rSkill < currentSkill);
            
            const selectedIds = new Set<string>();
            const finalNearby: RiverData[] = [];

            if (harder) {
                finalNearby.push(harder);
                selectedIds.add(harder.id);
            }
            if (easier) {
                finalNearby.push(easier);
                selectedIds.add(easier.id);
            }

            // Fill remaining slots
            for (const r of allNearby) {
                if (finalNearby.length >= 6) break;
                if (!selectedIds.has(r.id)) {
                    finalNearby.push(r);
                    selectedIds.add(r.id);
                }
            }

            finalNearby.sort((a, b) => (b as any)._score - (a as any)._score);
            const nearby = finalNearby;

            if (nearby.length === 0) return null;

            return (
              <div style={{ marginTop: "60px", paddingTop: "40px", borderTop: "1px solid var(--border)" }}>
                <h3 style={{ marginBottom: "20px" }}>Other nearby rivers</h3>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
                  gap: "15px" 
                }}>
                  {nearby.map(other => (
                    <Link 
                      key={other.id} 
                      to={`/river/${other.id}${routeLocation.search}`}
                      style={{ 
                        display: "flex",
                        flexDirection: "column",
                        padding: "15px", 
                        borderRadius: "12px", 
                        backgroundColor: "var(--surface-hover)", 
                        textDecoration: "none",
                        color: "inherit",
                        border: "1px solid var(--border)",
                        transition: "transform 0.2s, border-color 0.2s",
                        position: "relative"
                      }}
                      onMouseOver={(e) => {
                          e.currentTarget.style.transform = "translateY(-3px)";
                          e.currentTarget.style.borderColor = "var(--primary)";
                      }}
                      onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.borderColor = "var(--border)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.95rem", lineHeight: "1.2" }}>{other.name}</div>
                        {other.running != null && (
                            <div 
                                style={{ 
                                    width: "10px", 
                                    height: "10px", 
                                    borderRadius: "50%", 
                                    backgroundColor: calculateColor(other.running, isDarkMode, isColorBlindMode),
                                    boxShadow: "0 0 4px rgba(0,0,0,0.2)",
                                    flexShrink: 0,
                                    marginTop: "4px"
                                }} 
                                title={`Status: ${other.running}`}
                            />
                        )}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80px" }}>{other.section}</span>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                           {other.class && other.class !== "?" && (
                               <span style={{ fontSize: "0.7rem", opacity: 0.8, backgroundColor: "var(--surface)", padding: "1px 4px", borderRadius: "4px", border: "1px solid var(--border)" }}>{other.class}</span>
                           )}
                           <span style={{ fontWeight: "600", color: "var(--primary)" }}>{Math.round((other as any)._dist)} mi</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
       </div>
      </div>
     </div>
   );
 };

export default RiverPage;
