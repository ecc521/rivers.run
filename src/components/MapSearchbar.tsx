import React, { useState, useEffect, useRef } from 'react';
import { useRivers } from "../hooks/useRivers";

export interface MapSearchResult {
    type: 'river' | 'place';
    name: string;
    description: string;
    lat: number;
    lon: number;
    riverId?: string;
}

interface MapSearchbarProps {
    onSelect: (result: MapSearchResult) => void;
}

export const MapSearchbar: React.FC<MapSearchbarProps> = ({ onSelect }) => {
    const { rivers } = useRivers();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MapSearchResult[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const q = query.toLowerCase().trim();
        let active = true;

        const performSearch = async () => {
            const combinedResults: MapSearchResult[] = [];

            // 1. Search Local Rivers
            if (rivers && rivers.length > 0) {
                const queryWords = q.split(/\s+/).filter(w => w.length > 0);

                const matchedRivers = rivers.filter((r: any) => {
                    const fullName = `${r.name || ''} ${r.section || ''}`.toLowerCase();
                    // Ensure every word in the query appears somewhere in the name or section
                    return queryWords.every(word => fullName.includes(word));
                }).sort((a: any, b: any) => {
                    const aName = `${a.name || ''} ${a.section || ''}`.toLowerCase();
                    const bName = `${b.name || ''} ${b.section || ''}`.toLowerCase();
                    
                    // 1. Exact match
                    if (aName === q && bName !== q) return -1;
                    if (bName === q && aName !== q) return 1;

                    // 2. Starts with query
                    const aStarts = aName.startsWith(q) ? 1 : 0;
                    const bStarts = bName.startsWith(q) ? 1 : 0;
                    if (aStarts !== bStarts) return bStarts - aStarts;

                    // 3. Shorter length (closer match)
                    return aName.length - bName.length;
                }).slice(0, 30); // Show up to 30 river results

                for (const r of matchedRivers) {
                    if (r.accessPoints && r.accessPoints.length > 0) {
                        const pt = r.accessPoints[0];
                        const lat = Array.isArray(pt.lat) ? pt.lat[0] : pt.lat;
                        const lon = Array.isArray(pt.lon) ? pt.lon[0] : pt.lon;
                        if (lat && lon) {
                            combinedResults.push({
                                type: 'river',
                                name: r.name,
                                description: r.section || 'River',
                                lat: typeof lat === 'string' ? parseFloat(lat) : lat,
                                lon: typeof lon === 'string' ? parseFloat(lon) : lon,
                                riverId: r.id
                            });
                        }
                    }
                }
            }

            // 2. Search OSM Places via Photon (online only)
            if (navigator.onLine) {
                try {
                    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.features) {
                            for (const f of data.features) {
                                const p = f.properties;
                                const descriptionParts = [];
                                if (p.city || p.town || p.county) descriptionParts.push(p.city || p.town || p.county);
                                if (p.state) descriptionParts.push(p.state);
                                if (p.country) descriptionParts.push(p.country);

                                combinedResults.push({
                                    type: 'place',
                                    name: p.name || 'Unknown Place',
                                    description: descriptionParts.join(', '),
                                    lat: f.geometry.coordinates[1],
                                    lon: f.geometry.coordinates[0]
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Photon API search failed. Probably offline.", e);
                }
            }

            if (active) {
                setResults(combinedResults);
            }
        };

        // Debounce
        const timer = setTimeout(performSearch, 300);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [query, rivers]);

    return (
        <div ref={containerRef} style={{
            position: 'absolute',
            top: 'calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '400px',
            zIndex: 3000, // Above everything
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--surface, #fff)',
                borderRadius: '24px',
                padding: '8px 16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid var(--border, #eee)',
            }}>
                <span style={{ marginRight: '8px', fontSize: '18px', color: 'var(--text-muted, #888)' }}>🔍</span>
                <input 
                    type="text" 
                    placeholder="Search places or rivers..." 
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    style={{
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        width: '100%',
                        fontSize: '16px',
                        color: 'var(--text, #333)',
                    }}
                />
                {query && (
                    <button 
                        onClick={() => { setQuery(''); setResults([]); }}
                        style={{
                            background: 'none', border: 'none', fontSize: '16px',
                            cursor: 'pointer', color: 'var(--text-muted, #888)'
                        }}
                    >✕</button>
                )}
            </div>

            {isFocused && results.length > 0 && (
                <div style={{
                    marginTop: '8px',
                    backgroundColor: 'var(--surface, #fff)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    overflow: 'hidden',
                    maxHeight: '50vh',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {results.map((r, i) => (
                        <div 
                            key={i} 
                            onClick={() => {
                                setIsFocused(false);
                                setQuery('');
                                onSelect(r);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: i < results.length - 1 ? '1px solid var(--border, #eee)' : 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover, #f5f5f5)'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{ fontSize: '20px', marginRight: '12px', width: '24px', textAlign: 'center' }}>
                                {r.type === 'river' ? '🌊' : '📍'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ 
                                    fontWeight: 600, 
                                    color: 'var(--text, #333)',
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis' 
                                }}>
                                    {r.name}
                                </div>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: 'var(--text-muted, #888)',
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis'
                                }}>
                                    {r.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
