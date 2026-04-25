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
    try {
        await Filesystem.mkdir({
            path: MAPS_DIR,
            directory: Directory.Data,
            recursive: true
        });
    } catch (_e) {
        // eslint-disable-next-line sonarjs/no-ignored-exceptions
        // Directory likely exists
    }
};

export const getDownloadedRegions = async (): Promise<string[]> => {
    if (!Capacitor.isNativePlatform()) {
        return []; 
    }
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
};

export const getLocalPmtilesUrl = async (regionId: string): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) return null;
    try {
        const uriResult = await Filesystem.getUri({
            path: `${MAPS_DIR}/${regionId}.pmtiles`,
            directory: Directory.Data
        });
        return Capacitor.convertFileSrc(uriResult.uri);
    } catch {
        return null;
    }
};

export const downloadMapRegion = async (
    region: MapRegion, 
    onProgress: (progress: number) => void
): Promise<void> => {
    if (!Capacitor.isNativePlatform()) {
        throw new Error("Offline map downloading is currently only supported on the native mobile app.");
    }
    
    await ensureMapDirectory();
    const destPath = `${MAPS_DIR}/${region.id}.pmtiles`;

    try {
        // Clean up any partial previous download
        try {
            await Filesystem.deleteFile({ path: destPath, directory: Directory.Data });
        } catch (_err) {
            // eslint-disable-next-line sonarjs/no-ignored-exceptions
        }

        // Use Capacitor's native Filesystem downloader to bypass JS memory limits for huge files
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await Filesystem.downloadFile({
            url: region.url!,
            path: destPath,
            directory: Directory.Data,
            progress: true
        });
        
        // Note: CapacitorHttp doesn't easily expose the progress callback to the JS layer in a streaming way
        // without an event listener. For simplicity in this demo, we simulate a jump to 100% when done.
        onProgress(1.0);
        
    } catch (err: any) {
        // Clean up corrupted file on failure
        try {
            await Filesystem.deleteFile({ path: destPath, directory: Directory.Data });
        } catch (_err) {
            // eslint-disable-next-line sonarjs/no-ignored-exceptions
        }
        throw new Error(`Failed to download map: ${err.message}`, { cause: err });
    }
};

export const deleteMapRegion = async (regionId: string): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Filesystem.deleteFile({
            path: `${MAPS_DIR}/${regionId}.pmtiles`,
            directory: Directory.Data
        });
    } catch (_err) {
        // eslint-disable-next-line sonarjs/no-ignored-exceptions
        // File could not be deleted
    }
};
