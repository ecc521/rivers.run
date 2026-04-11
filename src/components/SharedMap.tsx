import React, { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiverData } from "../types/River";
import { calculateColor } from "../utils/flowInfoCalculations";
import { useSettings } from "../context/SettingsContext";
import { useRivers } from "../hooks/useRivers";
import { useLocation } from "../hooks/useLocation";
import { WeatherRadarLayer } from "./WeatherRadarLayer";
import { RiverExpansion } from "./RiverExpansion";
// Helper component to bind map events like programmatic auto-zoom when fullscreen toggles
const MapController = ({ isFullScreen }: { isFullScreen: boolean }) => {
    const map = useMap();
    useEffect(() => {
        // Invalidate map size so Leaflet recalculates dimensions when fullscreen toggles
        setTimeout(() => map.invalidateSize(), 300);
    }, [isFullScreen, map]);
    return null;
};

interface SharedMapProps {
    initialCenter?: [number, number];
    initialZoom?: number;
    focusRiver?: RiverData;
    height?: string; // Standard CSS dimension
}

export const SharedMap: React.FC<SharedMapProps> = ({ 
    initialCenter = [39.8283, -98.5795], 
    initialZoom = 4, 
    height = "calc(100vh - 60px)" 
}) => {
    const { isColorBlindMode, isDarkMode } = useSettings();
    const { rivers } = useRivers();
    const location = useLocation();
    
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedRiver, setSelectedRiver] = useState<RiverData | null>(null);
    const [radarMode, setRadarMode] = useState<"off" | "live" | "60min">("off");
    
    const mapContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        };
    }, []);

    const toggleFullScreen = async () => {
        // Fallback for browsers without native Fullscreen API (e.g. old iOS)
        const canNativeFullscreen = document.fullscreenEnabled || (document as any).webkitFullscreenEnabled;
        
        if (!isFullScreen) {
            if (mapContainerRef.current && canNativeFullscreen) {
                if (mapContainerRef.current.requestFullscreen) {
                    await mapContainerRef.current.requestFullscreen().catch(() => {});
                } else if ((mapContainerRef.current as any).webkitRequestFullscreen) {
                    await (mapContainerRef.current as any).webkitRequestFullscreen();
                }
            } else {
                // Manually trigger CSS fallback state if native API is unavailable
                setIsFullScreen(true);
            }
        } else {
            if (canNativeFullscreen && (document.fullscreenElement || (document as any).webkitFullscreenElement)) {
                if (document.exitFullscreen) {
                    await document.exitFullscreen().catch(() => {});
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen();
                }
            } else {
                setIsFullScreen(false);
            }
        }
    };

    const globalMarkers = useMemo(() => {
        const rawPoints: any[] = [];
        rivers.forEach(river => {
            river.accessPoints?.forEach(pt => {
                if (pt.lat && pt.lon) {
                    rawPoints.push({ lat: pt.lat, lon: pt.lon, river, point: pt });
                }
            });
        });

        const GRID_SIZE = 0.0005; // Spatial grid tolerance for clustering
        const buckets: Record<string, any[]> = {};

        rawPoints.forEach(pt => {
            const key = `${Math.floor(pt.lat / GRID_SIZE)}_${Math.floor(pt.lon / GRID_SIZE)}`;
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(pt);
        });

        const finalPoints: any[] = [];
        const OFFSET_RADIUS = 0.0007; // Degrees

        Object.values(buckets).forEach(bucket => {
            if (bucket.length === 1) {
                finalPoints.push(bucket[0]);
            } else {
                const centerLat = bucket.reduce((sum, p) => sum + p.lat, 0) / bucket.length;
                const centerLon = bucket.reduce((sum, p) => sum + p.lon, 0) / bucket.length;

                const n = bucket.length;
                bucket.forEach((pt, idx) => {
                    const angle = (2 * Math.PI * idx) / n;
                    const latOffset = OFFSET_RADIUS * Math.sin(angle);
                    const lonOffset = (OFFSET_RADIUS / Math.cos(centerLat * Math.PI / 180)) * Math.cos(angle);
                    
                    finalPoints.push({
                        ...pt,
                        lat: centerLat + latOffset,
                        lon: centerLon + lonOffset
                    });
                });
            }
        });
        
        return finalPoints;
    }, [rivers]);

    // Using true HTML5 Native Fullscreen where supported! 
    return (
        <div 
            ref={mapContainerRef}
            style={{ 
                height: isFullScreen ? "100vh" : height, 
                width: "100%", 
                position: isFullScreen ? "fixed" : "relative",
                top: isFullScreen ? 0 : "auto",
                left: isFullScreen ? 0 : "auto",
                zIndex: isFullScreen ? 1000 : 1,
                backgroundColor: isDarkMode ? "#000" : "#fff"  // Prevent native fullscreen from having clear/black background dynamically
            }}
        >
            <button 
                onClick={toggleFullScreen}
                style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    zIndex: 2000,
                    padding: "8px 12px",
                    backgroundColor: "var(--surface)",
                    color: "var(--text)",
                    border: "2px solid var(--border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
                }}
            >
                {isFullScreen ? "↖ Exit Fullscreen" : "⤢ Fullscreen"}
            </button>

            {/* Radar Controls */}
            <div style={{
                position: "absolute",
                bottom: "30px",
                left: "10px",
                zIndex: 2000,
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                backgroundColor: "var(--surface)",
                padding: "8px",
                borderRadius: "8px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.4)"
            }}>
                <label style={{ fontSize: "0.8em", fontWeight: "bold", margin: "0 0 4px 0", color: "var(--text)" }}>Weather Radar</label>
                <div style={{ display: "flex", gap: "5px" }}>
                    <button 
                        onClick={() => setRadarMode("off")}
                        style={{ padding: "4px 8px", fontSize: "0.85em", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: radarMode === "off" ? "var(--primary)" : "transparent", color: radarMode === "off" ? "white" : "var(--text)", cursor: "pointer" }}
                    >Off</button>
                    <button 
                        onClick={() => setRadarMode("live")}
                        style={{ padding: "4px 8px", fontSize: "0.85em", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: radarMode === "live" ? "var(--primary)" : "transparent", color: radarMode === "live" ? "white" : "var(--text)", cursor: "pointer" }}
                    >Live</button>
                    <button 
                        onClick={() => setRadarMode("60min")}
                        style={{ padding: "4px 8px", fontSize: "0.85em", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: radarMode === "60min" ? "var(--primary)" : "transparent", color: radarMode === "60min" ? "white" : "var(--text)", cursor: "pointer" }}
                    >60m Loop</button>
                </div>
            </div>

            <MapContainer 
                center={initialCenter} 
                zoom={initialZoom} 
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
                preferCanvas={true}
            >
                <MapController isFullScreen={isFullScreen} />
                
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Embedded Weather Radar */}
                <WeatherRadarLayer mode={radarMode} />

                {/* Global River Markers */}
                {globalMarkers.map((pt, i) => {
                    const isValidRunning = typeof pt.river.running === 'number' && !isNaN(pt.river.running);
                    const colorStr = calculateColor(isValidRunning ? pt.river.running : null, false, isColorBlindMode);
                    const unknownColor = isDarkMode ? "#000000" : "#9ca3af";
                    const fillColor = pt.river.isGauge ? "#df6af1" : (colorStr || unknownColor);
                    const opacity = pt.river.isGauge ? 1.0 : 0.9;
                    
                    const isPutIn = pt.point && pt.point.type === "put-in";
                    const isTakeOut = pt.point && pt.point.type === "take-out";
                    const accessName = pt.point?.name || (isPutIn ? "Put-In" : isTakeOut ? "Take-Out" : "Access Point");

                    if (pt.river.isGauge) {
                        return (
                            <CircleMarker
                                key={`global-${i}`}
                                center={[pt.lat, pt.lon]}
                                radius={3}
                                fillColor={fillColor}
                                fillOpacity={opacity}
                                color={"var(--text)"}
                                weight={1}
                                eventHandlers={{
                                    click: () => setSelectedRiver(pt.river)
                                }}
                            >
                               <Tooltip>
                                  <strong>{accessName}</strong><br/>
                                  {pt.river.name} {pt.river.section ? `(${pt.river.section})` : ""}<br/>
                                  {pt.river.flowInfo ? <span>{pt.river.flowInfo}</span> : null}
                               </Tooltip>
                            </CircleMarker>
                        );
                    }

                    const letter = isPutIn ? "P" : isTakeOut ? "T" : "A";
                    const pathFilter = isDarkMode ? 'filter: brightness(0.82);' : '';
                    const iconHtml = `
                        <svg viewBox="0 0 28 40" width="28" height="40" style="transform-origin: bottom center;" xmlns="http://www.w3.org/2000/svg">
                          <g transform="translate(2, 2)">
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24s12-15.75 12-24C24 5.373 18.627 0 12 0z" fill="${fillColor}" fill-opacity="${opacity}" stroke="var(--text)" stroke-width="1.5" stroke-linejoin="round" style="${pathFilter}"/>
                            <text x="12" y="13.5" dominant-baseline="central" fill="#ffffff" paint-order="stroke fill" stroke="rgba(0,0,0,0.85)" stroke-width="2.5" font-size="14" font-family="sans-serif" font-weight="900" text-anchor="middle">${letter}</text>
                          </g>
                        </svg>
                    `;
                    
                    const icon = L.divIcon({
                        html: iconHtml,
                        className: '', // disable default generic divIcon backgrounds
                        iconSize: [28, 40],
                        iconAnchor: [14, 38], // path bottom is at 36, offset +2 = 38
                        tooltipAnchor: [0, -38]
                    });

                    return (
                        <Marker
                            key={`global-${i}`}
                            position={[pt.lat, pt.lon]}
                            icon={icon}
                            eventHandlers={{
                                click: () => setSelectedRiver(pt.river)
                            }}
                        >
                           <Tooltip>
                              <strong>{accessName}</strong><br/>
                              {pt.river.name} {pt.river.section ? `(${pt.river.section})` : ""}<br/>
                              {pt.river.flowInfo ? <span>{pt.river.flowInfo}</span> : null}
                           </Tooltip>
                        </Marker>
                    );
                })}



                {/* Local User Physical GPS Position Marker */}
                {location.latitude && location.longitude && (
                    <CircleMarker
                        center={[location.latitude, location.longitude]}
                        radius={7}
                        fillColor="#3b82f6"
                        fillOpacity={1.0}
                        color="#ffffff"
                        weight={2}
                    >
                        <Popup>
                            You are here: <br />
                            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </Popup>
                    </CircleMarker>
                )}
            </MapContainer>

            {/* Universally Injected Selected River Sidebar */}
            {selectedRiver && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "100%",
                        maxWidth: "450px",
                        backgroundColor: "var(--surface)",
                        zIndex: 2000,
                        boxShadow: "-4px 0 15px rgba(0,0,0,0.2)",
                        overflowY: "auto",
                        borderLeft: "1px solid var(--border)"
                    }}
                >
                    <div
                        style={{
                            padding: "20px",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "var(--surface)",
                            borderBottom: "1px solid var(--border)",
                            zIndex: 10,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <h2 style={{ margin: 0, color: "var(--text)" }}>
                            {selectedRiver.name}{" "}
                            {selectedRiver.section ? `(${selectedRiver.section})` : ""}
                        </h2>
                        <button
                            onClick={() => setSelectedRiver(null)}
                            style={{
                                border: "none",
                                background: "transparent",
                                fontSize: "2em",
                                cursor: "pointer",
                                color: "var(--text-muted)",
                                lineHeight: 1,
                            }}
                        >
                            &times;
                        </button>
                    </div>
                    
                    <div style={{ padding: "0 20px 20px 20px", color: "var(--text-secondary)" }}>
                            <RiverExpansion 
                                 key={selectedRiver.id}
                                 river={selectedRiver} 
                                 isMapOverlay={true} 
                            />
                    </div>
                </div>
            )}
        </div>
    );
};
