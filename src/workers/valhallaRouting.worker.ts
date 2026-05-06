/* eslint-disable */
// @ts-nocheck
// src/workers/valhallaRouting.worker.ts
// Valhalla WASM routing engine Web Worker
const WORKER_VERSION = 'v3.0-tar-extract';

/// <reference lib="webworker" />

(self as any).global = self;

type RoutingRequest = import('./valhallaRoutingTypes').RoutingRequest;

type RoutingInstruction = import('./valhallaRoutingTypes').RoutingInstruction;

// Load the Emscripten JS wrapper into the Web Worker context.
// In Vite, assets in public/ are served at the root.
importScripts('/valhalla.js');

// Declare the global exposed by the Emscripten build
declare let ValhallaModule: any;

let wasmModule: any = null;
let valhallaRouter: any = null;
const mountedRegions = new Set<string>();

/**
 * Parse a tar archive stored in an OPFS SyncAccessHandle and return the index of entries.
 * Handles both POSIX/ustar and PAX extended headers.
 * 
 * Returns an array of {name, offset, size} for each regular file entry.
 */
function parseTarIndex(handle: FileSystemSyncAccessHandle): Array<{name: string, offset: number, size: number}> {
    const BLOCK_SIZE = 512;
    const totalSize = handle.getSize();
    const headerBuf = new Uint8Array(BLOCK_SIZE);
    const entries: Array<{name: string, offset: number, size: number}> = [];
    const decoder = new TextDecoder();
    
    let pos = 0;
    let paxName: string | null = null;
    
    while (pos + BLOCK_SIZE <= totalSize) {
        handle.read(headerBuf, { at: pos });
        
        // Check for empty block (end of archive)
        let allZero = true;
        for (let i = 0; i < BLOCK_SIZE; i++) {
            if (headerBuf[i] !== 0) { allZero = false; break; }
        }
        if (allZero) {
            pos += BLOCK_SIZE;
            continue;
        }
        
        // Parse tar header fields
        const nameRaw = decoder.decode(headerBuf.subarray(0, 100)).replace(/\0+$/, '');
        const sizeOctal = decoder.decode(headerBuf.subarray(124, 136)).replace(/\0+$/, '').trim();
        const typeflag = String.fromCharCode(headerBuf[156]);
        const prefix = decoder.decode(headerBuf.subarray(345, 500)).replace(/\0+$/, '');
        
        const fileSize = parseInt(sizeOctal, 8) || 0;
        const dataOffset = pos + BLOCK_SIZE;
        const dataBlocks = Math.ceil(fileSize / BLOCK_SIZE);
        
        if (typeflag === 'x' || typeflag === 'g') {
            // PAX extended header — parse it to extract the real filename
            if (fileSize > 0 && fileSize < 65536) {
                const paxBuf = new Uint8Array(fileSize);
                handle.read(paxBuf, { at: dataOffset });
                const paxContent = decoder.decode(paxBuf);
                // PAX format: "length key=value\n" per record
                const pathMatch = paxContent.match(/\d+ path=(.+)\n/);
                if (pathMatch) {
                    paxName = pathMatch[1];
                }
            }
            pos = dataOffset + dataBlocks * BLOCK_SIZE;
            continue;
        }
        
        if (typeflag === '0' || typeflag === '\0' || typeflag === '') {
            // Regular file entry
            let fullName = prefix ? `${prefix}/${nameRaw}` : nameRaw;
            // If a PAX header preceded this entry, use the PAX name instead
            if (paxName) {
                fullName = paxName;
                paxName = null;
            }
            
            if (fileSize > 0) {
                entries.push({ name: fullName, offset: dataOffset, size: fileSize });
            }
        } else {
            // Directory ('5') or other entry type — skip
            paxName = null;
        }
        
        pos = dataOffset + dataBlocks * BLOCK_SIZE;
    }
    
    return entries;
}

/**
 * Recursively create directories in Emscripten FS (like `mkdir -p`).
 */
function mkdirp(FS: any, dirPath: string) {
    const parts = dirPath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        current += '/' + part;
        try { FS.mkdir(current); } catch (_e) { /* already exists */ }
    }
}

/**
 * Lazy tile device factory: creates virtual files backed by OPFS SyncAccessHandle.
 * 
 * Each tile is registered as a character device (patched to look like a regular file).
 * When Valhalla reads a tile, the read() op fetches data from the OPFS tar at the
 * correct offset. Combined with Valhalla's LRU tile cache (use_lru_mem_cache=true),
 * each tile is only read from OPFS ONCE — subsequent accesses hit the in-memory cache.
 * 
 * This approach uses ~20-50MB for a typical route instead of pre-loading 700MB+.
 */
let _nextDeviceMajor = 80;

