/* eslint-disable */
// @ts-nocheck
// src/workers/valhallaRouting.worker.ts
const WORKER_VERSION = 'v4.1-pkg';

/// <reference lib="webworker" />

import type { RoutingRequest } from 'valhalla-wasm';
import { createRoutingEngine, createOpfsTarTileSourceFactory } from 'valhalla-wasm';

(self as any).global = self;

declare const ValhallaModule: (opts?: any) => Promise<any>;

// Classic workers (production ?worker IIFE bundle) support importScripts.
// Module workers (Vite dev ?worker) define importScripts on WorkerGlobalScope
// but throw TypeError when called — so we try first and fall back to fetch.
//
// The fetch fallback uses indirect eval `(0, eval)(code)`. Indirect eval always
// runs in the global scope, so `var ValhallaModule = ...` in valhalla.js becomes
// self.ValhallaModule, which the code below can reference as ValhallaModule.
// valhalla.js has no top-level "use strict", so this is safe.
let valhallaReady: Promise<void>;
try {
    importScripts('/valhalla.js');
    valhallaReady = Promise.resolve();
} catch (_e) {
    valhallaReady = fetch('/valhalla.js')
        .then(r => r.text())
        .then(code => { (0, eval)(code); });
}

const route = createRoutingEngine({
    initModule: async () => {
        await valhallaReady;
        return ValhallaModule({
            locateFile: (path: string) => `/${path}`,
            print: (text: string) => console.log(`[Valhalla WASM] ${text}`),
            printErr: (text: string) => console.warn(`[Valhalla WASM] ${text}`),
        });
    },
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
