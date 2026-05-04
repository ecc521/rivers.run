import { Directory, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface MapRegion {
    id: string; // e.g. "US-CO"
    name: string;
    country: string;
    file: string; // legacy fallback
    mapFile?: string;
    routingFile?: string;
    estimatedSizeMB: number;
    routingSizeMB?: number;
    url?: string; // computed at runtime
    routingUrl?: string; // computed at runtime
}

export interface DownloadedRegionState {
    id: string;
    hasMap: boolean;
    hasRouting: boolean;
}

// The public endpoint configured in Cloudflare R2
const R2_PUBLIC_URL = 'https://protomaps.rivers.run';

let cachedManifest: MapRegion[] | null = null;

export const supportsOfflineMaps = () => {
    if (Capacitor.isNativePlatform()) return true;
    return typeof navigator !== 'undefined' && !!(navigator as any).storage && !!(navigator as any).storage.getDirectory;
};

export const fetchMapRegions = async (): Promise<MapRegion[]> => {
    if (cachedManifest) return cachedManifest;

    try {
        const response = await fetch(`${R2_PUBLIC_URL}/regions_manifest.json`);
        if (!response.ok) throw new Error("Failed to fetch regions manifest");
        
        const data = await response.json();
        
        // Transform the object into an array of MapRegion objects
        const regions: MapRegion[] = Object.keys(data).map(abbrev => {
            const raw = data[abbrev];
            const id = `US-${abbrev}`;
            const mapFileName = raw.mapFile || raw.file;
            const routingFileName = raw.routingFile || raw.file.replace('_z14.pmtiles', '_routing.tar.gz');
            
            return {
                id,
                name: raw.name,
                country: raw.country,
                file: mapFileName, // keep original property for backwards compatibility
                mapFile: mapFileName,
                routingFile: routingFileName,
                estimatedSizeMB: raw.sizeMB,
                routingSizeMB: raw.routingSizeMB,
                url: `${R2_PUBLIC_URL}/${mapFileName}`,
                routingUrl: `${R2_PUBLIC_URL}/${routingFileName}`
            };
        });

        // Sort alphabetically by name
        regions.sort((a, b) => a.name.localeCompare(b.name));
        
        cachedManifest = regions;
        return regions;
    } catch (e) {
        console.error("Manifest Fetch Error:", e);
        return [];
    }
};

const MAPS_DIR = 'offline_maps';

// Initialize the directory
const ensureMapDirectory = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.mkdir({
                path: MAPS_DIR,
                directory: Directory.Data,
                recursive: true
            });
        } catch (_e) {
            console.debug("Directory likely exists", _e);
            // Directory likely exists
        }
    }
};

export const getDownloadedRegions = async (): Promise<DownloadedRegionState[]> => {
    const statesMap = new Map<string, DownloadedRegionState>();

    const getOrInit = (id: string) => {
        if (!statesMap.has(id)) {
            statesMap.set(id, { id, hasMap: false, hasRouting: false });
        }
        return statesMap.get(id)!;
    };

    if (Capacitor.isNativePlatform()) {
        await ensureMapDirectory();
        try {
            const result = await Filesystem.readdir({
                path: MAPS_DIR,
                directory: Directory.Data
            });
            for (const f of result.files) {
                if (f.name.endsWith('.pmtiles')) {
                    getOrInit(f.name.replace('.pmtiles', '')).hasMap = true;
                } else if (f.name.endsWith('_routing.tar')) {
                    getOrInit(f.name.replace('_routing.tar', '')).hasRouting = true;
                }
            }
        } catch (_e) {
            console.debug("No maps found", _e);
        }
    } else {
        if (!supportsOfflineMaps()) return [];
        try {
            const root = await (navigator as any).storage.getDirectory();
            const dir = await root.getDirectoryHandle(MAPS_DIR, { create: true });

            for await (const name of dir.keys()) {
                if (name.endsWith('.pmtiles')) {
                    getOrInit(name.replace('.pmtiles', '')).hasMap = true;
                } else if (name.endsWith('_routing.tar')) {
                    getOrInit(name.replace('_routing.tar', '')).hasRouting = true;
                }
            }
        } catch (_e) {
            console.debug("No maps found", _e);
        }
    }
    return Array.from(statesMap.values());
};

