import { Directory, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface MapRegion {
    id: string; // e.g. "US-CO"
    name: string;
    country: string;
    file: string;
    estimatedSizeMB: number;
    url?: string; // computed at runtime
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
            return {
                id,
                name: raw.name,
                country: raw.country,
                file: raw.file,
                estimatedSizeMB: raw.sizeMB,
                url: `${R2_PUBLIC_URL}/${raw.file}`
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
            console.debug("Directory likely exists:", _e);
        }
    }
};

export const getDownloadedRegions = async (): Promise<string[]> => {
    if (Capacitor.isNativePlatform()) {
        await ensureMapDirectory();
        try {
            const result = await Filesystem.readdir({
                path: MAPS_DIR,
                directory: Directory.Data
            });
            return result.files.map(f => f.name.replace('.pmtiles', ''));
        } catch {
            return [];
        }
    } else {
        if (!supportsOfflineMaps()) return [];
        try {
            const root = await (navigator as any).storage.getDirectory();
            const dir = await root.getDirectoryHandle(MAPS_DIR, { create: true });
            const regions: string[] = [];
            for await (const name of dir.keys()) {
                if (name.endsWith('.pmtiles')) {
                    regions.push(name.replace('.pmtiles', ''));
                }
            }
            return regions;
        } catch {
            return [];
        }
    }
};

export const getOfflineMapSource = async (regionId: string): Promise<string | File | null> => {
    if (Capacitor.isNativePlatform()) {
        try {
            const uriResult = await Filesystem.getUri({
                path: `${MAPS_DIR}/${regionId}.pmtiles`,
                directory: Directory.Data
            });
            return Capacitor.convertFileSrc(uriResult.uri);
        } catch {
            return null;
        }
    } else {
        if (!supportsOfflineMaps()) return null;
        try {
            const root = await (navigator as any).storage.getDirectory();
            const dir = await root.getDirectoryHandle(MAPS_DIR);
            const fileHandle = await dir.getFileHandle(`${regionId}.pmtiles`);
            return await fileHandle.getFile();
        } catch {
            return null;
        }
    }
};

export const downloadMapRegion = async (
    region: MapRegion, 
    onProgress: (progress: number) => void
): Promise<void> => {
    if (!supportsOfflineMaps()) {
        throw new Error("Offline maps are not supported in this browser.");
    }

    if (Capacitor.isNativePlatform()) {
        await ensureMapDirectory();
        const destPath = `${MAPS_DIR}/${region.id}.pmtiles`;
    
        try {
            // Clean up any partial previous download
            try {
                await Filesystem.deleteFile({ path: destPath, directory: Directory.Data });
            } catch (_err) {
                console.debug("No previous file to delete:", _err);
            }
    
            // Use Capacitor's native Filesystem downloader
            // eslint-disable-next-line sonarjs/deprecation
            await Filesystem.downloadFile({
                url: region.url!,
                path: destPath,
                directory: Directory.Data,
                progress: true
            });
            
            onProgress(1.0);
            
        } catch (err: any) {
            try {
                await Filesystem.deleteFile({ path: destPath, directory: Directory.Data });
            } catch (_err) {
                console.debug("File cleanup failed:", _err);
            }
            // eslint-disable-next-line preserve-caught-error
            throw new Error(`Failed to download map: ${err.message}`);
        }
    } else {
        if ((navigator as any).storage && (navigator as any).storage.persist) {
            await (navigator as any).storage.persist();
        }

        const root = await (navigator as any).storage.getDirectory();
        const dir = await root.getDirectoryHandle(MAPS_DIR, { create: true });
        const fileName = `${region.id}.pmtiles`;

        try {
            const response = await fetch(region.url!);
            if (!response.ok) throw new Error("Failed to fetch map data");
            if (!response.body) throw new Error("No response body available");

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            let loaded = 0;

            const fileHandle = await dir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                await writable.write(value);
                loaded += value.length;
                if (total) {
                    onProgress(loaded / total);
                }
            }
            await writable.close();
        } catch (err: any) {
            try {
                await dir.removeEntry(fileName);
            } catch (_e) {
                console.debug("File cleanup failed:", _e);
            }
            // eslint-disable-next-line preserve-caught-error
            throw new Error(`Failed to download map: ${err.message}`);
        }
    }
};

export const deleteMapRegion = async (regionId: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.deleteFile({
                path: `${MAPS_DIR}/${regionId}.pmtiles`,
                directory: Directory.Data
            });
        } catch (_err) {
            console.debug("Delete failed or file missing:", _err);
        }
    } else {
        if (!supportsOfflineMaps()) return;
        try {
            const root = await (navigator as any).storage.getDirectory();
            const dir = await root.getDirectoryHandle(MAPS_DIR);
            await dir.removeEntry(`${regionId}.pmtiles`);
        } catch (_err) {
            console.debug("Delete failed or file missing:", _err);
        }
    }
};
