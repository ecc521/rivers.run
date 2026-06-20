// Re-exported from the valhalla-wasm package so existing imports keep working.
// The routing engine itself now lives in that package; this app only supplies
// storage (OPFS, via offlineMapEngine) and the thin worker wiring.
export type {
    RoutingRequest,
    RoutingInstruction,
    RoutingSummary,
    RoutingResponse,
} from 'valhalla-wasm';
