import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoutingRequest, RoutingResponse, RoutingInstruction, RoutingSummary } from '../workers/valhallaRoutingTypes';
import { getDownloadedRegions, fetchMapRegions, downloadMapRegion, type MapRegion } from '../utils/offlineMapEngine';

interface NavigationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    startCoord: [number, number] | null; // [lng, lat]
    endCoord: [number, number] | null;   // [lng, lat]
    destinationRiver?: import('../types/River').RiverData | null;
    destinationPlace?: import('./MapSearchbar').MapSearchResult | null;
    onRouteCalculated: (route: GeoJSON.LineString | null) => void;
}

/** Round coords to 4 decimal places (~11m precision) to avoid re-routing on tiny GPS jitters */
function coordKey(coord: [number, number] | null): string {
    if (!coord) return '';
    return `${coord[0].toFixed(4)},${coord[1].toFixed(4)}`;
}

/** Format distance in miles, using feet for very short distances */
function formatDistance(miles: number): string {
    if (miles < 0.01) return '';
    if (miles < 0.1) {
        const feet = Math.round(miles * 5280);
        return `${feet.toLocaleString()} ft`;
    }
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
}

/** Format time in human-friendly units */
function formatTime(seconds: number): string {
    if (seconds < 60) return 'less than 1 min';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (remainMins === 0) return `${hours} hr`;
    return `${hours} hr ${remainMins} min`;
}

/**
 * Valhalla maneuver type → emoji icon
 * See: https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/#maneuver-types
 */
