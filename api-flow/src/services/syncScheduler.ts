import type { Env } from "../index";
import type { GaugeProvider } from "../services/provider";
import { withTimeout } from "../utils/timeout";
import { logToD1 } from '../utils/logger';

const sanitizeCoordinate = (val: any): number | undefined => {
    if (val === undefined || val === null) return undefined;
    const base = Array.isArray(val) ? val[0] : val;
    const parsed = parseFloat(base);
    return isNaN(parsed) ? undefined : parsed;
};

export async function performDataSync(env: Env, registryMetadata: Record<string, any>, providers: Record<string, GaugeProvider>): Promise<Record<string, any>> {
    let dbGauges: string[] = [];
    
    await logToD1(env, "INFO", "sync", "Starting main data synchronization...");

    try {
        const { results: riverResults } = await env.DB.prepare("SELECT gauges FROM rivers").all();
        dbGauges = (riverResults || []).flatMap((row: any) => {
            try {
                const gauges = typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || []);
                return gauges.map((g: any) => g.id);
            } catch (e) {
                console.warn("Failed to parse gauges for row, skipping.", e);
                return [];
            }
        });
    } catch (err) {
        console.warn("Modern 'gauges' column not found, falling back to legacy 'river_gauges' table...", err);
        try {
            const { results: legacyResults } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
            dbGauges = (legacyResults || []).map((row: any) => row.gauge_id);
        } catch (legacyErr) {
            console.error("FATAL: Could not read gauges from any schema.", legacyErr);
        }
    }

    const searchableGauges = Object.keys(registryMetadata);
    const linkedGaugesSet = new Set(dbGauges);
    const mergedData: Record<string, any> = {};

    Object.entries(registryMetadata).forEach(([fullId, meta]) => {
        const gid = meta.id || fullId;
        mergedData[fullId] = {
            id: gid.includes(":") ? gid.split(":")[1] : gid,
            name: meta.name,
            lat: sanitizeCoordinate(meta.lat),
            lon: sanitizeCoordinate(meta.lon),
            state: meta.state,
            country: meta.country,
            section: meta.section,
            readings: []
        };
    });

    // Ensure all gauges linked to rivers are also in the map, 
    // even if they aren't in the registry yet.
    dbGauges.forEach(fullId => {
        if (!mergedData[fullId]) {
            const gid = fullId.includes(":") ? fullId.split(":")[1] : fullId;
            mergedData[fullId] = {
                id: gid,
                name: fullId, // Fallback name
                readings: []
            };
        }
    });
    
    const providerGroups: Record<string, { linked: string[], registry: string[] }> = {};
    [...new Set([...dbGauges, ...searchableGauges])].forEach(g => {
        if (typeof g !== "string" || !g.includes(":")) return;
        const [prefix, id] = g.split(":");
        if (!providerGroups[prefix]) providerGroups[prefix] = { linked: [], registry: [] };
        if (linkedGaugesSet.has(g)) {
            providerGroups[prefix].linked.push(id);
        } else {
            providerGroups[prefix].registry.push(id);
        }
    });

    const activeStartTs = Date.now() - 10800000;

    const promises = Object.entries(providerGroups).map(async ([prefix, groups]) => {
        const provider = providers[prefix];
        if (!provider) return;
        
        // Enforce a 15-minute timeout per provider sync
        try {
            await withTimeout((async () => {
                let linkedCount = 0;
                let registryCount = 0;

                const fetchLinked = async () => {
                    if (groups.linked.length > 0) {
                        try {
                            const data = await provider.getHistory(groups.linked, activeStartTs, Date.now(), true, env);
                            linkedCount = Object.keys(data).length;
                            Object.entries(data).forEach(([id, history]) => {
                                const fullId = `${prefix}:${id}`;
                                mergedData[fullId] = {
                                    ...mergedData[fullId],
                                    ...history,
                                    lat: sanitizeCoordinate(history.lat) ?? sanitizeCoordinate(registryMetadata[fullId]?.lat),
                                    lon: sanitizeCoordinate(history.lon) ?? sanitizeCoordinate(registryMetadata[fullId]?.lon),
                                    state: history.state ?? registryMetadata[fullId]?.state,
                                    section: history.section ?? registryMetadata[fullId]?.section,
                                };
                            });
                        } catch (_e) {
                            await logToD1(env, "WARN", "sync", `Provider ${prefix} linked fetch failed.`, _e);
                        }
                    }
                };

                const fetchRegistry = async () => {
                    if (groups.registry.length > 0) {
                        try {
                            const data = await provider.getLatest(groups.registry, env);
                            registryCount = Object.keys(data).length;
                            Object.entries(data).forEach(([id, reading]) => {
                                const fullId = `${prefix}:${id}`;
                                if (mergedData[fullId]) {
                                    mergedData[fullId].readings = [reading];
                                } else {
                                    mergedData[fullId] = {
                                        id,
                                        name: registryMetadata[fullId]?.name || id,
                                        lat: sanitizeCoordinate(registryMetadata[fullId]?.lat),
                                        lon: sanitizeCoordinate(registryMetadata[fullId]?.lon),
                                        readings: [reading]
                                    };
                                }
                            });
                        } catch (_e) {
                            await logToD1(env, "WARN", "sync", `Provider ${prefix} registry fetch failed.`, _e);
                        }
                    }
                };

                // Run linked and registry fetches in parallel
                await Promise.all([fetchLinked(), fetchRegistry()]);
                
                await logToD1(env, "INFO", "sync", `Provider ${prefix}: Synced ${linkedCount} active and ${registryCount} registry gauges.`);
            })(), 900000, `Provider ${prefix} sync timed out`);
        } catch (e: any) {
            await logToD1(env, "ERROR", "sync", `Provider ${prefix} failed or timed out: ${e.message || e}`);
        }
    });

    await Promise.all(promises);
    return mergedData;
}