function createTileDeviceFactory(FS: any, handle: FileSystemSyncAccessHandle) {
    const major = _nextDeviceMajor++;
    let nextMinor = 0;

    // Shared stream ops — tile-specific offset/size stored on the node
    const sharedOps = {
        open(stream: any) {
            stream.seekable = true;
            stream._tileOffset = stream.node._tileOffset;
            stream._tileSize = stream.node._tileSize;
        },
        read(_stream: any, buffer: Uint8Array, offset: number, length: number, position: number) {
            const tileOffset = _stream._tileOffset as number;
            const tileSize = _stream._tileSize as number;

            const remaining = tileSize - position;
            if (remaining <= 0) return 0;
            const toRead = Math.min(length, remaining);

            // OPFS SyncAccessHandle.read() may not support SharedArrayBuffer
            let targetBuffer = buffer.subarray(offset, offset + toRead);
            const isShared = typeof SharedArrayBuffer !== 'undefined' &&
                buffer.buffer instanceof SharedArrayBuffer;
            if (isShared) {
                targetBuffer = new Uint8Array(toRead);
            }

            const bytesRead = handle.read(targetBuffer, { at: tileOffset + position });

            if (isShared && bytesRead > 0) {
                buffer.set(targetBuffer.subarray(0, bytesRead), offset);
            }
            return bytesRead;
        },
        write() {
            throw new Error("Valhalla routing tiles are read-only.");
        },
        llseek(stream: any, offset: number, whence: number) {
            const tileSize = stream._tileSize as number;
            let position = offset;
            if (whence === 1) position += stream.position;
            else if (whence === 2) position = tileSize + offset;
            if (position < 0) throw new FS.ErrnoError(28);
            return position;
        }
    };

    return function mountTile(filePath: string, dataOffset: number, dataSize: number) {
        const minor = nextMinor++;
        const dev = FS.makedev(major, minor);

        FS.registerDevice(dev, sharedOps);
        FS.mkdev(filePath, 0o644, dev);

        const node = FS.lookupPath(filePath).node;
        node.mode = 0o100644;     // S_IFREG so stat() sees a regular file
        node.usedBytes = dataSize;
        node.size = dataSize;
        node._tileOffset = dataOffset;
        node._tileSize = dataSize;
    };
}