function maneuverIcon(type: number): string {
    switch (type) {
        case 0:  return '🏁';  // None / Destination
        case 1:  return '⬆️';  // Start
        case 2:  return '⬆️';  // Start right
        case 3:  return '⬆️';  // Start left
        case 4:  return '🏁';  // Destination
        case 5:  return '🏁';  // Destination right
        case 6:  return '🏁';  // Destination left
        case 7:  return '⬆️';  // Becomes
        case 8:  return '⬆️';  // Continue
        case 9:  return '↗️';  // Slight right
        case 10: return '➡️';  // Right
        case 11: return '↘️';  // Sharp right
        case 12: return '↩️';  // U-turn right
        case 13: return '↩️';  // U-turn left
        case 14: return '↙️';  // Sharp left
        case 15: return '⬅️';  // Left
        case 16: return '↖️';  // Slight left
        case 17: return '⬆️';  // Ramp straight
        case 18: return '↗️';  // Ramp right
        case 19: return '↖️';  // Ramp left
        case 20: return '↗️';  // Exit right
        case 21: return '↖️';  // Exit left
        case 22: return '⬆️';  // Stay straight
        case 23: return '↗️';  // Stay right
        case 24: return '↖️';  // Stay left
        case 25: return '🔀';  // Merge
        case 26: return '🛣️';  // Roundabout enter
        case 27: return '🛣️';  // Roundabout exit
        case 28: return '⛴️';  // Ferry enter
        case 29: return '⛴️';  // Ferry exit
        default: return '⬆️';
    }
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({ isOpen, onClose, startCoord, endCoord, destinationRiver, destinationPlace, onRouteCalculated }) => {
    const [instructions, setInstructions] = useState<RoutingInstruction[]>([]);
    const [summary, setSummary] = useState<RoutingSummary | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [progressText, setProgressText] = useState('Computing route…');
    const [missingData, setMissingData] = useState(false);
    const [missingRegions, setMissingRegions] = useState<MapRegion[]>([]);
    const [downloadProgress, setDownloadProgress] = useState<{ [id: string]: number }>({});
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const navigate = useNavigate();
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);       // Monotonic counter to discard stale responses
    const lastCoordsRef = useRef('');      // Track last routed coordinates

    const calculateRoute = useCallback(async (start: [number, number], end: [number, number]) => {
        // Skip if coordinates haven't meaningfully changed
        const key = `${coordKey(start)}-${coordKey(end)}`;
        if (key === lastCoordsRef.current) return;
        lastCoordsRef.current = key;

        const thisRequestId = ++requestIdRef.current;
        setIsCalculating(true);
        setProgressText('Preparing…');
        setError(null);
        setMissingData(false);

        try {
            const downloaded = await getDownloadedRegions();
            const routingRegions = downloaded.filter(r => r.hasRouting).map(r => r.id);

            if (routingRegions.length === 0) {
                setMissingData(true);
                setIsCalculating(false);
                
                try {
                    const allRegions = await fetchMapRegions();
                    const requiredIds: string[] = [];
                    
                    if (destinationRiver?.states) {
                        const states = destinationRiver.states.split(',').map(s => s.trim().toUpperCase());
                        for (const s of states) {
                            requiredIds.push(`US-${s}`);
                        }
                    } else if (destinationPlace?.description) {
                        const desc = destinationPlace.description;
                        for (const r of allRegions) {
                            const abbrev = r.id.replace('US-', '');
                            if (desc.includes(r.name)) {
                                requiredIds.push(r.id);
                            } else {
                                const regex = new RegExp(`\\b${abbrev}\\b`, 'i');
                                if (regex.test(desc)) {
                                    requiredIds.push(r.id);
                                }
                            }
                        }
                    }
                    
                    // Filter down to unique ones
                    const uniqueRequired = Array.from(new Set(requiredIds));
                    setMissingRegions(allRegions.filter(r => uniqueRequired.includes(r.id)));
                } catch (err) {
                    console.error("Failed to fetch regions for missing map prompt", err);
                }
                
                return;
            }

            // Initialize worker if needed
            if (!workerRef.current) {
                const workerUrl = new URL('../workers/valhallaRouting.worker.ts', import.meta.url);
                workerRef.current = new Worker(workerUrl.toString() + '?t=' + Date.now());
            }

            const request: RoutingRequest = { start, end, regions: routingRegions };
            console.log(`[NavigationPanel] Sending routing request to worker:`, request);

            workerRef.current.onmessage = (e: MessageEvent<RoutingResponse>) => {
                // Discard if a newer request has been sent
                if (thisRequestId !== requestIdRef.current) return;

                // Handle progress updates (intermediate messages before final result)
                if (e.data.progress) {
                    setProgressText(e.data.progress);
                    return;
                }

                setIsCalculating(false);
                if (e.data.success && e.data.geometry) {
                    onRouteCalculated(e.data.geometry);
                    setInstructions(e.data.instructions || []);
                    setSummary(e.data.summary || null);
                } else {
                    setError(e.data.error || "Failed to calculate route.");
                }
            };

            workerRef.current.postMessage(request);
        } catch (err: any) {
            if (thisRequestId !== requestIdRef.current) return;
            setError("Storage error: " + err.message);
            setIsCalculating(false);
        }
    }, [onRouteCalculated, destinationRiver, destinationPlace]);

    const cancelRouting = useCallback(() => {
        if (workerRef.current) {
            // Terminate the worker thread immediately to stop WASM execution
            workerRef.current.terminate();
            workerRef.current = null;
        }
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setIsCalculating(false);
        setError("Navigation cancelled.");
        setInstructions([]);
        setSummary(null);
        onRouteCalculated(null);
    }, [onRouteCalculated]);

    useEffect(() => {
        if (!isOpen) {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            onRouteCalculated(null);
            setInstructions([]);
            setSummary(null);
            setError(null);
            setIsCalculating(false);
            lastCoordsRef.current = '';
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            return;
        }

        if (startCoord && endCoord) {
            // Debounce: wait 500ms after the last coord change before routing
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                calculateRoute(startCoord, endCoord);
            }, 500);
        } else {
            setError("Missing start or end coordinates.");
        }
    }, [isOpen, coordKey(startCoord), coordKey(endCoord), calculateRoute]);

    // Reset missing data if the panel is closed
    useEffect(() => {
        if (!isOpen) {
            setMissingData(false);
        }
    }, [isOpen]);

    const handleDownloadMissing = async () => {
        setIsDownloading(true);
        setError(null);
        for (const region of missingRegions) {
            try {
                await downloadMapRegion(region, { downloadMap: true, downloadRouting: true }, (progress) => {
                    setDownloadProgress(prev => ({ ...prev, [region.id]: progress }));
                });
            } catch (err: any) {
                setError(`Failed to download ${region.name}: ${err.message}`);
                setIsDownloading(false);
                return;
            }
        }
        setIsDownloading(false);
        setMissingData(false);
        setMissingRegions([]);
        setDownloadProgress({});
        // Re-trigger route calculation
        if (startCoord && endCoord) {
            calculateRoute(startCoord, endCoord);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '80px',
            left: '12px',
            right: '12px',
            backgroundColor: 'var(--surface, #fff)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            zIndex: 1100,
            maxHeight: isExpanded ? '50vh' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--text, #1a1a1a)',
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '14px 16px 10px',
                borderBottom: (summary && isExpanded) ? '1px solid var(--border, #e0e0e0)' : 'none',
                cursor: 'pointer',
            }} onClick={() => setIsExpanded(!isExpanded)}>
                <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
                    {instructions.length > 0 && !isExpanded ? (
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                            {/* Left Side: Current Road, Next Turn, Distance */}
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '12px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #666)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {instructions[0].text}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ fontSize: '22px' }}>{instructions.length > 1 ? maneuverIcon(instructions[1].type) : maneuverIcon(instructions[0].type)}</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {instructions.length > 1 ? instructions[1].text : "Arrive at destination"}
                                    </span>
                                </div>
                                <span style={{ color: 'var(--primary, #2563eb)', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                                    {formatDistance(instructions[0].distance)}
                                </span>
                            </div>
                            
                            {/* Right Side: Remaining Distance & Time */}
                            {summary && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{formatDistance(summary.distance)}</span>
                                    <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>{formatTime(summary.time)}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🧭</span>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Navigation</span>
                        </div>
                    )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
                    {(instructions.length > 0 || isCalculating || error || missingData) && (
                        <div style={{ color: 'var(--text-muted, #888)', fontSize: '14px', marginTop: instructions.length > 0 && !isExpanded ? '4px' : '0' }}>
                            {isExpanded ? '▲' : '▼'}
                        </div>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        aria-label="Close navigation"
                        style={{
                            background: 'none', border: 'none', fontSize: '20px',
                            cursor: 'pointer', color: 'var(--text-muted, #888)',
                            padding: '4px 6px', borderRadius: '6px', lineHeight: 1,
                            marginTop: instructions.length > 0 && !isExpanded ? '2px' : '0'
                        }}
                    >✕</button>
                </div>
            </div>

            {/* Content (only visible if expanded) */}
            {isExpanded && (
                <>
                    {/* Trip Summary */}
                    {summary && !isCalculating && !error && (
                        <div style={{
                            display: 'flex', gap: '20px', padding: '12px 16px',
                            backgroundColor: 'var(--surface-variant, #f5f5f5)',
                            borderBottom: '1px solid var(--border, #e0e0e0)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '16px' }}>🚗</span>
                                <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{formatDistance(summary.distance)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '16px' }}>⏱️</span>
                                <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{formatTime(summary.time)}</span>
                            </div>
                        </div>
                    )}

            {/* Loading State */}
            {isCalculating && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 16px', color: 'var(--text-muted, #666)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            border: '3px solid var(--border, #ddd)',
                            borderTopColor: 'var(--primary, #2563eb)',
                            animation: 'nav-spin 0.8s linear infinite',
                        }} />
                        <span>{progressText}</span>
                    </div>
                    <button 
                        onClick={cancelRouting}
                        style={{
                            background: 'none', border: '1px solid var(--border, #ccc)',
                            padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem',
                            cursor: 'pointer', color: 'var(--text, #333)'
                        }}
                    >
                        Cancel
                    </button>
                    <style>{`@keyframes nav-spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            )}

            {/* Missing Data */}
            {missingData && (
                <div style={{ textAlign: 'center', padding: '20px 16px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗺️</div>
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>Maps Required</div>
                    <div style={{ fontSize: '0.9em', color: 'var(--text-muted, #666)', marginBottom: '16px' }}>
                        Offline navigation requires downloaded maps with routing data.
                    </div>
                    {missingRegions.length > 0 ? (
                        <div style={{ marginBottom: '16px', textAlign: 'left', backgroundColor: 'var(--surface-variant, #f5f5f5)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.9em' }}>Missing Regions:</div>
                            {missingRegions.map(r => {
                                const prog = downloadProgress[r.id] || 0;
                                return (
                                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85em', marginBottom: '4px' }}>
                                        <span>{r.name}</span>
                                        {prog > 0 ? (
                                            <span style={{ color: 'var(--primary, #2563eb)' }}>{Math.round(prog * 100)}%</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted, #888)' }}>{r.estimatedSizeMB + (r.routingSizeMB || 0)} MB</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    {isDownloading ? (
                        <div style={{ color: 'var(--primary, #2563eb)', fontWeight: 600, fontSize: '0.95rem' }}>Downloading... Please wait.</div>
                    ) : missingRegions.length > 0 ? (
                        <button
                            onClick={handleDownloadMissing}
                            style={{
                                padding: '10px 20px', backgroundColor: 'var(--primary, #2563eb)',
                                color: '#fff', border: 'none', borderRadius: '8px',
                                fontWeight: 600, cursor: 'pointer', width: '100%', fontSize: '0.95rem',
                            }}
                        >Download Maps</button>
                    ) : (
                        <button
                            onClick={() => navigate('/settings#offline-maps')}
                            style={{
                                padding: '10px 20px', backgroundColor: 'var(--primary, #2563eb)',
                                color: '#fff', border: 'none', borderRadius: '8px',
                                fontWeight: 600, cursor: 'pointer', width: '100%', fontSize: '0.95rem',
                            }}
                        >Manage Offline Maps</button>
                    )}
                </div>
            )}

            {/* Error */}
            {error && !missingData && (
                <div style={{
                    padding: '14px 16px', color: '#dc2626',
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                }}>
                    <span>⚠️</span>
                    <span style={{ fontSize: '0.9rem' }}>{error}</span>
                </div>
            )}

            {/* Turn-by-Turn Instructions */}
            {!isCalculating && !missingData && !error && instructions.length > 0 && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {instructions.map((inst, i) => {
                        const isFirst = i === 0;
                        const isLast = i === instructions.length - 1;
                        const distStr = formatDistance(inst.distance);
                        const timeStr = inst.time >= 60 ? formatTime(inst.time) : '';
                        return (
                            <div key={i} style={{
                                display: 'flex', gap: '12px', padding: '10px 16px',
                                borderBottom: isLast ? 'none' : '1px solid var(--border, #eee)',
                                alignItems: 'flex-start',
                                backgroundColor: (isFirst || isLast) ? 'var(--surface-variant, #fafafa)' : 'transparent',
                            }}>
                                {/* Maneuver Icon */}
                                <div style={{
                                    fontSize: '18px', width: '28px', height: '28px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, marginTop: '1px',
                                }}>
                                    {maneuverIcon(inst.type)}
                                </div>

                                {/* Instruction Text + Distance */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '0.92rem', lineHeight: 1.35,
                                        fontWeight: (isFirst || isLast) ? 600 : 400,
                                    }}>{inst.text}</div>
                                    {(distStr || timeStr) && (
                                        <div style={{
                                            fontSize: '0.8rem', color: 'var(--text-muted, #888)',
                                            marginTop: '2px', display: 'flex', gap: '8px',
                                        }}>
                                            {distStr && <span>{distStr}</span>}
                                            {distStr && timeStr && <span>·</span>}
                                            {timeStr && <span>{timeStr}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </>
            )}
        </div>
    );
};
