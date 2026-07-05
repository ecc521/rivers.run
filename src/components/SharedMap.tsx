import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import { useSearchParams, useNavigate } from "react-router-dom";
import { filterRivers, parseParamsToQuery, countMapActiveFilters } from "../utils/SearchFilters";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { useModal } from "../context/ModalContext";
import { useAuth } from "../context/AuthContext";
import { getRiverShareUrl } from "../utils/url";
import { fetchAPI } from "../services/api";
import { persistentStorage } from "../utils/persistentStorage";



import { SearchOverlay } from "./SearchOverlay";
import { ShareMapModal } from "./ShareMapModal";
import { NavigationPanel } from "./NavigationPanel";
import { MapSearchbar } from "./MapSearchbar";
import type { MapSearchResult } from "./MapSearchbar";
import { Capacitor } from '@capacitor/core';
import { SystemBars } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

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
    hideSearchBar?: boolean;
    skipLocationRequest?: boolean;
}



function destination(lon: number, lat: number, distanceMiles: number, bearingDegrees: number): [number, number] {
    const R = 3959; // Earth's radius in miles
    const ad = distanceMiles / R; // angular distance in radians
    const la1 = lat * Math.PI / 180;
    const lo1 = lon * Math.PI / 180;
    const theta = bearingDegrees * Math.PI / 180;

    const la2 = Math.asin(Math.sin(la1) * Math.cos(ad) + Math.cos(la1) * Math.sin(ad) * Math.cos(theta));
    const lo2 = lo1 + Math.atan2(Math.sin(theta) * Math.sin(ad) * Math.cos(la1), Math.cos(ad) - Math.sin(la1) * Math.sin(la2));

    return [lo2 * 180 / Math.PI, la2 * 180 / Math.PI];
}

function createGeoJSONCircle(centerLon: number, centerLat: number, radiusInMiles: number, points = 64): any {
    const coords = [];
    for (let i = 0; i < points; i++) {
        const bearing = (i / points) * 360;
        coords.push(destination(centerLon, centerLat, radiusInMiles, bearing));
    }
    coords.push([coords[0][0], coords[0][1]]); // close the polygon explicitly without reference sharing

    return {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [coords]
            },
            properties: {}
        }]
    };
}