async function mountRegionToWASM(region: string): Promise<boolean> {
    if (mountedRegions.has(region)) return false;
    if (!wasmModule) {
        console.error(`[Valhalla Worker] Cannot mount ${region}: WASM module not initialized`);
        return false;
    }

    try {
        self.postMessage({ success: false, progress: 'Loading map data…' });

        console.log(`[Valhalla Worker] Attempting to mount region: ${region}`);
         
        const rootDir = await navigator.storage.getDirectory();
        const mapDir = await rootDir.getDirectoryHandle('offline_maps', { create: false });
        const fileHandle = await mapDir.getFileHandle(`${region}_routing.tar`, { create: false });
        const syncHandle = await fileHandle.createSyncAccessHandle();
        
        const tarSize = syncHandle.getSize();
        console.log(`[Valhalla Worker] Found routing file for ${region}, size: ${tarSize} bytes`);
        
        if (tarSize < 1000) {
            console.warn(`[Valhalla Worker] Routing file for ${region} is suspiciously small (${tarSize} bytes). Might be corrupted.`);
        }

        // Parse tar index — discover tile names and offsets within the archive
        console.log(`[Valhalla Worker] Parsing tar index for ${region}...`);
        const entries = parseTarIndex(syncHandle);
        console.log(`[Valhalla Worker] Found ${entries.length} tiles in tar`);
        
        const FS = wasmModule.FS;
        const mountTile = createTileDeviceFactory(FS, syncHandle);
        // NOTE: syncHandle is intentionally NOT closed — it's kept alive for lazy reads.
        // The handle is held in the device factory closure and used when Valhalla
        // reads tiles on-demand. It will be released when the Worker is terminated.
        let tileCount = 0;
        
        for (const entry of entries) {
            const cleanName = entry.name.replace(/^\.\//, '');
            const filePath = `/valhalla_tiles/${cleanName}`;
            const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
            
            mkdirp(FS, dirPath);
            mountTile(filePath, entry.offset, entry.size);
            tileCount++;
        }
        
        mountedRegions.add(region);
        console.log(`[Valhalla Worker] Mounted ${tileCount} tiles from ${region} (lazy, on-demand reads)`);
        return true;
    } catch (e) {
        console.warn(`[Valhalla Worker] Failed to mount region ${region}. Ensure it is downloaded and has routing data.`, e);
        return false;
    }
}

function getValhallaConfig(_regions: string[]) {
    return {
        mjolnir: {
            tile_dir: "/valhalla_tiles",
            include_bicycle: true,
            include_driving: true,
            include_pedestrian: true,
            // Enable tile caching — critical for performance.
            // Without this, every tile is re-read + re-parsed on each access.
            use_lru_mem_cache: true,
            lru_mem_cache_hard_control: false,
            max_cache_size: 209715200, // 200MB — only actively used tiles are cached
            hierarchy: true,
            logging: { color: true, type: "std_out" },
        },
        loki: {
            actions: ["locate", "route", "sources_to_targets", "optimized_route", "isochrone", "trace_route", "trace_attributes", "expansion", "status"],
            logging: { color: true, type: "std_out" },
            service_defaults: {
                heading_tolerance: 60,
                minimum_reachability: 10,
                node_snap_tolerance: 50,
                radius: 0,
                search_cutoff: 35000,
                street_side_max_distance: 1000,
                street_side_tolerance: 5,
                mvt_min_zoom_road_class: [6, 7, 8, 9, 10, 11, 12, 13],
                mvt_min_zoom_other: [6, 7, 8, 9, 10, 11, 12, 13],
                mvt_min_zoom_path: [6, 7, 8, 9, 10, 11, 12, 13],
                mvt_cache_min_zoom: 12,
                mvt_cache_max_zoom: 16,
                mvt_cache_size: 100
            }
        },
        costing_options: {
            auto: { country_crossing_penalty: 0.0 },
            pedestrian: { walking_speed: 5.1, use_ferry: 0.5 }
        },
        thor: {
            source_to_target_algorithm: "select_optimal",
            service: { proxy: "ipc:///tmp/thor" },
            // Let Valhalla use its default hierarchy limits for efficient A* pruning.
            // The previous custom limits (max_up_nodes=40, expansion_within_dist=100)
            // were preventing highway-level shortcuts.
        },
        odin: {
            logging: { color: true, type: "std_out" },
            service: { proxy: "ipc:///tmp/odin" }
        },
        meili: {
            mode: "auto",
            grid: { cache_size: 100240, size: 500 },
            logging: { color: true, type: "std_out" },
            default: {
                beta: 3,
                breakage_distance: 2000,
                geometry: false,
                gps_accuracy: 5.0,
                interpolation_distance: 10,
                max_route_distance_factor: 5,
                max_route_time_factor: 5,
                max_search_radius: 100,
                route: true,
                search_radius: 50,
                sigma_z: 4.07,
                turn_penalty_factor: 0
            }
        },
        service_limits: {
            auto: { max_distance: 5000000.0, max_locations: 20, max_matrix_distance: 400000.0, max_matrix_location_pairs: 2500 },
            bicycle: { max_distance: 500000.0, max_locations: 50, max_matrix_distance: 200000.0, max_matrix_location_pairs: 2500 },
            pedestrian: { max_distance: 5000000.0, max_locations: 50, max_matrix_distance: 200000.0, max_matrix_location_pairs: 2500, max_transit_walking_distance: 10000, min_transit_walking_distance: 1 },
            truck: { max_distance: 5000000.0, max_locations: 20, max_matrix_distance: 400000.0, max_matrix_location_pairs: 2500 },
            isochrone: { 
                max_contours: 4, 
                max_distance: 25000.0,
                max_time_contour: 3600,
                max_distance_contour: 25000,
                max_locations: 1 
            },
            trace: { 
                max_alternates: 3,
                max_alternates_shape: 100,
                max_distance: 200000.0,
                max_gps_accuracy: 100.0,
                max_search_radius: 100.0,
                max_shape: 16000 
            },
            skadi: { max_shape: 750000, min_resample: 10.0 },
            status: { allow_verbose: false },
            centroid: { max_distance: 200000.0, max_locations: 5 },
            max_alternates: 2,
            max_radius: 200,
            max_reachability: 50,
            max_exclude_locations: 50,
            max_exclude_polygons_length: 10000,
            max_timedep_distance: 500000,
            max_timedep_distance_matrix: 0,
            max_distance_disable_hierarchy_culling: 0
        }
    };
}

/**
 * Decodes a Google-encoded polyline string into an array of [lng, lat] coordinates.
 * Valhalla uses 1e6 precision (6 decimal places) instead of Google's default 1e5.
 */
function decodePolyline(encoded: string, precision = 1e6): [number, number][] {
    const coordinates: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    
    while (index < encoded.length) {
        // Decode latitude
        let shift = 0;
        let result = 0;
        let byte: number;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        
        // Decode longitude
        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        
        coordinates.push([lng / precision, lat / precision]); // GeoJSON is [lng, lat]
    }
    
    return coordinates;
}

async function performRouting(valhallaRouter: any, start: number[], end: number[]) {
    const routingRequest = {
        locations: [
            { lon: start[0], lat: start[1] },
            { lon: end[0], lat: end[1] }
        ],
        costing: "auto" as "auto" | "pedestrian",
        units: "miles" as const
    };

    let routeResult: string;
    let result: any;

    try {
        console.log(`[Valhalla Worker] Executing routing query: ${JSON.stringify(routingRequest)}`);
        
        const t0 = performance.now();
        routeResult = valhallaRouter.route(JSON.stringify(routingRequest));
        const elapsed = (performance.now() - t0).toFixed(0);
        console.log(`[Valhalla Worker] Auto route completed in ${elapsed}ms`);
        result = JSON.parse(routeResult);
        
        if (result.error) {
            let errorMsg = result.error;
            if (errorMsg.includes("No suitable edges") || result.error_code === 171) {
                errorMsg = "Could not find a road near this location. Please ensure you have downloaded offline maps for all regions along the route.";
            }
            throw new Error(errorMsg);
        }
    } catch (e) {
        console.error("[Valhalla Worker] Routing attempt failed.", e);
        throw e;
    }
    
    const trip = result.trip;
    if (!trip || !trip.legs || trip.legs.length === 0) throw new Error("No route found.");

    const leg = trip.legs[0];
    const instructions: RoutingInstruction[] = leg.maneuvers.map((m: any) => ({
        text: m.instruction,
        distance: m.length,   // miles (configured in request)
        time: m.time,         // seconds
        type: m.type ?? 0     // Valhalla maneuver type
    }));

    // Decode the encoded polyline shape into GeoJSON
    let geometry: GeoJSON.LineString | undefined;
    if (trip.legs[0].shape) {
        const coords = decodePolyline(trip.legs[0].shape);
        geometry = { type: "LineString", coordinates: coords };
        console.log(`[Valhalla Worker] Route decoded: ${coords.length} points`);
    }

    const summary = {
        distance: trip.summary?.length ?? 0,   // miles
        time: trip.summary?.time ?? 0          // seconds
    };

    return {
        success: true,
        geometry,
        instructions,
        summary
    };
}

self.onmessage = async (event: MessageEvent<RoutingRequest>) => {
    const { start, end, regions } = event.data;

    try {
        // 1. Initialize Valhalla WASM if not already initialized
        if (!wasmModule) {
            console.log(`[Valhalla Worker] Initializing WASM Engine... (${WORKER_VERSION})`);
            wasmModule = await ValhallaModule({
                locateFile: (path: string) => `/${path}`, // Ensure it looks for valhalla.wasm at the root
                print: (text: string) => console.log(`[Valhalla WASM] ${text}`),
                printErr: (text: string) => console.warn(`[Valhalla WASM Error] ${text}`)
            });
            
             
            try { wasmModule.FS.mkdir('/valhalla_tiles'); } catch (_e) { /* ignore */ }
        }

        // 2. Mount requested regions
        let newlyMounted = false;
        for (const region of regions) {
            if (await mountRegionToWASM(region)) {
                newlyMounted = true;
            }
        }
        
        // 3. Initialize or Re-initialize ValhallaRouter if newly mounted regions
        if (!valhallaRouter || newlyMounted) {
            console.log(`[Valhalla Worker] ${valhallaRouter ? 'Re-initializing' : 'Initializing'} ValhallaRouter...`);
            // DEBUG: Show the tile directory structure to verify tiles are mounted
            try {
                const topLevel = wasmModule.FS.readdir('/valhalla_tiles');
                console.log(`[Valhalla Worker] /valhalla_tiles contents: ${JSON.stringify(topLevel)}`);
                
                // Try reading a tile from the first numbered directory
                for (const dir of topLevel) {
                    if (/^\d+$/.test(dir)) {
                        const subdirs = wasmModule.FS.readdir(`/valhalla_tiles/${dir}`);
                        const tileSubdirs = subdirs.filter((d: string) => d !== '.' && d !== '..');
                        console.log(`[Valhalla Worker] /valhalla_tiles/${dir}/ has ${tileSubdirs.length} subdirectories`);
                        break; // Just check the first one
                    }
                }
            } catch (fsError) {
                console.error(`[Valhalla Worker] Failed to inspect /valhalla_tiles:`, fsError);
            }

            const configJson = JSON.stringify(getValhallaConfig(regions));
            valhallaRouter = new wasmModule.ValhallaRouter(configJson);
            console.log(`[Valhalla Worker] ValhallaRouter ${valhallaRouter ? 'ready' : 'failed'}.`);
        }

        // 4. Perform Routing
        self.postMessage({ success: false, progress: 'Computing route…' });
        const response = await performRouting(valhallaRouter, start, end);
        self.postMessage(response);

    } catch (error: any) {
        console.error("[Valhalla Worker] Routing Pipeline Failed:", error);
        self.postMessage({ success: false, error: error.message || String(error) });
    }
};
