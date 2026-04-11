import React, { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
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
    focusRiver, 
    height = "calc(100vh - 60px)" 
}) => {
    const { isColorBlindMode, isDarkMode } = useSettings();
    const { rivers } = useRivers();
    const location = useLocation();
    
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedRiver, setSelectedRiver] = useState<RiverData | null>(null);
    const [radarMode, setRadarMode] = useState<"off" | "live" | "60min">("off");
    const [showLocalAccessPoints, setShowLocalAccessPoints] = useState(false);

    useEffect(() => {
        setShowLocalAccessPoints(false);
    }, [selectedRiver]);

    const globalMarkers = useMemo(() => {
        const points: any[] = [];
        rivers.forEach(river => {
            river.accessPoints?.forEach(pt => {
                if (pt.lat && pt.lon) {
                    points.push({ lat: pt.lat, lon: pt.lon, river });
                }
            });
        });
        return points;
    }, [rivers]);

    return (
        <div 
            style={{ 
                height: height, 
                width: "100%", 
                position: isFullScreen ? "fixed" : "relative",
                top: isFullScreen ? 0 : "auto",
                left: isFullScreen ? 0 : "auto",
                zIndex: isFullScreen ? 1000 : 1,
            }}
        >
            <button 
                onClick={() => setIsFullScreen(!isFullScreen)}
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
                    const color = calculateColor(pt.river.running ?? null, false, isColorBlindMode);
                    const fillColor = pt.river.isGauge ? "#df6af1" : (color || "var(--surface)");
                    const opacity = pt.river.isGauge ? 1.0 : 0.9;
                    
                    return (
                        <CircleMarker
                            key={`global-${i}`}
                            center={[pt.lat, pt.lon]}
                            radius={pt.river.isGauge ? 3 : 8}
                            fillColor={fillColor}
                            fillOpacity={opacity}
                            color={pt.river.isGauge ? "#b53ebb" : "var(--text)"}
                            weight={1}
                            eventHandlers={{
                                click: () => setSelectedRiver(pt.river)
                            }}
                        >
                           <Popup>
                              <strong>{pt.river.name}</strong><br/>
                              {pt.river.section && <span>{pt.river.section}<br/></span>}
                              {pt.river.class && <span>Class {pt.river.class}<br/></span>}
                           </Popup>
                        </CircleMarker>
                    );
                })}

                {/* Focus River Dedicated Access Markers (Overlaid strictly for Mini Maps or user triggered) */}
                {(focusRiver || (showLocalAccessPoints ? selectedRiver : null))?.accessPoints?.map((point, idx) => (
                    <CircleMarker 
                        key={`local-${idx}`}
                        center={[point.lat, point.lon]}
                        radius={6}
                        fillColor={point.type === "put-in" ? "#22c55e" : point.type === "take-out" ? "#ef4444" : "#3b82f6"}
                        fillOpacity={0.9}
                        color="white"
                        weight={2}
                    >
                        <Popup>
                            <strong>{point.name || point.type || "Access Point"}</strong><br/>
                            <a
                                href={`https://www.google.com/maps/dir//${point.lat},${point.lon}/@${point.lat},${point.lon},14z`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {point.lat}, {point.lon}
                            </a>
                        </Popup>
                    </CircleMarker>
                ))}

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
                             onShowAccessPoints={() => setShowLocalAccessPoints(true)} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
