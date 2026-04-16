import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { canadaProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { GaugeProvider, GaugeHistory, Units } from "./services/provider";
import { HistorySchema, ErrorSchema } from "./schema";
import { toUnitSystemHistory } from "./utils/units";
import { compileGaugeRegistry } from "./services/gaugeRegistry";

export interface Env {
    FLOW_STORAGE: R2Bucket;
    DB: D1Database;
}

export const providers: Record<string, GaugeProvider> = {
    "USGS": usgsProvider,
    "NWS": nwsProvider,
    "canada": canadaProvider,
    "UK": ukProvider,
    "ireland": irelandProvider
};

const app = new OpenAPIHono<{ Bindings: Env }>();

// Middlewares
app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "X-Knative-Response-Contained"],
    maxAge: 86400,
}));

// Global error handler
app.onError((err, c) => {
    console.error(`Internal crash processing ${c.req.url}:`, err);
    return c.json({ error: "Internal Server Error" }, 500);
});



// 4. Global Historical Data (Multi-provider)
app.openapi(createRoute({
    method: 'get',
    path: '/history',
    summary: 'Get historical data for a set of gauges (multi-provider aware)',
    request: {
        query: z.object({
            gauges: z.string().openapi({ description: 'Comma separated list of Gauge IDs (e.g. USGS:03451500,ireland:0001)' }),
            units: z.enum(['default', 'imperial', 'metric']).optional().default('default').openapi({ description: 'Unit system to return' }),
            days: z.string().optional().default('7').openapi({ description: 'Number of days to fetch' }),
            forecast: z.string().optional().default('true').openapi({ description: 'Include forecast data if available' })
        })
    },
    responses: {
        200: { 
            description: 'Gauge history map', 
            content: { 'application/json': { schema: z.record(z.string(), HistorySchema) } } 
        },
        400: {
            description: 'Invalid Request (Safety Limits Exceeded)',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    const { gauges: gaugeString, units, days, forecast } = c.req.valid('query') as { gauges: string, units: Units, days: string, forecast: string };
    const gauges = gaugeString.split(",").map(g => g.trim()).filter(g => g.includes(":"));
    
    // Safety Limits
    if (gauges.length > 10) {
        return c.json({ error: "Too many gauges. Max 10 per request." }, 400);
    }
    
    const durationDays = parseInt(days) || 7;
    if (durationDays > 28) {
        return c.json({ error: "Duration too long. Max 28 days." }, 400);
    }

    // Group by provider
    const providerGroups: Record<string, string[]> = {};
    gauges.forEach(g => {
        const [prefix, id] = g.split(":");
        if (!providerGroups[prefix]) providerGroups[prefix] = [];
        providerGroups[prefix].push(id);
    });

    const start = Date.now() - (durationDays * 24 * 60 * 60 * 1000);
    const includeForecast = forecast === "true";

    const promises = Object.entries(providerGroups).map(async ([prefix, ids]) => {
        const provider = providers[prefix];
        if (!provider) return {};
        try {
            const data = await provider.getHistory(ids, start, Date.now(), includeForecast);
            // Apply units
            const normalized: Record<string, GaugeHistory> = {};
            Object.entries(data).forEach(([id, history]) => {
                normalized[`${prefix}:${id}`] = toUnitSystemHistory(history, units);
            });
            return normalized;
        } catch (_e) {
            console.error(`Provider ${prefix} history fetch failed:`, _e);
            return {};
        }
    });

    const results = await Promise.all(promises);
    const merged = Object.assign({}, ...results);
    return c.json(merged, 200);
});



// 2. Full Flow Data Sync (Sitedata)
app.openapi(createRoute({
    method: 'get',
    path: '/flowdata',
    summary: 'The full gauge dataset for local sync',
    responses: {
        200: { 
            description: 'Full reading map', 
            content: { 'application/json': { schema: z.record(z.string(), z.any().openapi({ type: 'object' })) } } 
        },
        503: {
            description: 'Sitedata not ready',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
}), async (c) => {
    const cached = await c.env.FLOW_STORAGE.get("sitedata.json");
    if (cached) {
        const data = await cached.json() as Record<string, any>;
        return c.json(data, 200);
    }
    return c.json({ error: "Sitedata not yet generated" }, 503);
});

const gaugeRoute = createRoute({
    method: 'get',
    path: '/gauge/{prefix}/{id}',
    summary: 'Get site metadata and history for a single gauge',
    request: {
        params: z.object({
            prefix: z.string().openapi({ description: 'Provider prefix (e.g. USGS, NWS)' }),
            id: z.string().openapi({ description: 'Gauge ID' })
        }),
        query: z.object({
            units: z.enum(['default', 'imperial', 'metric']).optional().default('default').openapi({ description: 'Unit system to return' })
        })
    },
    responses: {
        200: { description: 'Gauge data and metadata', content: { 'application/json': { schema: HistorySchema } } },
        404: { description: 'Provider or Gauge not found', content: { 'application/json': { schema: ErrorSchema } } },
        500: { description: 'Fetch failed', content: { 'application/json': { schema: ErrorSchema } } }
    }
});

app.openapi(gaugeRoute, async (c) => {
    const { prefix, id } = c.req.valid('param');
    const { units } = c.req.valid('query') as { units: Units };
    const provider = providers[prefix];
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    try {
        const historyMap = await provider.getHistory([id], Date.now() - 3600000, Date.now());
        const history = historyMap[id];
        if (!history) return c.json({ error: "Gauge not found" }, 404);

        return c.json(toUnitSystemHistory(history, units), 200);
    } catch (_e) {
        console.error("Gauge history fetch failed", _e);
        return c.json({ error: "Fetch failed" }, 500);
    }
});



export default {
    fetch: app.fetch,

    /**
     * THE 15-MINUTE GAUGE SCRAPER (CRON)
     */
    async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
        console.log(`Starting background sync (Cron: ${event.cron})...`);

        try {
            // Check if we need to recompile the registry (Monthly or if missing)
            let registryMetadata: Record<string, any> = {};
            let needsRecompile = event.cron === "0 0 1 * *"; // Monthly trigger

            try {
                const registryObject = await env.FLOW_STORAGE.get("gauge_registry.json");
                if (registryObject) {
                    registryMetadata = await registryObject.json();
                } else {
                    console.log("Registry missing from R2. Forcing immediate compilation.");
                    needsRecompile = true;
                }
            } catch (_e) {
                console.warn("Registry load failed, attempting recompile.", _e);
                needsRecompile = true;
            }

            if (needsRecompile) {
                console.log("Triggering Gauge Registry Recompilation (USGS + Canada)...");
                try {
                    registryMetadata = await compileGaugeRegistry(registryMetadata);
                    await env.FLOW_STORAGE.put("gauge_registry.json", JSON.stringify(registryMetadata), {
                        httpMetadata: { contentType: "application/json" }
                    });
                    console.log(`Registry recompiled successfully with ${Object.keys(registryMetadata).length} gauges.`);
                } catch (_e) {
                    console.error("CRITICAL: Registry compilation failed.", _e);
                }
            }

            // 1. Pull gauges from DB (Linked to rivers)
            // Note: We used to use a 'river_gauges' cross-ref table, but migrated to JSON-in-Row in the 'rivers' table.
            const { results: riverResults } = await env.DB.prepare("SELECT gauges FROM rivers").all();
            const dbGauges: string[] = (riverResults || []).flatMap((row: any) => {
                try {
                    const gauges = typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || []);
                    return gauges.map((g: any) => g.id);
                } catch (e) {
                    console.warn("Failed to parse gauges for a river row:", e);
                    return [];
                }
            });

            // 2. Pull gauges from Static Registry (Searchable discovery gauges)
            const searchableGauges = Object.keys(registryMetadata);
            
            // 3. Setup Fetch Groups and Initialize mergedData with Skeletons
            const linkedGaugesSet = new Set(dbGauges);
            const mergedData: Record<string, any> = {};

            // Pre-populate mergedData with ALL registry gauges (Searchable discovery gauges)
            // This ensures they appear on the map even if they have no recent readings (Grey/Purple markers)
            Object.entries(registryMetadata).forEach(([fullId, meta]) => {
                mergedData[fullId] = {
                    id: meta.id.includes(":") ? meta.id.split(":")[1] : meta.id,
                    name: meta.name,
                    lat: meta.lat,
                    lon: meta.lon,
                    readings: []
                };
            });
            
            // Group by provider
            const providerGroups: Record<string, { linked: string[], registry: string[] }> = {};
            [...new Set([...dbGauges, ...searchableGauges])].forEach(g => {
                if (!g || !g.includes(":")) return; // skip malformed/missing gauge IDs
                const [prefix, id] = g.split(":");
                if (!providerGroups[prefix]) providerGroups[prefix] = { linked: [], registry: [] };
                if (linkedGaugesSet.has(g)) {
                    providerGroups[prefix].linked.push(id);
                } else {
                    providerGroups[prefix].registry.push(id);
                }
            });

            // Keep track of readings separately then merge
            const activeStartTs = Date.now() - 10800000; // 3 hours

            const promises = Object.entries(providerGroups).map(async ([prefix, groups]) => {
                const provider = providers[prefix];
                if (!provider) return;
                
                // A. Fetch Linked (3h History + Forecasts)
                if (groups.linked.length > 0) {
                    try {
                        const data = await provider.getHistory(groups.linked, activeStartTs, Date.now(), true);
                        Object.entries(data).forEach(([id, history]) => {
                            const fullId = `${prefix}:${id}`;
                            // Merge history into skeleton, preserving registry coords if provider lacks them
                            mergedData[fullId] = {
                                ...mergedData[fullId],
                                ...history,
                                // If the registry had coordinates, ensure they are kept
                                lat: history.lat ?? registryMetadata[fullId]?.lat,
                                lon: history.lon ?? registryMetadata[fullId]?.lon,
                            };
                        });
                    } catch (_e) {
                        console.error(`- ERROR: provider ${prefix} linked fetch failed:`, _e);
                    }
                }

                // B. Fetch Registry (Latest Only)
                if (groups.registry.length > 0) {
                    try {
                        const data = await provider.getLatest(groups.registry);
                        Object.entries(data).forEach(([id, reading]) => {
                            const fullId = `${prefix}:${id}`;
                            // Merge into existing skeleton (or create if missing)
                            if (mergedData[fullId]) {
                                mergedData[fullId].readings = [reading];
                            } else {
                                mergedData[fullId] = {
                                    id,
                                    name: registryMetadata[fullId]?.name || id,
                                    lat: registryMetadata[fullId]?.lat,
                                    lon: registryMetadata[fullId]?.lon,
                                    readings: [reading]
                                };
                            }
                        });
                    } catch (_e) {
                        console.error(`- ERROR: provider ${prefix} registry fetch failed:`, _e);
                    }
                }
            });

            await Promise.all(promises);
            
            // Add timestamp of generation
            (mergedData as any).generatedAt = Date.now();

            await env.FLOW_STORAGE.put("sitedata.json", JSON.stringify(mergedData), {
                httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=300" }
            });
            console.log(`Background sync complete. Pushed ${Object.keys(mergedData).length} gauges to R2.`);

        } catch (err: unknown) {
            console.error("FATAL: Background sync crashed unexpectedly:", err);
            // We want to at least know it failed in the logs.
        }
    }
};

const openApiConfig = {
    openapi: '3.1.0',
    info: { title: 'Rivers.run Flow API', version: '1.0.0' }
};

// Expose OpenAPI dynamic specification directly
app.doc('/openapi.json', openApiConfig);

app.get('/docs', (c, next) => {
    return apiReference({
        content: app.getOpenAPI31Document(openApiConfig),
        theme: 'purple',
        layout: 'modern'
    })(c as any, next as any);
});
