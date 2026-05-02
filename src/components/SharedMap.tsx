import React, { useState, useMemo, useEffect } from "react";
import Map, { Source, Layer, Popup, Marker } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getDownloadedRegions, getOfflineMapSource } from "../utils/offlineMapEngine";
import { Protocol, PMTiles, FileSource } from "pmtiles";
import type { RiverData } from "../types/River";
import { calculateColor } from "../utils/flowInfoCalculations";
import { useSettings } from "../context/SettingsContext";
import { useLists } from "../context/ListsContext";
import { useRivers } from "../hooks/useRivers";
import { useLocation } from "../hooks/useLocation";
import { WeatherRadarLayer } from "./WeatherRadarLayer";
import { RiverExpansion } from "./RiverExpansion";
import { useSearchParams, useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { filterRivers, defaultAdvancedSearchQuery } from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { useModal } from "../context/ModalContext";
import { useAuth } from "../context/AuthContext";
import { getRiverShareUrl } from "../utils/url";
import { fetchAPI } from "../services/api";


import { SearchOverlay } from "./SearchOverlay";
import { ShareMapModal } from "./ShareMapModal";
import { Capacitor } from '@capacitor/core';
import { SystemBars } from '@capacitor/core';

// Global protocol state
let pmtilesProtocolAdded = false;
// Global protocol state
let hybridProtocolAdded = false;
let activeOfflineInstances: PMTiles[] = [];
let basemapInstance: PMTiles | null = null;

export const formatAccessName = (point: any) => {
    if (!point) return "Access";
    
    // Default type labels based on the access point type
    const getTypeLabel = (type?: string) => {
        if (type === "put-in") return "Put-In";
        if (type === "take-out") return "Take-Out";
        return "Access";
    };

    const typeLabel = getTypeLabel(point.type);
    const name = point.name?.trim();

    // If there is no custom name, just return the type label
    if (!name) return typeLabel;

    // Normalize for case-insensitive comparison (ignore spaces, dashes, etc.)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

    if (normalize(name) === normalize(typeLabel)) {
        // The name is effectively the same as the type (e.g. "Take-out" == "Take-Out"), just return the properly cased type label
        return typeLabel;
    }

    // Otherwise, prepend the type label
    return `${typeLabel}: ${name}`;
};

const PopupEventManager = ({ isHoverMode, onEnter, onLeave, children }: { isHoverMode: boolean, onEnter: () => void, onLeave: () => void, children: React.ReactNode }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isHoverMode || !ref.current) return;
        // Listen directly on the parent Leaflet container to eliminate any padding dead zones
        const popupContainer = ref.current.closest(".maplibregl-popup");
        if (popupContainer) {
            // Fix Leaflet's massive transparent bounding box issue by pushing interactivity down
            // to the visible sub-components. This prevents popups from silently swallowing 
            // interactions for the map canvas directly underneath them!
            (popupContainer as HTMLElement).style.pointerEvents = "none";
            const wrapper = popupContainer.querySelector('.maplibregl-popup-content') as HTMLElement;
            if (wrapper) wrapper.style.pointerEvents = "auto";
            const tip = popupContainer.querySelector('.maplibregl-popup-tip') as HTMLElement;
            if (tip) tip.style.pointerEvents = "auto";

            popupContainer.addEventListener("mouseenter", onEnter);
            popupContainer.addEventListener("mouseleave", onLeave);
            return () => {
                popupContainer.removeEventListener("mouseenter", onEnter);
                popupContainer.removeEventListener("mouseleave", onLeave);
                // Reset styles on teardown just in case Leaflet recycles DOM nodes internally
                (popupContainer as HTMLElement).style.pointerEvents = "";
                if (wrapper) wrapper.style.pointerEvents = "";
                if (tip) tip.style.pointerEvents = "";
            };
        }
    }, [isHoverMode, onEnter, onLeave]);
    return <div ref={ref} style={{ textAlign: "center", fontSize: "1.1em" }}>{children}</div>;
};



const imageIconCache = new globalThis.Map<string, { imageData: ImageData, pixelRatio: number }>();



