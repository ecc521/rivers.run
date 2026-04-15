import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { canadaProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { GaugeProvider, GaugeHistory, GaugeReading, GaugeSite, Units } from "./services/provider";
import { HistorySchema, ReadingSchema, SiteSchema } from "./schema";
import { toUnitSystem } from "./utils/units";

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
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

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
    return new Response(object.body, { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
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

app.openapi(gaugeRoute, async (c) => {
    const { prefix, id } = c.req.valid("params");
    const provider = providers[prefix];
    if (!provider) return c.json({ error: "Unknown provider" }, 404);

    // Fetch site
    let site: GaugeSite | null = null;
    if (provider.capabilities.hasSiteListing) {
        try {
            const sites = await provider.getSiteListing([id]);
            if (sites.length > 0) site = sites[0];
        } catch (e) {
            console.error("Failed to fetch site listing", e);
        }
    }

    // Fetch history
    const { units } = c.req.valid("query");
    let history: GaugeHistory | null = null;
    try {
        const endTs = Date.now();
        const startTs = endTs - (7 * 24 * 60 * 60 * 1000); // Default to past 7 days
        const historyData = await provider.getHistory([id], startTs, endTs, true);
        history = historyData[id] || null;
        if (history) {
            history.readings = history.readings.map(r => toUnitSystem(r, provider.preferredUnits, units as Units) as GaugeReading);
        }
    } catch (e) {
        console.error("Failed to fetch gauge history", e);
    }

    if (!site && !history) {
        return c.json({ error: "Gauge not found or no data available" }, 404);
    }

    return c.json({ site, history }, { headers: { "Cache-Control": "public, max-age=300" } });
});

export default {
    fetch: app.fetch,

    /**
     * THE 15-MINUTE GAUGE SCRAPER (CRON)
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log("Starting 15-minute gauge background sync protocol...");

        const { results } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
        if (!results || results.length === 0) return;

        const allGauges = results.map((r: any) => r.gauge_id).join(",");
        const grouping = parseGaugesParam(allGauges);

        const flowData: Record<string, any> = {};
        const endTs = Date.now();
        const startTs = endTs - (3 * 60 * 60 * 1000); // 3 hours

        const promises = Object.entries(grouping).map(async ([prefix, ids]) => {
            const provider = providers[prefix];
            if (provider) {
                const data = await provider.getHistory(ids, startTs, endTs, false);
                for (const [id, history] of Object.entries(data)) {
                    flowData[`${prefix}:${id}`] = history;
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
