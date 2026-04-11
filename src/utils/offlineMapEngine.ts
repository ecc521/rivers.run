// Map tile calculation based on standard OSM Slippy Math (EPSG:3857)

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

// World Bounds
export const WORLD_BOUNDS: BoundingBox = {
    minLat: -85.0511,
    maxLat: 85.0511,
    minLon: -180,
    maxLon: 180
};

// North America Bounds (Roughly captures Alaska + Hawaii + Lower 48 + Canada)
export const NORTH_AMERICA_BOUNDS: BoundingBox = {
    minLat: 15.0,
    maxLat: 72.0,
    minLon: -170.0,
    maxLon: -50.0
};

const DEG_TO_RAD = Math.PI / 180;

export const lon2tile = (lon: number, zoom: number): number => {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
};

export const lat2tile = (lat: number, zoom: number): number => {
    const latRad = lat * DEG_TO_RAD;
    return Math.floor(
        ((1 -
            Math.log(
                Math.tan(latRad) + 1 / Math.cos(latRad)
            ) /
                Math.PI) /
            2) *
            Math.pow(2, zoom)
    );
};

export const generateTileQueue = (
    bounds: BoundingBox,
    minZoom: number,
    maxZoom: number
): string[] => {
    const urls: string[] = [];

    for (let z = minZoom; z <= maxZoom; z++) {
        // Find grid boundaries for this zoom
        const minX = Math.max(0, lon2tile(bounds.minLon, z));
        const maxX = Math.min(Math.pow(2, z) - 1, lon2tile(bounds.maxLon, z));

        // Note: latitude goes from + (North) to - (South) in coordinates,
        // but Y tiles go from 0 (North/Top) to max (South/Bottom).
        const minY = Math.max(0, lat2tile(bounds.maxLat, z));
        const maxY = Math.min(Math.pow(2, z) - 1, lat2tile(bounds.minLat, z));

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
            }
        }
    }

    return urls;
};

export const downloadMapTiles = async (
    urls: string[],
    onProgress: (done: number, total: number) => void
) => {
    const total = urls.length;
    let done = 0;
    
    // Process in batches of 10 to avoid suffocating the browser's HTTP queue
    const BATCH_SIZE = 10;
    const cache = await caches.open('offline-map-tiles');
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
            batch.map(async (url) => {
                try {
                    // Skip if already cached, preventing network abuse on boots
                    const existing = await cache.match(url);
                    if (existing) return;

                    // Fetch natively and pump explicitly into the sw-cache bucket
                    const res = await fetch(url, { mode: "cors" });
                    if (res.ok) {
                        await cache.put(url, res);
                    }
                } catch (e: unknown) {
                    if (e instanceof Error) console.warn("Failed to fetch map tile:", url, e.message);
                }
            })
        );
        
        done += batch.length;
        if (done > total) done = total; // clamp for safety
        onProgress(done, total);
        
        // Let the JS event loop breathe so the UI doesn't freeze
        await new Promise(resolve => setTimeout(resolve, 10));
    }
};

export const getCacheUsageString = async (): Promise<string> => {
    try {
        let tileCount = 0;
        try {
            const cache = await caches.open('offline-map-tiles');
            const keys = await cache.keys();
            tileCount = keys.length;
        } catch {
            // ignore
        }
        
        if (tileCount > 0) {
            // Rough average of 15KB per slippy map PNG
            const estimatedMb = ((tileCount * 15) / 1024).toFixed(1);
            return `${tileCount.toLocaleString()} Tiles Offline (~${estimatedMb} MB)`;
        }

        // Fallback to native hardware if 0 bounds
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            if (estimate.usage !== undefined && estimate.usage > 0) {
                const usageMB = (estimate.usage / (1024 * 1024)).toFixed(1);
                return `0 Tiles Cached (${usageMB} MB System Overhead)`;
            }
        }
        
        return '0 Tiles Cached';
    } catch {
        return 'Storage error';
    }
};

export const autoDownloadBaseMaps = async () => {
    try {
        const worldUrls = generateTileQueue(WORLD_BOUNDS, 0, 2);
        const usUrls = generateTileQueue(NORTH_AMERICA_BOUNDS, 0, 4);
        
        // Let it run silently in the background
        await downloadMapTiles([...worldUrls, ...usUrls], () => {});
    } catch (err: unknown) {
        if (err instanceof Error) console.error("Auto base map download failed", err.message);
    }
};

/**
 * Heuristically detects the maximum zoom level currently downloaded 
 * for a specific region by scanning cache keys.
 */
export const detectMaxZoom = async (type: 'world' | 'na'): Promise<number> => {
    try {
        const cache = await caches.open('offline-map-tiles');
        const keys = await cache.keys();
        const urls = keys.map(k => k.url);
        
        const bounds = type === 'world' ? WORLD_BOUNDS : NORTH_AMERICA_BOUNDS;
        const tileCountsByZoom: Record<number, number> = {};
        const zoomRegex = /\/(\d+)\/(\d+)\/(\d+)\.png$/;
        
        const boundsCache: Record<number, { minX: number, maxX: number, minY: number, maxY: number }> = {};
        
        function isTileInBounds(x: number, y: number, z: number, bounds: BoundingBox) {
            if (!boundsCache[z]) {
                boundsCache[z] = {
                    minX: Math.max(0, lon2tile(bounds.minLon, z)),
                    maxX: Math.min(Math.pow(2, z) - 1, lon2tile(bounds.maxLon, z)),
                    minY: Math.max(0, lat2tile(bounds.maxLat, z)),
                    maxY: Math.min(Math.pow(2, z) - 1, lat2tile(bounds.minLat, z))
                };
            }
            const b = boundsCache[z];
            return (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY);
        }

        // Group and count strictly within geographic target bounds
        for (const url of urls) {
            const match = zoomRegex.exec(url);
            if (match) {
                const z = parseInt(match[1], 10);
                const x = parseInt(match[2], 10);
                const y = parseInt(match[3], 10);

                if (isTileInBounds(x, y, z, bounds)) {
                    tileCountsByZoom[z] = (tileCountsByZoom[z] || 0) + 1;
                }
            }
        }
        
        let maxCompleteZoom = -1;
        const maxPossible = type === 'world' ? 10 : 14;
        
        // Validate each level sequentially. Break cleanly if a layer is missing tiles.
        for (let z = 0; z <= maxPossible; z++) {
            const minX = Math.max(0, lon2tile(bounds.minLon, z));
            const maxX = Math.min(Math.pow(2, z) - 1, lon2tile(bounds.maxLon, z));
            const minY = Math.max(0, lat2tile(bounds.maxLat, z));
            const maxY = Math.min(Math.pow(2, z) - 1, lat2tile(bounds.minLat, z));
            
            const expectedCount = (maxX - minX + 1) * (maxY - minY + 1);
            const actualCount = tileCountsByZoom[z] || 0;

            if (actualCount >= expectedCount) {
                maxCompleteZoom = z;
            } else {
                break; 
            }
        }
        
        // Return standard minimum baselines natively 
        const defaultZoom = type === 'world' ? 2 : 4;
        return maxCompleteZoom >= defaultZoom ? maxCompleteZoom : defaultZoom;
    } catch {
        return type === 'world' ? 2 : 4;
    }
};
