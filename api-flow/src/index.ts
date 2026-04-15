import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { canadaProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { GaugeProvider, GaugeHistory, GaugeReading, GaugeSite, Units } from "./services/provider";
import { HistorySchema, ReadingSchema, SiteSchema } from "./schema";
import { toUnitSystem } from "./utils/units";
import { compileGaugeRegistry } from "./services/gaugeRegistry";

export interface Env {
    FLOW_STORAGE: R2Bucket;
    DB: D1Database;
}

const providers: Record<string, GaugeProvider> = {
    "USGS": usgsProvider,
    "NWS": nwsProvider,
    "canada": canadaProvider,
    "UK": ukProvider,
    "ireland": irelandProvider
};

const app = new OpenAPIHono<{ Bindings: Env }>();

app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
}));

/**
 * PARSERS
 */
function parseGaugesParam(param: string | null): Record<string, string[]> {
    const list = (param || "").split(",").filter(Boolean);
    const parsed: Record<string, string[]> = {};
    for (const item of list) {
        const colonIdx = item.indexOf(":");
        if (colonIdx > 0) {
            const prefix = item.substring(0, colonIdx);
            const id = item.substring(colonIdx + 1);
            if (!parsed[prefix]) parsed[prefix] = [];
            parsed[prefix].push(id);
        }
    }
    return parsed;
}

/**
 * ROUTES
 */

// 1. Documentation
app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Rivers.run Flow API', version: '1.0.0' }
});
app.get('/docs', apiReference({
    spec: { url: '/openapi.json' },
    theme: 'purple',
    layout: 'modern',
    defaultContext: {
        baseUrl: 'https://api-flow.rivers.run',
    }
}));

// 2. Recent Data (Cached in R2)
const recentRoute = createRoute({
    method: 'get',
    path: '/recent',
    summary: 'Get all recent gauge data',
    description: 'Returns the full 15-minute cached payload from R2 storage.',
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Recent flow data' },
        404: { description: 'Data not found' }
    }
});

app.openapi(recentRoute, async (c) => {
    const object = await c.env.FLOW_STORAGE.get("flowdata.json");
    if (!object) return c.json({ error: "Data not found" }, 404);
    return new Response(object.body, { headers: { "Content-Type": "application/json" } });
});

// 3. Latest Readings (Single latest for each gauge)
const latestRoute = createRoute({
    method: 'get',
    path: '/latest',
    summary: 'Get latest points for specific gauges',
    request: {
        query: z.object({
            gauges: z.string().optional().openapi({ description: 'Comma separated list of prefix:id, e.g. USGS:03451500,ireland:25134' }),
            units: z.enum(['default', 'imperial', 'metric']).optional().default('default').openapi({ description: 'Unit system to return' })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.record(ReadingSchema) } }, description: 'Latest readings' },
        404: { description: 'Data not found' }
    }
});

app.openapi(latestRoute, async (c) => {
    const object = await c.env.FLOW_STORAGE.get("latestdata.json");
    if (!object) return c.json({ error: "Data not found" }, 404);
    
    const { gauges, units } = c.req.valid("query");
    const allLatest = await object.json() as Record<string, any>;

    if (!gauges) {
        // We can't easily normalize the whole bulk blob here without knowing each prefix's native system
        // But the scraper already caches normalized values or we handle it per-key
        return c.json(allLatest, { headers: { "Cache-Control": "public, max-age=300" } });
    }

    const grouping = parseGaugesParam(gauges);
    const filtered: Record<string, any> = {};
    
    for (const [prefix, ids] of Object.entries(grouping)) {
        const provider = providers[prefix];
        for (const id of ids) {
             const key = `${prefix}:${id}`;
             if (allLatest[key]) {
                  filtered[key] = provider 
                    ? toUnitSystem(allLatest[key], provider.preferredUnits, units as Units)
                    : allLatest[key];
             }
        }
    }
    if (allLatest.generatedAt) filtered.generatedAt = allLatest.generatedAt;
    return c.json(filtered, { headers: { "Cache-Control": "public, max-age=300" } });
});

// 4. Historical Data (Proxy to providers)
const historyRoute = createRoute({
    method: 'get',
    path: '/history',
    summary: 'Fetch historical gauge data',
    request: {
        query: z.object({
            gauges: z.string().openapi({ description: 'Prefix:ID list' }),
            startTs: z.string().optional().openapi({ description: 'Start timestamp (ms)' }),
            endTs: z.string().optional().openapi({ description: 'End timestamp (ms)' }),
            forecast: z.string().optional().openapi({ description: 'Include forecast data if available' }),
            units: z.enum(['default', 'imperial', 'metric']).optional().default('default').openapi({ description: 'Unit system to return' })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.record(HistorySchema) } }, description: 'Historical data' }
    }
});

