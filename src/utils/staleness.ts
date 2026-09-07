// River/stream gauges (USGS, NWS, EC, UK, IE) update on a 15-30 minute cadence, so a
// reading more than 2 hours old signals a real sync problem. USACE reservoir pool
// elevation is materially slower and more variable district-to-district (confirmed:
// some update every 15 minutes, others only once every ~24 hours), so the same 2-hour
// rule would flag a large fraction of lakes as stale when they're actually current.
const RIVER_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const LAKE_STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;

/**
 * Returns the staleness threshold (ms) to apply to a reading, based on its gauge ID's
 * provider prefix (e.g. "USACE:LRH.Summersville-Lake").
 */
export function getStaleThresholdMs(gaugeId?: string): number {
    const prefix = gaugeId?.split(":")[0]?.toUpperCase();
    return prefix === "USACE" ? LAKE_STALE_THRESHOLD_MS : RIVER_STALE_THRESHOLD_MS;
}