const getCachedCanvasImage = (letter: string, fillColor: string, opacity: number) => {
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 2;
    const finalDpr = Math.max(dpr, 2); // Baseline at least 2x
    
    const key = `${letter}_${fillColor}_${opacity}_${finalDpr}`;
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

        const p = new Path2D("M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24s12-15.75 12-24C24 5.373 18.627 0 12 0z");
        
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = opacity;
        ctx.fill(p);
        
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#1e293b"; // Always dark, CSS invert will flip it for dark mode
        ctx.stroke(p);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 14px sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.lineWidth = 2.5;
        ctx.strokeText(letter, 12, 13.5);
        ctx.fillText(letter, 12, 13.5);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = { imageData, pixelRatio: finalDpr };
        imageIconCache.set(key, result);
        return result;
    }
    
    // Fallback if context is null
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1; emptyCanvas.height = 1;
    const emptyCtx = emptyCanvas.getContext("2d")!;
    return { imageData: emptyCtx.getImageData(0, 0, 1, 1), pixelRatio: 1 };
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
    const mapLocation = useRouterLocation();
    const { alert, prompt } = useModal();
    const { user } = useAuth();
    
    const [isFullScreen, setIsFullScreen] = useState(false);

    const [selectedRiver, setSelectedRiver] = useState<RiverData | null>(null);
    const [selectedAccessPoint, setSelectedAccessPoint] = useState<any>(null);
    const [activePopupData, setActivePopupData] = useState<{ river: RiverData, point: any, lat: number, lon: number } | null>(null);
    const [hoverPopupData, setHoverPopupData] = useState<{ river: RiverData, point: any, lat: number, lon: number } | null>(null);
    
    // Memoize the popup position to prevent react-leaflet from thrashing setLatLng on every render
    const popupPosition = useMemo(
        () => {
            const current = activePopupData || hoverPopupData;
            return current ? [current.lat, current.lon] as [number, number] : undefined;
        },
        [activePopupData, hoverPopupData]
    );

    const [radarMode, setRadarMode] = useState<"off" | "live" | "60min">("off");
    const [copiedRiverId, setCopiedRiverId] = useState<string | null>(null);

    
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
                navigate(`/river/${river.id}`, { replace: true, state: { clickedLat: lat, clickedLon: lon } });
            }
            setActivePopupData({ river, point, lat, lon });
        }
    }, [navigate]);

    const hoverTimeoutRef = React.useRef<any>(null);

    const handleStableMarkerMouseOver = React.useCallback((river: RiverData, point: any, lat: number, lon: number) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        if (!activePopupData) {
            setHoverPopupData({ river, point, lat, lon });
        }
    }, [activePopupData]);

    const handleStableMarkerMouseOut = React.useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverPopupData(null);
        }, 100);
    }, []);

    const handlePopupMouseEnter = React.useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    }, []);

    const handlePopupMouseLeave = React.useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverPopupData(null);
        }, 100);
    }, []);
    const handleShare = async (e: React.MouseEvent, river: RiverData) => {
        e.preventDefault();
        const url = getRiverShareUrl(river);
        
        if (Capacitor.isNativePlatform() && navigator.share) {
            try {
                await navigator.share({
                    title: `${river.name} - ${river.section}`,
                    url: url
                });
            } catch (err) {
                // cancelled or failed
                console.warn("Share failed or was cancelled", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                setCopiedRiverId(river.id);
                setTimeout(() => setCopiedRiverId(null), 2000);
            } catch (err) {
                console.error("Clipboard copy failed", err);
                await alert("Failed to copy link.", "Error");
            }
        }
    };


    const handleReport = async (e: React.MouseEvent, river: RiverData) => {
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

    // Handle riverId deep-linking: Open sidebar automatically if riverId is in URL
    useEffect(() => {
        const riverId = searchParams.get("riverId");
        if (riverId && rivers.length > 0 && !selectedRiver) {
            const found = rivers.find(r => r.id === riverId);
            if (found) {
                setSelectedRiver(found);
                if (found.accessPoints && found.accessPoints.length > 0) {
                    setSelectedAccessPoint(found.accessPoints[0]);
                }
            }
        }
    }, [rivers, searchParams]);


    const [portalTargetNode, setPortalTargetNode] = useState<HTMLDivElement | null>(null);
    const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
    const mapContainerCallbackRef = React.useCallback((node: HTMLDivElement | null) => {
        mapContainerRef.current = node;
        setPortalTargetNode(node);
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullScreen(!!(document as any).fullscreenElement || !!(document as any).webkitFullscreenElement);
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
        const canNativeFullscreen = !Capacitor.isNativePlatform() && ((document as any).fullscreenEnabled || (document as any).webkitFullscreenEnabled);
        
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
            if (canNativeFullscreen && ((document as any).fullscreenElement || (document as any).webkitFullscreenElement)) {
                if ((document as any).exitFullscreen) {
                    await (document as any).exitFullscreen().catch(() => {});
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

    const mapRef = React.useRef<any>(null);
    const [viewState, setViewState] = useState({
        longitude: mapInitialCenter[1],
        latitude: mapInitialCenter[0],
        zoom: mapInitialZoom
    });

    // Keep viewState in sync with center changes
    useEffect(() => {
        setViewState({
            longitude: mapCenter[1],
            latitude: mapCenter[0],
            zoom: mapZoom
        });
    }, [mapCenter, mapZoom]);

    useEffect(() => {
        if (focusRiver && focusRiver.accessPoints && focusRiver.accessPoints.length > 0) {
            const routeState = mapLocation.state as { clickedLat?: number, clickedLon?: number } | undefined;
            if (routeState && routeState.clickedLat && routeState.clickedLon) return;
            const pt = focusRiver.accessPoints[0];
            if (pt.lat && pt.lon) {
                mapRef.current?.flyTo({ center: [pt.lon, pt.lat], zoom: mapZoom, duration: 500 });
            }
        }
    }, [focusRiver?.id, mapLocation.state]);

    const [dynamicStyle, setDynamicStyle] = useState<any>(null);

    useEffect(() => {
        if (!pmtilesProtocolAdded) {
            const protocol = new Protocol();
            maplibregl.addProtocol("pmtiles", protocol.tile);
            pmtilesProtocolAdded = true;
        }

        if (!hybridProtocolAdded) {
            maplibregl.addProtocol("hybrid", async (params, abortController) => {
                const match = /hybrid:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
                if (!match) return { data: null };
                const z = parseInt(match[1], 10);
                const x = parseInt(match[2], 10);
                const y = parseInt(match[3], 10);

                // 1. Check bundled basemap (Z0-Z5)
                if (z <= 5 && basemapInstance) {
                    try {
                        const tile = await basemapInstance.getZxy(z, x, y, abortController.signal);
                        if (tile && tile.data) return { data: tile.data };
                    } catch (_e) {
                        console.debug("Basemap tile fetch error:", _e);
                    }
                }

                // 2. Check offline downloaded states
                for (const pmtiles of activeOfflineInstances) {
                    try {
                        const tile = await pmtiles.getZxy(z, x, y, abortController.signal);
                        if (tile && tile.data) return { data: tile.data };
                    } catch (_e) {
                        console.debug("Offline tile fetch error:", _e);
                    }
                }

                // 3. Fallback to online API
                try {
                    const onlineUrl = `https://api.protomaps.com/tiles/v3/${z}/${x}/${y}.mvt?key=08cdd323336ea22b`;
                    const response = await fetch(onlineUrl, { signal: abortController.signal });
                    if (response.ok) {
                        const data = await response.arrayBuffer();
                        return { data };
                    }
                } catch (_e) {
                    console.debug("Online tile network error:", _e);
                }

                return { data: null };
            });
            hybridProtocolAdded = true;
        }

        async function buildStyle() {
            try {
                // Initialize bundled basemap instance if not done
                if (!basemapInstance) {
                    basemapInstance = new PMTiles(`${window.location.origin}/basemap.pmtiles`);
                }

                // Fetch downloaded states and populate the global instances array
                const downloaded = await getDownloadedRegions();
                const newInstances: PMTiles[] = [];
                if (downloaded && downloaded.length > 0) {
                    for (const region of downloaded) {
                        const source = await getOfflineMapSource(region);
                        if (source) {
                            if (typeof source === 'string') {
                                newInstances.push(new PMTiles(source));
                            } else {
                                newInstances.push(new PMTiles(new FileSource(source as File)));
                            }
                        }
                    }
                }
                activeOfflineInstances = newInstances;

                const res = await fetch("/local_style.json");
                const baseStyle = await res.json();
                
                // Set the monolithic hybrid source
                baseStyle.sources.protomaps.url = undefined;
                baseStyle.sources.protomaps.tiles = ["hybrid://{z}/{x}/{y}"];
                baseStyle.sources.protomaps.minzoom = 0;
                baseStyle.sources.protomaps.maxzoom = 15;

                setDynamicStyle(baseStyle);
            } catch (e) {
                console.error("Failed to build dynamic map style:", e);
                setDynamicStyle("/local_style.json");
            }
        }
        buildStyle();
    }, []);

    const gauges = useMemo(() => globalMarkers.filter((pt: any) => pt.river.isGauge), [globalMarkers]);
    const nonGauges = useMemo(() => globalMarkers.filter((pt: any) => !pt.river.isGauge), [globalMarkers]);

    const gaugesGeoJson = useMemo<any>(() => ({
        type: "FeatureCollection",
        features: gauges.map((pt: any) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
            properties: { 
                fillColor: "#df6af1",
                riverId: pt.river.id,
                pointIndex: gauges.indexOf(pt)
            }
        }))
    }), [gauges]);

    const nonGaugesGeoJson = useMemo<any>(() => ({
        type: "FeatureCollection",
        features: nonGauges.map((pt: any) => {
            const isValidRunning = typeof pt.river.running === 'number' && !isNaN(pt.river.running);
            const colorStr = calculateColor(isValidRunning ? pt.river.running : null, false, isColorBlindMode);
            const fillColor = colorStr || "#9ca3af";
            const getAccessLetter = (pt: any) => {
                if (pt?.type === "put-in") return "P";
                if (pt?.type === "take-out") return "T";
                return "A";
            };
            const letter = getAccessLetter(pt.point);
            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
                properties: { 
                    imageKey: `${letter}_${fillColor}_0.9_2`,
                    riverId: pt.river.id,
                    pointIndex: nonGauges.indexOf(pt),
                    letter,
                    fillColor
                }
            };
        })
    }), [nonGauges, isColorBlindMode]);

    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current.getMap();
        const loadImages = () => {
            if (!map || !map.style) return;
            try {
                nonGaugesGeoJson.features.forEach((f: any) => {
                    const { imageKey, letter, fillColor } = f.properties;
                    if (!map.hasImage(imageKey)) {
                        const { imageData, pixelRatio } = getCachedCanvasImage(letter, fillColor, 0.9);
                        map.addImage(imageKey, imageData, { pixelRatio });
                    }
                });
            } catch (e) {
                console.error("Map style not ready for images", e);
            }
        };

        if (map.isStyleLoaded()) {
            loadImages();
        } else {
            map.once('style.load', loadImages);
        }
    }, [nonGaugesGeoJson, dynamicStyle]); // Re-run when style loads

    const handleMapClick = React.useCallback((e: any) => {
        const feature = e.features && e.features[0];
        if (feature) {
            const isGauge = feature.layer.id === 'gauges-layer';
            const arr = isGauge ? gauges : nonGauges;
            const pt = arr[feature.properties.pointIndex];
            if (pt) handleStableMarkerClick(pt.river, pt.point, pt.lat, pt.lon);
        }
    }, [gauges, nonGauges, handleStableMarkerClick]);

    const handleMapMouseMove = React.useCallback((e: any) => {
        const feature = e.features && e.features[0];
        if (feature) {
            const isGauge = feature.layer.id === 'gauges-layer';
            const arr = isGauge ? gauges : nonGauges;
            const pt = arr[feature.properties.pointIndex];
            if (pt) handleStableMarkerMouseOver(pt.river, pt.point, pt.lat, pt.lon);
            if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer';
        } else {
            handleStableMarkerMouseOut();
            if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
        }
    }, [gauges, nonGauges, handleStableMarkerMouseOver, handleStableMarkerMouseOut]);


    // Using true HTML5 Native Fullscreen where supported! 
    return (
        <div 
            ref={mapContainerCallbackRef}
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
                .map-fullscreen-container .maplibregl-ctrl-top-left,
                .map-fullscreen-container .maplibregl-ctrl-top-right {
                    top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
                }
                .map-fullscreen-container .maplibregl-ctrl-bottom-left,
                .map-fullscreen-container .maplibregl-ctrl-bottom-right {
                    bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
                }
                .map-fullscreen-container .maplibregl-ctrl-top-left,
                .map-fullscreen-container .maplibregl-ctrl-bottom-left {
                    left: var(--safe-area-inset-left, env(safe-area-inset-left, 0px));
                }
                .map-fullscreen-container .maplibregl-ctrl-top-right,
                .map-fullscreen-container .maplibregl-ctrl-bottom-right {
                    right: var(--safe-area-inset-right, env(safe-area-inset-right, 0px));
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
                portalTarget={portalTargetNode}
            />

            <ShareMapModal 
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                currentQuery={searchQuery}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                portalTarget={portalTargetNode}
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

            <Map 
                ref={mapRef}
                {...viewState}
                onMove={evt => {
                    setViewState(evt.viewState);
                    setMapCenter([evt.viewState.latitude, evt.viewState.longitude]);
                    setMapZoom(evt.viewState.zoom);
                }}
                mapStyle={dynamicStyle}
                style={{ width: "100%", height: "100%" }}
                interactiveLayerIds={['gauges-layer', 'non-gauges-layer']}
                onClick={handleMapClick}
                onMouseMove={handleMapMouseMove}
                onMouseLeave={handleStableMarkerMouseOut}
            >
                <WeatherRadarLayer mode={radarMode} />

                {gauges.length > 0 && (
                    <Source id="gauges" type="geojson" data={gaugesGeoJson}>
                        <Layer 
                            id="gauges-layer" 
                            type="circle" 
                            paint={{
                                "circle-radius": 6.75,
                                "circle-color": ["get", "fillColor"],
                                "circle-stroke-color": "#1e293b",
                                "circle-stroke-width": 1
                            }}
                        />
                    </Source>
                )}

                {nonGauges.length > 0 && (
                    <Source id="non-gauges" type="geojson" data={nonGaugesGeoJson}>
                        <Layer 
                            id="non-gauges-layer" 
                            type="symbol" 
                            layout={{
                                "icon-image": ["get", "imageKey"],
                                "icon-allow-overlap": true,
                                "icon-ignore-placement": true,
                                "icon-offset": [0, -20]
                            }}
                        />
                    </Source>
                )}

                {/* Mini-Map specific contextual Popup */}
                {popupPosition && (activePopupData || hoverPopupData) && (() => {
                    const thePopupData = activePopupData || hoverPopupData;
                    const isHoverMode = !activePopupData && !!hoverPopupData;
                    
                    const accessName = formatAccessName(thePopupData!.point);

                    return (
                        <Popup 
                            longitude={popupPosition[1]} 
                            latitude={popupPosition[0]}
                            onClose={() => {
                                setActivePopupData(null);
                                setHoverPopupData(null);
                            }}
                            offset={[0, thePopupData!.river.isGauge ? -6 : -25]}
                            closeButton={false}
                            closeOnClick={false}
                            className="custom-maplibre-popup"
                        >
                            <PopupEventManager 
                                isHoverMode={isHoverMode}
                                onEnter={handlePopupMouseEnter}
                                onLeave={handlePopupMouseLeave}
                            >
                                <strong>{accessName}</strong>
                                <br />
                                {thePopupData!.river.name} {thePopupData!.river.section ? `(${thePopupData!.river.section})` : ""}<br/>
                                {thePopupData!.river.flowInfo ? <span>{thePopupData!.river.flowInfo}</span> : null}

                                <div style={{ marginTop: "8px" }}>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleStableMarkerClick(thePopupData!.river, thePopupData!.point, thePopupData!.lat, thePopupData!.lon);
                                        }}
                                        style={{ 
                                            display: "inline-block", 
                                            fontWeight: "bold", 
                                            background: "none", 
                                            border: "none", 
                                            color: "var(--primary)", 
                                            cursor: "pointer",
                                            padding: 0,
                                            fontSize: "inherit"
                                        }}
                                    >
                                        View River Details
                                    </button>
                                    <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
                                    <a 
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${thePopupData!.lat},${thePopupData!.lon}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        style={{ display: "inline-block", fontWeight: "bold" }}
                                    >
                                        Google Maps <span style={{ fontSize: "0.8em" }}>↗</span>
                                    </a>
                                </div>
                            </PopupEventManager>
                        </Popup>
                    );
                })()}

                {/* Local User Physical GPS Position Marker */}
                {location.latitude && location.longitude && (
                    <Marker
                        longitude={location.longitude}
                        latitude={location.latitude}
                        anchor="center"
                    >
                        <div 
                            title={`Your Current Location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
                            style={{
                                width: 14,
                                height: 14,
                                backgroundColor: "#3b82f6",
                                border: "2px solid #ffffff",
                                borderRadius: "50%",
                                boxShadow: "0 0 4px rgba(0,0,0,0.5)"
                            }}
                        />
                    </Marker>
                )}

                {/* Distance Radius Circle */}
                {searchQuery.distanceMax && (
                    <Source 
                        id="radius-circle" 
                        type="geojson" 
                        data={{
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: (searchQuery.mapRadiusMode === "center" || !location.latitude || !location.longitude) 
                                    ? [mapCenter[1], mapCenter[0]] 
                                    : [location.longitude, location.latitude]
                            },
                            properties: {}
                        }}
                    >
                        <Layer 
                            id="radius-circle-layer" 
                            type="circle" 
                            paint={{
                                "circle-radius": [
                                    "interpolate", ["exponential", 2], ["zoom"],
                                    0, 0,
                                    20, searchQuery.distanceMax * 1609.34 / 0.075 / Math.cos(mapCenter[0] * Math.PI / 180)
                                ],
                                "circle-color": "var(--primary)",
                                "circle-opacity": 0.1,
                                "circle-stroke-color": "var(--primary)",
                                "circle-stroke-width": 2
                            }}
                        />
                    </Source>
                )}
            </Map>

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
                        }}
                    >
                        <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                                onClick={(e) => handleReport(e, selectedRiver)}
                                style={{
                                    border: "1px solid var(--border)",
                                    background: "var(--surface)",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    opacity: 0.8
                                }}
                            >
                                🚩 Report
                            </button>
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
                                    padding: "0 4px"
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        <h2 style={{ margin: 0, color: "var(--text)", paddingRight: "110px", width: "100%" }}>
                            {selectedAccessPoint && selectedAccessPoint.name && (
                                <span style={{ display: "block", fontSize: "0.85em", color: "var(--primary)", marginBottom: "4px" }}>
                                    {formatAccessName(selectedAccessPoint)}
                                </span>
                            )}

                            {selectedRiver.name}{" "}
                            {selectedRiver.section ? `(${selectedRiver.section})` : ""}
                        </h2>
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
                                    <button 
                                        onClick={(e) => handleShare(e, selectedRiver)}
                                        style={{ 
                                            display: "inline-block", 
                                            backgroundColor: "transparent", 
                                            color: "var(--primary)", 
                                            border: "1px solid var(--primary)", 
                                            padding: "7px 12px", 
                                            borderRadius: "8px", 
                                            fontWeight: "bold", 
                                            marginLeft: "10px", 
                                            cursor: "pointer" 
                                        }}
                                    >
                                        {copiedRiverId === selectedRiver.id ? "Copied!" : "📤 Share"}
                                    </button>

                                    {selectedRiver.aw && (
                                        <a 
                                            href={`https://www.americanwhitewater.org/content/River/view/river-detail/${selectedRiver.aw}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            style={{ 
                                                display: "inline-block", 
                                                backgroundColor: "transparent", 
                                                color: "var(--primary)", 
                                                border: "1px solid var(--primary)", 
                                                padding: "7px 12px", 
                                                borderRadius: "8px", 
                                                fontWeight: "bold", 
                                                marginLeft: "10px", 
                                                textDecoration: "none",
                                                fontSize: "0.9rem"
                                            }}
                                        >
                                            AW
                                        </a>
                                    )}




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