app.openapi(historyRoute, async (c) => {
    const { gauges, startTs: startTsParam, endTs: endTsParam, forecast: forecastParam, units } = c.req.valid("query");
    const grouping = parseGaugesParam(gauges);
    
    const endTs = endTsParam ? parseInt(endTsParam, 10) : Date.now();
    const startTs = startTsParam ? parseInt(startTsParam, 10) : endTs - (7 * 24 * 60 * 60 * 1000);
    const forecast = forecastParam === "true";

    const mergedData: Record<string, GaugeHistory> = {};
    const promises = Object.entries(grouping).map(async ([prefix, ids]) => {
        const provider = providers[prefix];
        if (provider) {
            const data = await provider.getHistory(ids, startTs, endTs, forecast);
            for (const [id, history] of Object.entries(data)) {
                // Normalize and filter based on requested units
                history.readings = history.readings.map(r => toUnitSystem(r, provider.preferredUnits, units as Units) as GaugeReading);
                mergedData[`${prefix}:${id}`] = history;
            }
        }
    });

    await Promise.all(promises);
    return c.json(mergedData, { headers: { "Cache-Control": "public, max-age=300" } });
});

// 5. Site Metadata
const sitesRoute = createRoute({
    method: 'get',
    path: '/sites',
    summary: 'Get site metadata (lat/lon/name)',
    request: {
        query: z.object({ refresh: z.string().optional().openapi({ description: 'Bypass cache and force sync from D1' }) })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.record(SiteSchema) } }, description: 'Site metadata' }
    }
});

app.openapi(sitesRoute, async (c) => {
    const { refresh: refreshParam } = c.req.valid("query");
    const refresh = refreshParam === "true";
    if (!refresh) {
         const cached = await c.env.FLOW_STORAGE.get("sitedata.json");
         if (cached) {
            return new Response(cached.body, { headers: { "Content-Type": "application/json" } });
         }
    }

    const { results } = await c.env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
    if (!results) return c.json({});
    
    const siteParam = results.map((r: any) => r.gauge_id).join(",");
    const grouping = parseGaugesParam(siteParam);
    const mergedData: Record<string, GaugeSite> = {};

    const promises = Object.entries(grouping).map(async ([prefix, ids]) => {
        const provider = providers[prefix];
        if (provider && provider.capabilities.hasSiteListing) {
            const data = await provider.getSiteListing(ids);
            for (const site of data) {
                mergedData[`${prefix}:${site.id}`] = site;
            }
        }
    });

    await Promise.all(promises);
    await c.env.FLOW_STORAGE.put("sitedata.json", JSON.stringify(mergedData), {
         httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=86400" }
    });
    return c.json(mergedData);
});

// 6. Single Gauge (Site + History)
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
        200: { description: 'Gauge data and metadata', content: { 'application/json': { schema: z.any() } } },
        404: { description: 'Provider or Gauge not found' }
    }
});

export default {
    fetch: app.fetch,

    /**
     * THE 15-MINUTE GAUGE SCRAPER (CRON)
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Starting background sync (Cron: ${event.cron})...`);

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
        } catch (e) {
            console.warn("Registry load failed, attempting recompile.", e);
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
            } catch (e) {
                console.error("CRITICAL: Registry compilation failed.", e);
            }
        }

        // 1. Pull gauges from DB (Linked to rivers)
        const { results: dbResults } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
        const dbGauges = (dbResults || []).map((r: any) => r.gauge_id);

        // 2. Pull gauges from Static Registry (Searchable discovery gauges)
        let registryGauges: string[] = [];
        // registryMetadata is already populated from the compilation check above
        if (registryMetadata) {
            registryGauges = Object.keys(registryMetadata);
        }

        // 3. Merge and Deduplicate
        const uniqueGauges = Array.from(new Set([...dbGauges, ...registryGauges]));
        if (uniqueGauges.length === 0) return;

        console.log(`Synchronizing ${uniqueGauges.length} total gauges (${dbGauges.length} DB, ${registryGauges.length} Registry)...`);

        const allGaugesParam = uniqueGauges.join(",");
        const grouping = parseGaugesParam(allGaugesParam);

        const flowData: Record<string, any> = {};
        const endTs = Date.now();
        const startTs = endTs - (3 * 60 * 60 * 1000); // 3 hours

        const promises = Object.entries(grouping).map(async ([prefix, ids]) => {
            const provider = providers[prefix];
            if (provider) {
                try {
                    const data = await provider.getHistory(ids, startTs, endTs, false);
                    for (const [id, history] of Object.entries(data)) {
                        const fullId = `${prefix}:${id}`;
                        const h = history as any;
                        // Inject metadata from registry if available
                        if (registryMetadata[fullId]) {
                            h.name = registryMetadata[fullId].name;
                            h.lat = registryMetadata[fullId].lat;
                            h.lon = registryMetadata[fullId].lon;
                        }
                        flowData[fullId] = h;
                    }
                } catch (e) {
                    console.error(`Fetch failed for provider ${prefix}:`, e);
                }
            }
        });

        await Promise.all(promises);
        flowData.generatedAt = Date.now();
        
        await env.FLOW_STORAGE.put("flowdata.json", JSON.stringify(flowData), {
            httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=900, s-maxage=900" }
        });

        const latestData: Record<string, any> = {};
        for (const [key, history] of Object.entries(flowData)) {
             if (key === "generatedAt") {
                 latestData.generatedAt = history;
                 continue;
             }
             const readings = (history as GaugeHistory).readings;
             if (readings && readings.length > 0) {
                 latestData[key] = readings[readings.length - 1];
             }
        }

        await env.FLOW_STORAGE.put("latestdata.json", JSON.stringify(latestData), {
            httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=900, s-maxage=900" }
        });
    }
};