export const SharedMap: React.FC<SharedMapProps> = ({
    initialCenter = [39.8283, -98.5795],
    initialZoom = 4,
    height = "calc(100vh - 60px)",
    focusRiver,
    hideSearchBar = false,
    skipLocationRequest = false
}) => {
    const { isColorBlindMode, isDarkMode } = useSettings();
    const { rivers } = useRivers();
    const { isRiverInQuickList } = useLists();
    const location = useLocation();

    const { alert, promptReport } = useModal();
    const { user } = useAuth();

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

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

    const [isNavigating, setIsNavigating] = useState(false);
    const [isAutoCenter, setIsAutoCenter] = useState(false);
    const [navDestination, setNavDestination] = useState<[number, number] | null>(null);
    const [navRoute, setNavRoute] = useState<GeoJSON.LineString | null>(null);
    const [showUserLocationPopup, setShowUserLocationPopup] = useState(false);
    const [navDestinationPlace, setNavDestinationPlace] = useState<any>(null);
    const [pinnedPlace, setPinnedPlace] = useState<MapSearchResult | null>(null);
    const [manualStartCoord, setManualStartCoord] = useState<[number, number] | null>(null);
    const [isPickingStart, setIsPickingStart] = useState(false);
    const [pendingStartCoord, setPendingStartCoord] = useState<[number, number] | null>(null);

    // Stable reference — used as a dep inside NavigationPanel's useCallback/useEffect chain.
    // Must not change on every render or it causes a routing re-trigger loop.
    const handleRouteCalculated = useCallback((route: GeoJSON.LineString | null) => {
        setNavRoute(route);
        if (route && mapRef.current) {
            setIsAutoCenter(false);
            const coords = route.coordinates;
            if (coords && coords.length > 0) {
                let minLng = coords[0][0], maxLng = coords[0][0];
                let minLat = coords[0][1], maxLat = coords[0][1];
                for (const coord of coords) {
                    if (coord[0] < minLng) minLng = coord[0];
                    if (coord[0] > maxLng) maxLng = coord[0];
                    if (coord[1] < minLat) minLat = coord[1];
                    if (coord[1] > maxLat) maxLat = coord[1];
                }
                mapRef.current.fitBounds(
                    [[minLng, minLat], [maxLng, maxLat]],
                    { padding: { top: 100, bottom: 220, left: 60, right: 60 }, duration: 1000 }
                );
            }
        }
    }, []);

    useEffect(() => {
        if (isNavigating) {
            setIsAutoCenter(false);
            location.watchLocation();
            if (Capacitor.isNativePlatform()) {
                KeepAwake.keepAwake().catch(console.warn);
            }
            // Zoom to show both user and destination. navDestination is set in the
            // same batched update that flips isNavigating, so it's current here.
            if (navDestination && mapRef.current) {
                if (location.latitude && location.longitude) {
                    mapRef.current.fitBounds(
                        [
                            [Math.min(navDestination[0], location.longitude), Math.min(navDestination[1], location.latitude)],
                            [Math.max(navDestination[0], location.longitude), Math.max(navDestination[1], location.latitude)],
                        ],
                        { padding: { top: 80, bottom: 120, left: 60, right: 60 }, duration: 800, maxZoom: 13 }
                    );
                } else {
                    mapRef.current.flyTo({ center: navDestination, zoom: 12, duration: 800 });
                }
            }
        } else {
            location.clearWatch();
            if (Capacitor.isNativePlatform()) {
                KeepAwake.allowSleep().catch(console.warn);
            }
        }
    }, [isNavigating]); // intentional: navDestination/location are read from closure at fire time, not tracked

    useEffect(() => {
        if (isNavigating && isAutoCenter && location.latitude && location.longitude && mapRef.current) {
            mapRef.current.flyTo({ center: [location.longitude, location.latitude], zoom: Math.max(mapZoom, 14), duration: 500 });
        }
    }, [isNavigating, isAutoCenter, location.latitude, location.longitude]);


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
        const result = await promptReport(`Please explain the problem with the data for ${river.name}:`, "Report Content", user?.email || "");
        if (!result || !result.reason || !result.reason.trim()) return;

        try {
            await fetchAPI("/reports", {
                method: "POST",
                body: JSON.stringify({
                    target_id: river.id,
                    type: "river",
                    reason: result.reason.trim(),
                    email: result.email || user?.email || ""
                })
            });
            await alert("Report submitted successfully. Our moderators will review it shortly.", "Report Sent");
        } catch (e: any) {
            await alert("Failed to submit report: " + e.message);
        }
    };


    const [searchQuery, setSearchQuery] = useState<AdvancedSearchQuery>(() => {
        const q = parseParamsToQuery(searchParams);
        // Map default: search within 100mi of the user unless focused on a
        // specific river or the URL already carries an explicit radius.
        if (!focusRiver && !searchParams.has("distanceMax")) {
            q.distanceMax = 100;
            q.mapRadiusMode = "current";
        }
        // Map-only flag not covered by the shared parser.
        if (searchParams.get("favoritesOnly") === "true") q.favoritesOnly = true;
        return q;
    });

    // Count marker-removing filters so the Filter button can warn when the map
    // is showing a filtered subset. Suppressed on the focused mini-map (river
    // page), where filtering isn't in play.
    const mapFilterCount = focusRiver ? 0 : countMapActiveFilters(searchQuery);
    const filtersActive = mapFilterCount > 0;

    // Calculate map circle data efficiently at top level
    const radiusCircleData = useMemo(() => {
        if (!searchQuery.distanceMax) return null;
        let centerLon: number;
        let centerLat: number;
        if (searchQuery.mapRadiusMode === "center") {
            centerLon = mapCenter[1];
            centerLat = mapCenter[0];
        } else {
            // "location" mode — suppress the circle entirely if GPS is unavailable
            if (!location.latitude || !location.longitude) return null;
            centerLon = location.longitude;
            centerLat = location.latitude;
        }
        if (typeof centerLon !== 'number' || typeof centerLat !== 'number' || isNaN(centerLon) || isNaN(centerLat)) return null;
        return createGeoJSONCircle(centerLon, centerLat, searchQuery.distanceMax);
    }, [searchQuery.distanceMax, searchQuery.mapRadiusMode, mapCenter[0], mapCenter[1], location.latitude, location.longitude]);

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);

    useEffect(() => {
        // Automatically request hardware location permissions when rendering a map view
        if (!skipLocationRequest && !location.latitude && !location.longitude && !location.loading && !location.error) {
            location.requestLocation();
        }
    }, [skipLocationRequest]);

    const [hasFlippedToUserLocation, setHasFlippedToUserLocation] = useState(false);
    useEffect(() => {
        const riverId = searchParams.get("riverId");
        if (!focusRiver && !riverId && !urlLat && !urlLng && !hasFlippedToUserLocation && location.latitude && location.longitude && mapRef.current) {
            setHasFlippedToUserLocation(true);
            mapRef.current.flyTo({ center: [location.longitude, location.latitude], zoom: 7, duration: 800 });
        }
    }, [location.latitude, location.longitude, urlLat, urlLng, hasFlippedToUserLocation, focusRiver, searchParams]);

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
        // triggers Immersive Mode which dynamically re-letterboxes the cutout area!
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
            if (isFullScreen) {
                SystemBars.hide().catch(() => { });
            } else {
                SystemBars.show().catch(() => { });
            }
        }
    }, [isFullScreen]);

    const toggleFullScreen = async () => {
        // Fallback for browsers without native Fullscreen API (e.g. old iOS)
        const canNativeFullscreen = !Capacitor.isNativePlatform() && ((document as any).fullscreenEnabled || (document as any).webkitFullscreenEnabled);

        if (!isFullScreen) {
            if (mapContainerRef.current && canNativeFullscreen) {
                if (mapContainerRef.current.requestFullscreen) {
                    await mapContainerRef.current.requestFullscreen().catch(() => { });
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
                    await (document as any).exitFullscreen().catch(() => { });
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
        const filtered = filterRivers(rivers, filterQuery);

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
        if (!isMapLoaded) return;
        if (focusRiver && focusRiver.accessPoints && focusRiver.accessPoints.length > 0) {
            const validPoints = focusRiver.accessPoints.filter(pt => {
                const lat = Array.isArray(pt.lat) ? pt.lat[0] : pt.lat;
                const lon = Array.isArray(pt.lon) ? pt.lon[0] : pt.lon;
                return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon);
            });

            if (validPoints.length === 0) return;

            if (validPoints.length === 1) {
                const pt = validPoints[0];
                const lat = Array.isArray(pt.lat) ? pt.lat[0] : pt.lat;
                const lon = Array.isArray(pt.lon) ? pt.lon[0] : pt.lon;
                mapRef.current?.flyTo({ center: [lon, lat], zoom: mapZoom > 10 ? mapZoom : 12, duration: 500 });
            } else {
                let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
                validPoints.forEach(pt => {
                    const lat = Array.isArray(pt.lat) ? pt.lat[0] : pt.lat;
                    const lon = Array.isArray(pt.lon) ? pt.lon[0] : pt.lon;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lon < minLon) minLon = lon;
                    if (lon > maxLon) maxLon = lon;
                });

                const latPadding = (maxLat - minLat) * 0.1 || 0.01;
                const lonPadding = (maxLon - minLon) * 0.1 || 0.01;

                mapRef.current?.fitBounds(
                    [
                        [minLon - lonPadding, minLat - latPadding],
                        [maxLon + lonPadding, maxLat + latPadding]
                    ],
                    { padding: 50, duration: 500, maxZoom: 14 }
                );
            }
        }
    }, [focusRiver?.id, isMapLoaded]);

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
                    } catch (_e: any) {
                        if (_e.name !== 'AbortError') console.debug("Basemap tile not found", _e);
                    }
                }

                // 2. Check offline downloaded states
                for (const pmtiles of activeOfflineInstances) {
                    try {
                        const tile = await pmtiles.getZxy(z, x, y, abortController.signal);
                        if (tile && tile.data) return { data: tile.data };
                    } catch (_e: any) {
                        if (_e.name !== 'AbortError') console.debug("Offline tile not found", _e);
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
                } catch (_e: any) {
                    if (_e.name !== 'AbortError') console.debug("Online tile fetch failed", _e);
                }

                throw new Error("Tile unavailable - offline or missing");
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
                    const mapRegions = downloaded.filter(d => d.hasMap).map(d => d.id);
                    for (const regionId of mapRegions) {
                        const source = await getOfflineMapSource(regionId);
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

                let baseStyle: any;
                try {
                    const res = await fetch("/local_style.json");
                    if (!res.ok) throw new Error("Style fetch failed");
                    baseStyle = await res.json();
                    // Cache the style for future offline use
                    await persistentStorage.set("offline_map_style", JSON.stringify(baseStyle)).catch(err => console.warn("Failed to cache map style", err));
                } catch (fetchErr) {
                    console.warn("Failed to fetch map style, trying cache:", fetchErr);
                    const cached = await persistentStorage.get("offline_map_style");
                    if (cached) {
                        try {
                            baseStyle = JSON.parse(cached);
                        } catch (parseErr) {
                            console.error("Failed to parse cached map style", parseErr);
                            throw fetchErr;
                        }
                    } else {
                        throw fetchErr; // Re-throw if no cache either
                    }
                }

                // Set the monolithic hybrid source
                baseStyle.sources.protomaps.url = undefined;
                baseStyle.sources.protomaps.tiles = ["hybrid://{z}/{x}/{y}"];
                baseStyle.sources.protomaps.minzoom = 0;
                baseStyle.sources.protomaps.maxzoom = 15;

                setDynamicStyle(baseStyle);
            } catch (e) {
                console.error("Failed to build dynamic map style:", e);
                // If we're on a native platform or offline, a missing style is fatal to the map.
                // We'll set it back to the string path as a last-resort fallback.
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

        try {
            if (map.style && map.isStyleLoaded()) {
                loadImages();
            } else {
                map.once('style.load', loadImages);
            }
        } catch (_e) {
            console.debug("Map style not ready for images", _e);
            map.once('style.load', loadImages);
        }

        const handleImageMissing = (e: any) => {
            const id = e.id;
            if (id && !map.hasImage(id)) {
                const match = id.match(/^([PTA])_(hsl\([^)]+\))_([0-9.]+)_(\d+)$/);
                if (match) {
                    const [, letter, fillColor, opacityStr] = match;
                    const { imageData, pixelRatio } = getCachedCanvasImage(letter, fillColor, parseFloat(opacityStr));
                    map.addImage(id, imageData, { pixelRatio });
                } else {
                    // Suppress warning with 1x1 transparent pixel
                    map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
                }
            }
        };

        map.on('styleimagemissing', handleImageMissing);

        return () => {
            map.off('styleimagemissing', handleImageMissing);
        };
    }, [nonGaugesGeoJson, dynamicStyle]); // Re-run when style loads

    const handleMapClick = React.useCallback((e: any) => {
        if (isPickingStart) {
            setPendingStartCoord([e.lngLat.lng, e.lngLat.lat]);
            return;
        }
        const feature = e.features && e.features[0];
        if (feature) {
            const isGauge = feature.layer.id === 'gauges-layer';
            const arr = isGauge ? gauges : nonGauges;
            const pt = arr[feature.properties.pointIndex];
            if (pt) handleStableMarkerClick(pt.river, pt.point, pt.lat, pt.lon);
        } else {
            setActivePopupData(null);
            setHoverPopupData(null);
            setShowUserLocationPopup(false);
        }
    }, [gauges, nonGauges, handleStableMarkerClick, isPickingStart]);

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

    // Manual start point (set via tap-on-map) takes priority over live GPS.
    const effectiveStartCoord: [number, number] | null = manualStartCoord
        ?? (location.longitude && location.latitude ? [location.longitude, location.latitude] : null);

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
                .custom-maplibre-popup .maplibregl-popup-content {
                    background-color: var(--surface);
                    color: var(--text);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .custom-maplibre-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
                    border-top-color: var(--surface);
                }
                .custom-maplibre-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip {
                    border-bottom-color: var(--surface);
                }
                .custom-maplibre-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
                    border-right-color: var(--surface);
                }
                .custom-maplibre-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
                    border-left-color: var(--surface);
                }
                /* Balances the left Filter button so the search bar centers truly —
                   only on wider screens. On phones it collapses to 0 so the search
                   bar keeps its full width. Width matches the Filter button (85px). */
                .map-top-spacer { flex-shrink: 0; width: 0; }
                @media (min-width: 850px) { .map-top-spacer { width: 85px; } }
                `}
            </style>
            {/* Top control row: Filter (left) + Search (centered, fills remaining space).
                Single flex row so the two can never overlap — the search bar shrinks instead. */}
            <div style={{
                position: "absolute",
                top: isFullScreen ? "calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" : "10px",
                left: isFullScreen ? "calc(10px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)))" : "10px",
                right: isFullScreen ? "calc(10px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)))" : "10px",
                zIndex: 1500, // above map controls; below river popups
                display: "flex",
                alignItems: "flex-start", // keep Filter pinned to top when the search dropdown expands
                gap: "10px",
                pointerEvents: "none", // let map gestures through the empty gaps; children re-enable
            }}>
                {/* Fixed-width wrapper so the floating count badge never shifts the
                    balanced top-row layout. */}
                <div style={{ position: "relative", flexShrink: 0, pointerEvents: "auto" }}>
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        aria-label={filtersActive ? `Filter (${mapFilterCount} active)` : "Filter"}
                        style={{
                            padding: "8px 12px",
                            width: "85px",
                            backgroundColor: filtersActive ? "var(--primary)" : "var(--surface)",
                            color: filtersActive ? "#ffffff" : "var(--text)",
                            border: filtersActive ? "2px solid var(--primary)" : "2px solid var(--border)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Filter
                    </button>
                    {filtersActive && (
                        <span
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                top: "-7px",
                                right: "-7px",
                                minWidth: "20px",
                                height: "20px",
                                padding: "0 5px",
                                boxSizing: "border-box",
                                borderRadius: "10px",
                                backgroundColor: "var(--surface)",
                                color: "var(--primary)",
                                border: "2px solid var(--primary)",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                lineHeight: "16px",
                                textAlign: "center",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                            }}
                        >
                            {mapFilterCount}
                        </span>
                    )}
                </div>

                {/* Search — hidden on mini map unless fullscreen. Fills remaining space,
                    centered within it and capped at maxWidth inside MapSearchbar. */}
                {(!hideSearchBar || isFullScreen) && (
                    <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
                        <MapSearchbar
                            onSelect={(res) => {
                                setPinnedPlace(res);
                                mapRef.current?.flyTo({ center: [res.lon, res.lat], zoom: Math.max(mapZoom, 13), duration: 800 });
                            }}
                        />
                    </div>
                )}

                {/* Invisible spacer: balances the Filter button so the search bar
                    centers on desktop (≥600px); collapses to 0 on mobile. */}
                {(!hideSearchBar || isFullScreen) && (
                    <div className="map-top-spacer" aria-hidden="true" />
                )}
            </div>

            {/* Bottom Right Controls: Share & Fullscreen */}
            <div style={{
                position: "absolute",
                bottom: isFullScreen ? "calc(30px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" : "30px",
                right: isFullScreen ? "calc(10px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)))" : "10px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: "10px"
            }}>
                <button
                    onClick={() => setIsShareOpen(true)}
                    aria-label="Share Map"
                    style={{
                        padding: "10px",
                        backgroundColor: "var(--primary)",
                        color: "var(--surface)",
                        border: "2px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px"
                    }}
                >
                    🔗
                </button>
                <button
                    onClick={toggleFullScreen}
                    aria-label="Toggle Fullscreen"
                    style={{
                        padding: "10px",
                        backgroundColor: "var(--surface)",
                        color: "var(--text)",
                        border: "2px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px"
                    }}
                >
                    {isFullScreen ? "↖" : "⤢"}
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

            {isNavigating && !isAutoCenter && (
                <button
                    onClick={() => setIsAutoCenter(true)}
                    style={{
                        position: "absolute",
                        bottom: isFullScreen ? "calc(100px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" : "100px",
                        right: isFullScreen ? "calc(10px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)))" : "10px",
                        zIndex: 2000,
                        padding: "10px 16px",
                        backgroundColor: "var(--primary)",
                        color: "var(--surface)",
                        border: "2px solid var(--border)",
                        borderRadius: "20px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                    }}
                >
                    📍 Re-center
                </button>
            )}

            <Map
                ref={mapRef}
                {...viewState}
                onLoad={() => setIsMapLoaded(true)}
                onDragStart={() => {
                    if (isNavigating) setIsAutoCenter(false);
                }}
                onMove={evt => {
                    setViewState(evt.viewState);
                    setMapCenter([evt.viewState.latitude, evt.viewState.longitude]);
                    setMapZoom(evt.viewState.zoom);
                }}
                mapStyle={dynamicStyle}
                style={{ width: "100%", height: "100%", cursor: isPickingStart ? "crosshair" : undefined }}
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
                                "circle-radius": [
                                    "case",
                                    ["==", ["get", "riverId"], focusRiver?.id || selectedRiver?.id || ""], 10.125, // 50% bigger than 6.75
                                    6.75
                                ],
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
                                "icon-offset": [0, -20],
                                "icon-size": [
                                    "case",
                                    ["==", ["get", "riverId"], focusRiver?.id || selectedRiver?.id || ""], 1.5,
                                    1.0
                                ]
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
                            closeButton={true}
                            closeOnClick={true}
                            className="custom-maplibre-popup"
                        >
                            <PopupEventManager
                                isHoverMode={isHoverMode}
                                onEnter={handlePopupMouseEnter}
                                onLeave={handlePopupMouseLeave}
                            >
                                <strong>{accessName}</strong>
                                <br />
                                {thePopupData!.river.name} {thePopupData!.river.section ? `(${thePopupData!.river.section})` : ""}<br />
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
                                    {Capacitor.getPlatform() === 'ios' ? (
                                        <>
                                            <a
                                                href={`maps://?daddr=${thePopupData!.lat},${thePopupData!.lon}&dirflg=d`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ display: "inline-block", fontWeight: "bold" }}
                                            >
                                                Apple Maps <span style={{ fontSize: "0.8em" }}>↗</span>
                                            </a>
                                            <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${thePopupData!.lat},${thePopupData!.lon}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ display: "inline-block", fontWeight: "bold" }}
                                            >
                                                Google Maps <span style={{ fontSize: "0.8em" }}>↗</span>
                                            </a>
                                        </>
                                    ) : (
                                        <a
                                            href={
                                                Capacitor.getPlatform() === 'android'
                                                    ? `geo:0,0?q=${thePopupData!.lat},${thePopupData!.lon}(${encodeURIComponent(accessName)})`
                                                    : `https://www.google.com/maps/dir/?api=1&destination=${thePopupData!.lat},${thePopupData!.lon}`
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ display: "inline-block", fontWeight: "bold" }}
                                        >
                                            Google Maps <span style={{ fontSize: "0.8em" }}>↗</span>
                                        </a>
                                    )}
                                </div>
                            </PopupEventManager>
                        </Popup>
                    );
                })()}

                {/* Local User Physical GPS Position Marker */}
                {location.latitude && location.longitude && (
                    <>
                        <Marker
                            longitude={location.longitude}
                            latitude={location.latitude}
                            anchor="center"
                            onClick={(e) => {
                                e.originalEvent.stopPropagation();
                                setShowUserLocationPopup(true);
                            }}
                        >
                            <div
                                title={`Your Current Location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
                                style={{
                                    width: 14,
                                    height: 14,
                                    backgroundColor: "#3b82f6",
                                    border: "2px solid #ffffff",
                                    borderRadius: "50%",
                                    boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                                    cursor: "pointer"
                                }}
                            />
                        </Marker>

                        {showUserLocationPopup && (
                            <Popup
                                longitude={location.longitude}
                                latitude={location.latitude}
                                closeOnClick={true}
                                closeButton={true}
                                onClose={() => setShowUserLocationPopup(false)}
                                anchor="bottom"
                                offset={[0, -10]}
                                style={{ zIndex: 1500 }}
                                className="custom-maplibre-popup"
                            >
                                <div style={{ padding: "4px 8px", textAlign: "center", color: "var(--text)" }}>
                                    <strong>Your Location</strong><br />
                                    <span style={{ fontSize: "0.9em", color: "var(--text-secondary)" }}>
                                        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                                    </span>
                                </div>
                            </Popup>
                        )}
                    </>
                )}

                {/* Distance Radius Circle */}
                {radiusCircleData && (
                    <Source
                        id="radius-circle"
                        type="geojson"
                        data={radiusCircleData}
                    >
                        <Layer
                            id="radius-circle-layer-fill"
                            type="fill"
                            source="radius-circle"
                            paint={{
                                "fill-color": "#3b82f6",
                                "fill-opacity": 0.1
                            }}
                        />
                        <Layer
                            id="radius-circle-layer-line"
                            type="line"
                            source="radius-circle"
                            paint={{
                                "line-color": "#3b82f6",
                                "line-width": 2
                            }}
                        />
                    </Source>
                )}
                {/* Navigation Route Path */}
                {navRoute && (
                    <Source
                        id="navigation-route"
                        type="geojson"
                        data={{ type: "Feature", geometry: navRoute, properties: {} }}
                    >
                        <Layer
                            id="navigation-route-layer"
                            type="line"
                            paint={{
                                "line-color": "#3b82f6",
                                "line-width": 5,
                                "line-opacity": 0.8
                            }}
                            layout={{
                                "line-join": "round",
                                "line-cap": "round"
                            }}
                        />
                    </Source>
                )}

                {/* Navigation Destination Dot — shown for pinned place or active navigation */}
                {(navDestination && isNavigating) || pinnedPlace ? (
                    <Source
                        id="navigation-destination"
                        type="geojson"
                        data={{
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: isNavigating && navDestination ? navDestination : [pinnedPlace!.lon, pinnedPlace!.lat]
                            },
                            properties: {}
                        }}
                    >
                        <Layer
                            id="navigation-destination-layer-halo"
                            type="circle"
                            paint={{
                                "circle-radius": 10,
                                "circle-color": "#ffffff",
                                "circle-opacity": 0.5
                            }}
                        />
                        <Layer
                            id="navigation-destination-layer"
                            type="circle"
                            paint={{
                                "circle-radius": 6,
                                "circle-color": "#ef4444",
                                "circle-stroke-width": 2,
                                "circle-stroke-color": "#ffffff"
                            }}
                        />
                    </Source>
                ) : null}

                {/* Pending manual start point — dropped while picking, awaiting confirmation */}
                {pendingStartCoord && (
                    <Marker longitude={pendingStartCoord[0]} latitude={pendingStartCoord[1]} anchor="bottom">
                        <div style={{ fontSize: "32px", lineHeight: 1, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" }}>📍</div>
                    </Marker>
                )}
            </Map>

            {/* Tap-to-set-start-point flow */}
            {isPickingStart && (
                <div style={{
                    position: "absolute",
                    bottom: isFullScreen ? "calc(24px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" : "24px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1600,
                    backgroundColor: "var(--surface)",
                    color: "var(--text)",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    maxWidth: "90vw",
                }}>
                    <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>
                        {pendingStartCoord ? "Set this as your starting point?" : "📍 Tap the map to set your starting point"}
                    </span>
                    {pendingStartCoord && (
                        <button
                            onClick={() => {
                                setManualStartCoord(pendingStartCoord);
                                setIsPickingStart(false);
                                setPendingStartCoord(null);
                            }}
                            style={{ padding: "6px 14px", backgroundColor: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                            Confirm
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setIsPickingStart(false);
                            setPendingStartCoord(null);
                        }}
                        style={{ padding: "6px 14px", backgroundColor: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            <NavigationPanel
                isOpen={isNavigating}
                onClose={() => {
                    setIsNavigating(false);
                    setPinnedPlace(null);
                    setNavDestination(null);
                    setNavDestinationPlace(null);
                    setNavRoute(null);
                    setManualStartCoord(null);
                    setIsPickingStart(false);
                    setPendingStartCoord(null);
                }}
                startCoord={effectiveStartCoord}
                isManualStart={manualStartCoord !== null}
                onRequestManualStart={() => setIsPickingStart(true)}
                onUseCurrentLocation={() => {
                    setManualStartCoord(null);
                    location.requestLocation();
                }}
                locationLoading={location.loading}
                locationError={location.error}
                endCoord={navDestination}
                destinationRiver={selectedRiver}
                destinationPlace={navDestinationPlace}
                onRouteCalculated={handleRouteCalculated}
            />

            {/* Pinned Place Card — shown after search result selection, before navigation starts */}
            {pinnedPlace && !isNavigating && (
                <div style={{
                    position: "absolute",
                    top: isFullScreen
                        ? "calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))"
                        : "60px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "calc(100% - 50px - 100px - 10px - 10px)",
                    maxWidth: "400px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                    border: "1px solid var(--border)",
                    padding: "12px 14px",
                    zIndex: 2000,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                }}>
                    <span style={{ fontSize: "20px", flexShrink: 0 }}>
                        {pinnedPlace.type === "river" ? "🌊" : "📍"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "var(--text)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}>
                            {pinnedPlace.name}
                        </div>
                        {pinnedPlace.description && (
                            <div style={{
                                fontSize: "11px",
                                color: "var(--text-muted, #888)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: "1px",
                            }}>
                                {pinnedPlace.description}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            setNavDestination([pinnedPlace.lon, pinnedPlace.lat]);
                            setNavDestinationPlace(pinnedPlace);
                            setIsNavigating(true);
                        }}
                        style={{
                            flexShrink: 0,
                            backgroundColor: "var(--primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            fontWeight: 600,
                            fontSize: "12px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                        }}
                    >
                        🧭 Navigate
                    </button>
                    <button
                        onClick={() => setPinnedPlace(null)}
                        style={{
                            flexShrink: 0,
                            background: "none",
                            border: "none",
                            fontSize: "18px",
                            color: "var(--text-muted, #888)",
                            cursor: "pointer",
                            padding: "4px",
                            lineHeight: 1,
                        }}
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Universally Injected Selected River Sidebar — hidden while navigating so it can't
                overlap the centered NavigationPanel; reappears automatically when nav closes. */}
            {selectedRiver && !isNavigating && (
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
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setNavDestinationPlace(null);
                                        setNavDestination([selectedAccessPoint.lon as number, selectedAccessPoint.lat as number]);
                                        setIsNavigating(true);
                                    }}
                                    style={{ display: "inline-block", backgroundColor: "var(--primary)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontWeight: "bold", textDecoration: "none", border: "none", cursor: "pointer", marginBottom: "8px" }}
                                >
                                    🧭 Navigate Offline
                                </button>
                                <br />
                                {Capacitor.getPlatform() === 'ios' ? (
                                    <>
                                        <a
                                            href={`maps://?daddr=${selectedAccessPoint.lat},${selectedAccessPoint.lon}&dirflg=d`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ display: "inline-block", backgroundColor: "transparent", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 12px", borderRadius: "8px", fontWeight: "bold", textDecoration: "none", marginRight: "8px" }}
                                        >
                                            📍 Apple Maps
                                        </a>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedAccessPoint.lat},${selectedAccessPoint.lon}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ display: "inline-block", backgroundColor: "transparent", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 12px", borderRadius: "8px", fontWeight: "bold", textDecoration: "none" }}
                                        >
                                            📍 Google Maps
                                        </a>
                                    </>
                                ) : (
                                    <a
                                        href={
                                            Capacitor.getPlatform() === 'android'
                                                ? `geo:0,0?q=${selectedAccessPoint.lat},${selectedAccessPoint.lon}(${encodeURIComponent(formatAccessName(selectedAccessPoint))})`
                                                : `https://www.google.com/maps/dir/?api=1&destination=${selectedAccessPoint.lat},${selectedAccessPoint.lon}`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ display: "inline-block", backgroundColor: "transparent", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 12px", borderRadius: "8px", fontWeight: "bold", textDecoration: "none" }}
                                    >
                                        📍 Google Maps
                                    </a>
                                )}
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