export const getOfflineMapSource = async (regionId: string): Promise<string | File | null> => {
    if (Capacitor.isNativePlatform()) {
        try {
            const uriResult = await Filesystem.getUri({
                path: `${MAPS_DIR}/${regionId}.pmtiles`,
                directory: Directory.Data
            });
            return Capacitor.convertFileSrc(uriResult.uri);
        } catch (_e) {
            console.debug("Offline map source not found", _e);
            return null;
        }
    } else {
        if (!supportsOfflineMaps()) return null;
        try {
            const root = await (navigator as any).storage.getDirectory();
            const dir = await root.getDirectoryHandle(MAPS_DIR);
            const fileHandle = await dir.getFileHandle(`${regionId}.pmtiles`);
            return await fileHandle.getFile();
        } catch (_e) {
            console.debug("Offline map source not found", _e);
            return null;
        }
    }
};

export interface DownloadOptions {
    downloadMap: boolean;
    downloadRouting: boolean;
}

export const downloadMapRegion = async (
    region: MapRegion, 
    options: DownloadOptions,
    onProgress: (progress: number, loadedBytes?: number, totalBytes?: number) => void
): Promise<void> => {
    if (!supportsOfflineMaps()) {
        throw new Error("Offline maps are not supported in this browser.");
    }

    if (!options.downloadMap && !options.downloadRouting) {
        return;
    }

    if (Capacitor.isNativePlatform()) {
        await ensureMapDirectory();
        const destPath = `${MAPS_DIR}/${region.id}.pmtiles`;
        const routingDestPath = `${MAPS_DIR}/${region.id}_routing.tar`;
    
        try {
            let currentProgress = 0;
            const progressWeightMap = options.downloadMap && options.downloadRouting ? 0.8 : 1.0;

            if (options.downloadMap) {
                try { await Filesystem.deleteFile({ path: destPath, directory: Directory.Data }); } catch (_e) { console.debug("delete fail", _e); }
                // eslint-disable-next-line sonarjs/deprecation
                await Filesystem.downloadFile({
                    url: region.url!,
                    path: destPath,
                    directory: Directory.Data,
                    progress: true
                });
                currentProgress += progressWeightMap;
                onProgress(currentProgress);
            }

            if (options.downloadRouting) {
                try { await Filesystem.deleteFile({ path: routingDestPath, directory: Directory.Data }); } catch (_e) { console.debug("delete fail", _e); }
                // eslint-disable-next-line sonarjs/deprecation
                await Filesystem.downloadFile({
                    url: region.routingUrl!,
                    path: routingDestPath,
                    directory: Directory.Data,
                    progress: false
                });
            }
            
            onProgress(1.0);
            
        } catch (err: any) {
            if (options.downloadMap) try { await Filesystem.deleteFile({ path: destPath, directory: Directory.Data }); } catch (_e) { console.debug("delete fail", _e); }
            if (options.downloadRouting) try { await Filesystem.deleteFile({ path: routingDestPath, directory: Directory.Data }); } catch (_e) { console.debug("delete fail", _e); }
            throw new Error(`Failed to download map: ${err.message}`); // eslint-disable-line preserve-caught-error
        }
    } else {
        if ((navigator as any).storage && (navigator as any).storage.persist) {
            await (navigator as any).storage.persist();
        }

        const root = await (navigator as any).storage.getDirectory();
        const dir = await root.getDirectoryHandle(MAPS_DIR, { create: true });
        const fileName = `${region.id}.pmtiles`;
        const routingFileName = `${region.id}_routing.tar`;

        try {
            const mapExpectedBytes = region.estimatedSizeMB * 1024 * 1024;
            const routingExpectedBytes = (region.routingSizeMB || 0) * 1024 * 1024;
            const totalExpectedBytes = (options.downloadMap ? mapExpectedBytes : 0) + (options.downloadRouting ? routingExpectedBytes : 0);

            let mapActualLoaded = 0;

            if (options.downloadMap) {
                const response = await fetch(region.url!);
                if (!response.ok) throw new Error("Failed to fetch map data");
                if (!response.body) throw new Error("No response body available");

                const fileHandle = await dir.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                const reader = response.body.getReader();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    await writable.write(value);
                    mapActualLoaded += value.length;
                    
                    onProgress(
                        (mapActualLoaded / totalExpectedBytes), 
                        mapActualLoaded, 
                        totalExpectedBytes
                    );
                }
                await writable.close();
            }

            if (options.downloadRouting) {
                // Try downloading routing data
                const routeResponse = await fetch(region.routingUrl!);
                if (!routeResponse.ok) throw new Error("Failed to fetch routing data");
                
                const contentType = routeResponse.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    throw new Error("Routing data is currently unavailable for this region.");
                }

                if (routeResponse.body) {
                    const routeFileHandle = await dir.getFileHandle(routingFileName, { create: true });
                    const routeWritable = await routeFileHandle.createWritable();

                    // ONLY decompress if the browser hasn't already done it.
                    // If the browser decompressed it transparently, the Content-Encoding header will be stripped.
                    const isGzipped = routeResponse.headers.get('Content-Encoding') === 'gzip';

                    let stream = routeResponse.body;

                    let compressedLoaded = 0;
                    const progressStream = new TransformStream({
                        transform(chunk, controller) {
                            compressedLoaded += chunk.length;
                            
                            const totalLoaded = (options.downloadMap ? mapExpectedBytes : 0) + compressedLoaded;
                            
                            onProgress(
                                (totalLoaded / totalExpectedBytes), 
                                totalLoaded, 
                                totalExpectedBytes
                            );
                            
                            controller.enqueue(chunk);
                        }
                    });

                    stream = stream.pipeThrough(progressStream);

                    if (isGzipped && typeof DecompressionStream !== 'undefined') {
                        console.log(`[OfflineMapEngine] Decompressing routing data for ${region.id}...`);
                        stream = stream.pipeThrough(new DecompressionStream('gzip'));
                    }

                    const routeReader = stream.getReader();
                    let routeLoaded = 0;
                    
                    while (true) {
                        const { done, value } = await routeReader.read();
                        if (done) break;
                        await routeWritable.write(value);
                        routeLoaded += value.length;
                    }
                    await routeWritable.close();
                    
                    if (routeLoaded < 1024) {
                        throw new Error("Downloaded routing file is empty or corrupted.");
                    }
                }
            }
            
            onProgress(1.0);

        } catch (err: any) {
            if (options.downloadMap) try { await dir.removeEntry(fileName); } catch (_e) { console.debug("delete fail", _e); }
            if (options.downloadRouting) try { await dir.removeEntry(routingFileName); } catch (_e) { console.debug("delete fail", _e); }
            throw new Error(`Failed to download map: ${err.message}`); // eslint-disable-line preserve-caught-error
        }
    }
};

export const deleteMapRegion = async (regionId: string, options: { deleteMap: boolean, deleteRouting: boolean }): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        if (options.deleteMap) try { await Filesystem.deleteFile({ path: `${MAPS_DIR}/${regionId}.pmtiles`, directory: Directory.Data }); } catch (_e) { console.debug("delete fail", _e); }
        if (options.deleteRouting) try { await Filesystem.deleteFile({ path: `${MAPS_DIR}/${regionId}_routing.tar`, directory: Directory.Data }); } catch (_e) { console.debug("delete fail", _e); }
    } else {
        if (!supportsOfflineMaps()) return;
        try {
            const root = await (navigator as any).storage.getDirectory();
            const dir = await root.getDirectoryHandle(MAPS_DIR);
            if (options.deleteMap) try { await dir.removeEntry(`${regionId}.pmtiles`); } catch (_e) { console.debug("delete fail", _e); }
            if (options.deleteRouting) try { await dir.removeEntry(`${regionId}_routing.tar`); } catch (_e) { console.debug("delete fail", _e); }
        } catch (_e) {
            console.debug("delete fail", _e);
        }
    }
};
