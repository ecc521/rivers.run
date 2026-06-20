/* eslint-disable */
// @ts-nocheck
// src/workers/valhallaRouting.worker.ts
// Valhalla WASM routing Web Worker.
//
// The routing engine + tile mounting now live in the `valhalla-wasm` package.
// This worker is just the wiring: load the Emscripten module, read tiles from
// OPFS, and speak our RoutingRequest/RoutingResponse protocol. Tile download +
// OPFS storage stays in src/utils/offlineMapEngine.ts.
const WORKER_VERSION = 'v4.0-pkg';

/// <reference lib="webworker" />

import type { RoutingRequest } from 'valhalla-wasm';
import { createRoutingEngine, createOpfsTarTileSourceFactory } from 'valhalla-wasm';

(self as any).global = self;

// Load the Emscripten loader; valhalla.js + valhalla.wasm are served at the root.
importScripts('/valhalla.js');
declare const ValhallaModule: (opts?: any) => Promise<any>;

const route = createRoutingEngine({
    initModule: () => ValhallaModule({
        locateFile: (path: string) => `/${path}`,
        print: (text: string) => console.log(`[Valhalla WASM] ${text}`),
        printErr: (text: string) => console.warn(`[Valhalla WASM] ${text}`),
    }),
    tileSourceFactory: createOpfsTarTileSourceFactory('offline_maps'),
    onProgress: (message: string) => self.postMessage({ success: false, progress: message }),
});

self.onmessage = async (event: MessageEvent<RoutingRequest>) => {
    try {
        self.postMessage(await route(event.data));
    } catch (error: any) {
        console.error(`[Valhalla Worker ${WORKER_VERSION}] Routing failed:`, error);
        self.postMessage({ success: false, error: error?.message || String(error) });
    }
};
