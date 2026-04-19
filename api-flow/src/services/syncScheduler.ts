import type { Env } from "../index";
import type { GaugeProvider } from "../services/provider";
import { withTimeout } from "../utils/timeout";

const sanitizeCoordinate = (val: any): number | undefined => {
    if (val === undefined || val === null) return undefined;
    const base = Array.isArray(val) ? val[0] : val;
    const parsed = parseFloat(base);
    return isNaN(parsed) ? undefined : parsed;
};

export async function performDataSync(env: Env, registryMetadata: Record<string, any>, providers: Record<string, GaugeProvider>): Promise<Record<string, any>> {
    let dbGauges: string[] = [];
    
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
            readings: []
        };
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
        
        // Enforce a 5-minute timeout per provider sync
        try {
            await withTimeout((async () => {
                if (groups.linked.length > 0) {
                    try {
                        const data = await provider.getHistory(groups.linked, activeStartTs, Date.now(), true);
                        Object.entries(data).forEach(([id, history]) => {
                            const fullId = `${prefix}:${id}`;
                            mergedData[fullId] = {
                                ...mergedData[fullId],
                                ...history,
                                lat: sanitizeCoordinate(history.lat) ?? sanitizeCoordinate(registryMetadata[fullId]?.lat),
                                lon: sanitizeCoordinate(history.lon) ?? sanitizeCoordinate(registryMetadata[fullId]?.lon),
                                state: history.state ?? registryMetadata[fullId]?.state,
                            };
                        });
                    } catch (_e) {
                        console.error(`- ERROR: provider ${prefix} linked fetch failed:`, _e);
                    }
                }

                if (groups.registry.length > 0) {
                    try {
                        const data = await provider.getLatest(groups.registry);
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
                        console.error(`- ERROR: provider ${prefix} registry fetch failed:`, _e);
                    }
                }
            })(), 600000, `Provider ${prefix} sync timed out`);
        } catch (e: any) {
            console.error(`- TIMEOUT/FAIL: Provider ${prefix} failed or exceeded its 5-minute allocation:`, e.message || e);
        }
    });

    await Promise.all(promises);
    return mergedData;
}
