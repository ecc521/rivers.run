import type { GaugeSite } from '../services/provider';

export interface LatLon { lat: number; lon: number }

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
export function distanceM(a: LatLon, b: LatLon): number {
    const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Grid cell size in degrees; at least a kilometer, so a neighboring-cell scan covers any radius up to that. */
const CELL_DEG = 0.01;
const cellOf = (p: LatLon) => `${Math.floor(p.lat / CELL_DEG)},${Math.floor(p.lon / CELL_DEG)}`;

/**
 * Whether a point is within `radiusM` of any of a fixed set, for sets of many thousands.
 * Radii above about a kilometer are not supported.
 */
export function buildProximityIndex(points: LatLon[]): (p: LatLon, radiusM: number) => boolean {
    const cells = new Map<string, LatLon[]>();
    for (const q of points) {
        const key = cellOf(q);
        const bucket = cells.get(key);
        if (bucket) bucket.push(q); else cells.set(key, [q]);
    }
    return (p, radiusM) => {
        const row = Math.floor(p.lat / CELL_DEG);
        const col = Math.floor(p.lon / CELL_DEG);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (cells.get(`${row + dr},${col + dc}`)?.some(q => distanceM(p, q) <= radiusM)) return true;
            }
        }
        return false;
    };
}

/** Radius within which a gauge is taken to be one another network already shows. */
export const COVERED_RADIUS_M = 300;

/** Sites with no site from `others` within COVERED_RADIUS_M. */
export function dropCoveredSites(sites: GaugeSite[], others: LatLon[]): GaugeSite[] {
    const isNearOther = buildProximityIndex(others);
    return sites.filter(site => !isNearOther(site, COVERED_RADIUS_M));
}
