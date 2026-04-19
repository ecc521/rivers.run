import React, { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiverData } from "../types/River";
import { calculateColor } from "../utils/flowInfoCalculations";
import { useSettings } from "../context/SettingsContext";
import { useLists } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useLocation } from "../hooks/useLocation";
import { WeatherRadarLayer } from "./WeatherRadarLayer";
import { RiverExpansion } from "./RiverExpansion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { filterRivers, defaultAdvancedSearchQuery } from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";

import { SearchOverlay } from "./SearchOverlay";
import { ShareMapModal } from "./ShareMapModal";
import { Circle } from "react-leaflet";
import { Capacitor } from '@capacitor/core';
import { SystemBars } from '@capacitor/core';

const MapStateObserver = ({ setCenter, setZoom }: { setCenter: any, setZoom: any }) => {
    const map = useMap();
    useEffect(() => {
        const onMoveEnd = () => {
            const center = map.getCenter();
            setCenter([center.lat, center.lng]);
            setZoom(map.getZoom());
        };
        map.on("moveend", onMoveEnd);
        map.on("zoomend", onMoveEnd);
        return () => {
            map.off("moveend", onMoveEnd);
            map.off("zoomend", onMoveEnd);
        };
    }, [map, setCenter, setZoom]);
    return null;
};
const MapController = ({ isFullScreen }: { isFullScreen: boolean }) => {
    const map = useMap();
    useEffect(() => {
        // Invalidate map size so Leaflet recalculates dimensions when fullscreen toggles
        const timer = setTimeout(() => {
            if (map && map.getContainer && map.getContainer()) {
                map.invalidateSize();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [isFullScreen, map]);
    return null;
};


const imageIconCache = new Map<string, HTMLImageElement>();

// --- Leaflet DOM-less Canvas Injection ---
if (typeof window !== "undefined" && L && L.Canvas) {
    const originalUpdateCircle = (L.Canvas.prototype as any)._updateCircle;
    // We only hook once
    if (!originalUpdateCircle.__isHooked) {
        (L.Canvas.prototype as any)._updateCircle = function(layer: any) {
            if (layer.options.img && layer.options.img.complete) {
                if (!(this as any)._drawing || layer._empty()) { return; }
                const p = layer._point;
                const ctx = (this as any)._ctx;
                const img = layer.options.img;
                
                // Draw image on hardware canvas
                // Our PNG size is 28x40, anchor is at [14, 38]
                ctx.drawImage(img, p.x - 14, p.y - 38, 28, 40);
            } else {
                // Standard circle rendering fallback
                originalUpdateCircle.call(this, layer);
            }
        };
        (L.Canvas.prototype as any)._updateCircle.__isHooked = true;
    }
}

if (typeof window !== "undefined" && L && L.CircleMarker) {
    const originalContainsPoint = (L.CircleMarker.prototype as any)._containsPoint;
    if (!originalContainsPoint.__isHooked) {
        (L.CircleMarker.prototype as any)._containsPoint = function(p: any) {
            // Apply 15px universal "fat-finger" padding explicitly to counteract
            // the loss of native OS DOM-element touch heuristics on WebGL canvas bounds.
            const fatFingerPadding = 15;
            
            if (this.options.img) {
                const x = this._point.x;
                const y = this._point.y;
                const tol = this._clickTolerance() + fatFingerPadding;
                // True geographic point is at tip (14, 38)
                // Map the theoretical rect bounds to check for hover/click 
                return p.x >= x - 14 - tol && p.x <= x + 14 + tol &&
                       p.y >= y - 38 - tol && p.y <= y + 2 + tol;
            } else {
                // Native leaflet distance calculation with our injected padding
                const tol = this._clickTolerance() + fatFingerPadding;
                return p.distanceTo(this._point) <= this._radius + tol;
            }
        };
        (L.CircleMarker.prototype as any)._containsPoint.__isHooked = true;
    }
}


const getCachedCanvasImage = (letter: string, fillColor: string, opacity: number, isDarkMode: boolean) => {
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 2;
    const finalDpr = Math.max(dpr, 2); // Baseline at least 2x
    
    const key = `${letter}_${fillColor}_${opacity}_${isDarkMode}_${finalDpr}`;
    if (imageIconCache.has(key)) {
        return imageIconCache.get(key)!;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 28 * finalDpr;
    canvas.height = 40 * finalDpr;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
        ctx.scale(finalDpr, finalDpr);
        ctx.translate(2, 2);
        
        if (isDarkMode) {
            ctx.filter = "brightness(0.82)";
        }

        const p = new Path2D("M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24s12-15.75 12-24C24 5.373 18.627 0 12 0z");
        
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = opacity;
        ctx.fill(p);
        
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDarkMode ? "#f8fafc" : "#1e293b";
        ctx.stroke(p);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 14px sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(letter, 12, 13.5);
        ctx.fillText(letter, 12, 13.5);
    }
    
    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    imageIconCache.set(key, img);
    return img;
};

const MapMarkers = React.memo(({ 
    markers, 
    handleMarkerClick, 
    isDarkMode, 
    isColorBlindMode 
}: { 
    markers: any[], 
    handleMarkerClick: (river: RiverData, point: any, lat: number, lon: number) => void,
    isDarkMode: boolean, 
    isColorBlindMode: boolean 
}) => {
    const gauges = useMemo(() => markers.filter(pt => pt.river.isGauge), [markers]);
    const nonGauges = useMemo(() => markers.filter(pt => !pt.river.isGauge), [markers]);

    const geoJsonData: any = useMemo(() => {
        return {
            type: "FeatureCollection",
            features: gauges.map(pt => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [pt.lon, pt.lat]
                },
                properties: {
                    river: pt.river,
                    point: pt.point,
                    fillColor: "#df6af1"
                }
            }))
        };
    }, [gauges]);

    const onEachFeature = (feature: any, layer: any) => {
        const pt = feature.properties;
        layer.on('click', () => handleMarkerClick(pt.river, pt.point, pt.point.lat, pt.point.lon));

        const getAccessLabel = (pt: any) => {
            if (pt.type === "put-in") return "Put-In";
            if (pt.type === "take-out") return "Take-Out";
            return "Access";
        };

        const typeLabel = getAccessLabel(pt.point);
        let accessName = pt.point?.name || typeLabel;
        if (accessName !== typeLabel && !accessName.startsWith(`${typeLabel}:`)) {
            accessName = `${typeLabel}: ${accessName}`;
        }

        const sectionHtml = pt.river.section ? `(${pt.river.section})` : "";
        const flowHtml = pt.river.flowInfo ? `<span>${pt.river.flowInfo}</span>` : "";
        
        layer.bindTooltip(`
            <div style="font-family: sans-serif;">
                <strong>${accessName}</strong><br/>
                ${pt.river.name} ${sectionHtml}<br/>
                ${flowHtml}
                <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">(Click marker for more info)</div>
            </div>
        `, { direction: 'auto' });
    };

    const pointToLayer = (feature: any, latlng: any) => {
        return L.circleMarker(latlng, {
            radius: 6.75,
            fillColor: feature.properties.fillColor,
            fillOpacity: 1.0,
            color: isDarkMode ? "#f8fafc" : "#1e293b",
            weight: 1
        });
    };

    const geoJsonKey = `geo-${gauges.length}`;

    return (
        <>
            {gauges.length > 0 && (
                <GeoJSON 
                    key={geoJsonKey}
                    data={geoJsonData} 
                    pointToLayer={pointToLayer} 
                    onEachFeature={onEachFeature} 
                />
            )}
            {nonGauges.map((pt, i) => {
                const isValidRunning = typeof pt.river.running === 'number' && !isNaN(pt.river.running);
                const colorStr = calculateColor(isValidRunning ? pt.river.running : null, false, isColorBlindMode);
                const unknownColor = isDarkMode ? "#000000" : "#9ca3af";
                const fillColor = colorStr || unknownColor;
                const opacity = 0.9;
                
                const getAccessLabel = (pt: any) => {
                    if (pt?.type === "put-in") return "Put-In";
                    if (pt?.type === "take-out") return "Take-Out";
                    return "Access";
                };

                const typeLabel = getAccessLabel(pt.point);
                let accessName = pt.point?.name || typeLabel;
                if (accessName !== typeLabel && !accessName.startsWith(`${typeLabel}:`)) {
                    accessName = `${typeLabel}: ${accessName}`;
                }

                const getAccessLetter = (pt: any) => {
                    if (pt?.type === "put-in") return "P";
                    if (pt?.type === "take-out") return "T";
                    return "A";
                };
                const letter = getAccessLetter(pt.point);

                const img = getCachedCanvasImage(letter, fillColor, opacity, isDarkMode);

                return (
                    <CircleMarker
                        key={`global-${i}`}
                        center={[pt.lat, pt.lon]}
                        radius={14}
                        pathOptions={{ 
                            img: img,
                            stroke: false,
                            fill: false
                        } as any}
                        eventHandlers={{
                            click: () => handleMarkerClick(pt.river, pt.point, pt.lat, pt.lon)
                        }}
                    >
                       <Tooltip offset={[0, -38]} direction="top">
                          <strong>{accessName}</strong><br/>
                          {pt.river.name} {pt.river.section ? `(${pt.river.section})` : ""}<br/>
                          {pt.river.flowInfo ? <span>{pt.river.flowInfo}</span> : null}
                          <div style={{ fontSize: "0.85em", color: "var(--text-muted, #6b7280)", marginTop: "4px" }}>(Click marker for more info)</div>
                       </Tooltip>
                    </CircleMarker>
                );
            })}
        </>
    );
});

const MapFocusController = ({ focusRiver }: { focusRiver?: RiverData }) => {
    const map = useMap();
    useEffect(() => {
        if (focusRiver && focusRiver.accessPoints && focusRiver.accessPoints.length > 0) {
            const pt = focusRiver.accessPoints[0];
            if (pt.lat && pt.lon) {
                // Smoothly pan without remounting the entire MapContainer!
                try {
                    map.flyTo([pt.lat, pt.lon], 12, { duration: 0.5 });
                } catch (err) {
                    console.warn("Leaflet flyTo safely caught during transition", err);
                }
            }
        }
    }, [focusRiver?.id, map]);
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
    height = "calc(100vh - 60px)",
    focusRiver
}) => {
    const { isColorBlindMode, isDarkMode } = useSettings();
    const { rivers } = useRivers();
    const { isRiverInQuickList } = useLists();
    const location = useLocation();
    
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedRiver, setSelectedRiver] = useState<RiverData | null>(null);
    const [selectedAccessPoint, setSelectedAccessPoint] = useState<any>(null);
    const [activePopupData, setActivePopupData] = useState<{ river: RiverData, point: any, lat: number, lon: number } | null>(null);
    const [radarMode, setRadarMode] = useState<"off" | "live" | "60min">("off");
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Pull initial map state from URL or use defaults
    const urlLat = searchParams.get("lat");
    const urlLng = searchParams.get("lng");
    const urlZoom = searchParams.get("zoom");
    
    const mapInitialCenter: [number, number] = urlLat && urlLng 
        ? [parseFloat(urlLat), parseFloat(urlLng)] 
        : initialCenter;
    const mapInitialZoom = urlZoom ? parseInt(urlZoom) : initialZoom;

    const [mapCenter, setMapCenter] = useState<[number, number]>(mapInitialCenter);
    const [mapZoom, setMapZoom] = useState<number>(mapInitialZoom);

    // Stable references for the click handler to prevent Re-rendering 10k markers!
    const focusRiverRef = React.useRef(focusRiver);
    React.useEffect(() => { focusRiverRef.current = focusRiver; }, [focusRiver]);
    
    const isFullScreenRef = React.useRef(false);
    React.useEffect(() => { isFullScreenRef.current = isFullScreen; }, [isFullScreen]);

    const handleStableMarkerClick = React.useCallback((river: RiverData, point: any, lat: number, lon: number) => {
        if (!focusRiverRef.current || isFullScreenRef.current) {
            setSelectedRiver(river);
            setSelectedAccessPoint(point);
        } else {
            if (river.id !== focusRiverRef.current.id) {
                navigate(`/river/${river.id}`, { replace: true });
            }
            setActivePopupData({ river, point, lat, lon });
        }
    }, [navigate]);

    const [searchQuery, setSearchQuery] = useState<AdvancedSearchQuery>(() => {
        const q: AdvancedSearchQuery = { ...defaultAdvancedSearchQuery };
        if (searchParams.get("name")) q.name = searchParams.get("name")!;
        if (searchParams.get("section")) q.section = searchParams.get("section")!;
        
        if (searchParams.get("distanceMax")) {
            q.distanceMax = parseInt(searchParams.get("distanceMax")!);
            q.mapRadiusMode = (searchParams.get("radiusMode") as "current" | "center" | null) || "current";
            if (searchParams.get("userLat")) q.userLat = parseFloat(searchParams.get("userLat")!);
            if (searchParams.get("userLon")) q.userLon = parseFloat(searchParams.get("userLon")!);
        }

        if (searchParams.get("skillMin")) q.skillMin = parseInt(searchParams.get("skillMin")!);
        if (searchParams.get("skillMax")) q.skillMax = parseInt(searchParams.get("skillMax")!);
        if (searchParams.get("flowMin")) q.flowMin = parseFloat(searchParams.get("flowMin")!);
        if (searchParams.get("flowMax")) q.flowMax = parseFloat(searchParams.get("flowMax")!);
        if (searchParams.get("favoritesOnly") === "true") q.favoritesOnly = true;
        
        return q;
    });

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);

    useEffect(() => {
        // Automatically request hardware location permissions when rendering a map view
        if (!location.latitude && !location.longitude && !location.loading && !location.error) {
            location.requestLocation();
        }
    }, []);


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

    useEffect(() => {
        // Only manipulate the native StatusBar on iOS because hiding it on Android 
        // triggers Immersive Mode which dynamically re-letterboxes the cutout area natively!
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
            if (isFullScreen) {
                SystemBars.hide().catch(() => {});
            } else {
                SystemBars.show().catch(() => {});
            }
        }
    }, [isFullScreen]);

    const toggleFullScreen = async () => {
        // Fallback for browsers without native Fullscreen API (e.g. old iOS)
        const canNativeFullscreen = !Capacitor.isNativePlatform() && (document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
        
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
        // Strip out distanceMax so markers aren't filtered out by distance on the map!
        const filterQuery = { ...searchQuery, distanceMax: undefined };
        let filtered = filterRivers(rivers, filterQuery);

        if (filterQuery.favoritesOnly) {
            filtered = filtered.filter(r => isRiverInQuickList(r.id, "favorites"));
        }

        const rawPoints: any[] = [];
        filtered.forEach(river => {
            river.accessPoints?.forEach(pt => {
                const lat = Array.isArray(pt.lat) ? pt.lat[0] : pt.lat;
                const lon = Array.isArray(pt.lon) ? pt.lon[0] : pt.lon;
                const fLat = typeof lat === 'string' ? parseFloat(lat) : lat;
                const fLon = typeof lon === 'string' ? parseFloat(lon) : lon;

                if (!isNaN(fLat) && !isNaN(fLon) && fLat !== null && fLon !== null) {
                    rawPoints.push({ lat: fLat, lon: fLon, river, point: pt });
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
    }, [rivers, searchQuery, isRiverInQuickList]);

    // Using true HTML5 Native Fullscreen where supported! 
    return (
        <div 
            ref={mapContainerRef}
            className={isFullScreen ? "map-fullscreen-container" : ""}
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
            <style>
                {`
                .map-fullscreen-container .leaflet-top {
                    top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
                }
                .map-fullscreen-container .leaflet-left {
                    left: var(--safe-area-inset-left, env(safe-area-inset-left, 0px));
                }
                .map-fullscreen-container .leaflet-right {
                    right: var(--safe-area-inset-right, env(safe-area-inset-right, 0px));
                }
                .map-fullscreen-container .leaflet-bottom {
                    bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
                }
                `}
            </style>
            <button 
                onClick={toggleFullScreen}
                style={{
                    position: "absolute",
                    top: isFullScreen ? "calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" : "10px",
                    right: isFullScreen ? "calc(10px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)))" : "10px",
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

            {/* Filter and Share Controls next to Zoom Controls */}
            <div style={{
                position: "absolute",
                top: isFullScreen ? "calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" : "10px",
                left: isFullScreen ? "calc(50px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)))" : "50px", // Leaflet zoom controls are 10px from left and 34px wide
                zIndex: 1000,
                display: "flex",
                gap: "10px"
            }}>
                <button
                    onClick={() => setIsFilterOpen(true)}
                    style={{
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
                    Filter
                </button>
                <button
                    onClick={() => setIsShareOpen(true)}
                    style={{
                        padding: "8px 12px",
                        backgroundColor: "var(--primary)",
                        color: "var(--surface)",
                        border: "2px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
                    }}
                >
                    Share
                </button>
            </div>

            <SearchOverlay 
                isOpen={isFilterOpen} 
                onClose={() => setIsFilterOpen(false)} 
                query={searchQuery} 
                setQuery={setSearchQuery} 
                isMapMode={true}
            />

            <ShareMapModal 
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                currentQuery={searchQuery}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
            />

            {/* Radar Controls */}
            <div style={{
                position: "absolute",
                bottom: isFullScreen ? "calc(30px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" : "30px",
                left: isFullScreen ? "calc(10px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)))" : "10px",
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
                center={mapInitialCenter} 
                zoom={mapInitialZoom} 
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
                preferCanvas={true}
            >
                <MapStateObserver setCenter={setMapCenter} setZoom={setMapZoom} />
                <MapController isFullScreen={isFullScreen} />
                <MapFocusController focusRiver={focusRiver} />
                
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Embedded Weather Radar */}
                <WeatherRadarLayer mode={radarMode} />

                {/* Global River Markers */}
                <MapMarkers 
                    markers={globalMarkers}
                    handleMarkerClick={handleStableMarkerClick}
                    isDarkMode={isDarkMode}
                    isColorBlindMode={isColorBlindMode}
                />

                {/* Mini-Map specific contextual Popup */}
                {activePopupData && (
                    <Popup 
                        position={[activePopupData.lat, activePopupData.lon]} 
                        eventHandlers={{
                            remove: () => setActivePopupData(null)
                        }}
                        offset={[0, -20]}
                    >
                        <div style={{ textAlign: "center", fontSize: "1.1em" }}>
                            <strong>{activePopupData.point?.name || (activePopupData.point?.type === "put-in" ? "Put-In" : "Take-Out")}</strong>
                            <br />
                            <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${activePopupData.lat},${activePopupData.lon}`} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ display: "inline-block", marginTop: "8px", fontWeight: "bold" }}
                            >
                                Open in Google Maps
                            </a>
                        </div>
                    </Popup>
                )}



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
                        <Tooltip direction="top" offset={[0, -5]}>
                            <div style={{ textAlign: "center" }}>
                                <strong>Your Current Location</strong><br />
                                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                )}

                {/* Distance Radius Circle */}
                {searchQuery.distanceMax && (
                    <Circle 
                        center={(searchQuery.mapRadiusMode === "center" || !location.latitude || !location.longitude) ? mapCenter : [location.latitude, location.longitude]} 
                        radius={searchQuery.distanceMax * 1609.34} // Convert miles to meters
                        pathOptions={{ 
                            fillColor: 'var(--primary)', 
                            fillOpacity: 0.1, 
                            color: 'var(--primary)', 
                            weight: 2, 
                            dashArray: "4 4" 
                        }} 
                    />
                )}
            </MapContainer>

            {/* Universally Injected Selected River Sidebar */}
            {selectedRiver && (
                <div
                    className="river-details-sidebar"
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
                            paddingTop: isFullScreen ? "calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" : "20px",
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
                            {selectedAccessPoint && selectedAccessPoint.name && (
                                <span style={{ display: "block", fontSize: "0.85em", color: "var(--primary)", marginBottom: "4px" }}>
                                    {(() => {
                                        if (selectedAccessPoint.type === 'put-in') return 'Put-In: ';
                                        if (selectedAccessPoint.type === 'take-out') return 'Take-Out: ';
                                        return 'Access: ';
                                    })()}
                                    {selectedAccessPoint.name}
                                </span>
                            )}

                            {selectedRiver.name}{" "}
                            {selectedRiver.section ? `(${selectedRiver.section})` : ""}
                        </h2>
                        <button
                            onClick={() => {
                                setSelectedRiver(null);
                                setSelectedAccessPoint(null);
                            }}
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
                            {selectedAccessPoint && selectedAccessPoint.lat && (
                                <div style={{ marginBottom: "15px" }}>
                                    <a 
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedAccessPoint.lat},${selectedAccessPoint.lon}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        style={{ display: "inline-block", backgroundColor: "var(--primary)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontWeight: "bold", textDecoration: "none" }}
                                    >
                                        📍 Navigate in Google Maps
                                    </a>
                                </div>
                            )}

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
