import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { canadaProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { GaugeProvider, GaugeHistory, GaugeSite, Units } from "./services/provider";
import { HistorySchema } from "./schema";
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

app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "X-Knative-Response-Contained"],
    maxAge: 86400,
}));

// Expose OpenAPI dynamic specification directly
app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Rivers.run Flow API', version: '1.0.0' }
});

app.get('/docs', apiReference({
    // @ts-expect-error spec type mismatch in this version
    spec: {
        url: '/openapi.json',
    },
    theme: 'purple',
    layout: 'modern'
}));

// Endpoints
// 1. List for specific provider
app.get('/list/:prefix', async (c) => {
    const prefix = c.req.param("prefix");
    const provider = providers[prefix];
    if (!provider) return c.json({ error: "Provider not found" }, 404);
    
    // In-memory or cached?
    const registry = await c.env.FLOW_STORAGE.get("gauge_registry.json");
    if (!registry) return c.json({ error: "Registry not initialized" }, 503);
    
    const data: Record<string, GaugeSite> = await registry.json();
    const filtered = Object.values(data).filter(s => s.id.startsWith(prefix + ":"));
    
    return c.json(filtered);
});

// 2. Recent readings for specific provider (Legacy behavior)
app.get('/recent/:prefix', async (c) => {
    const prefix = c.req.param("prefix");
    const provider = providers[prefix];
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const guagesString = c.req.query("gauges") || "";
    const gauges = guagesString.split(",").filter(v => v);
    
    try {
        const data = await provider.getLatest(gauges);
        return c.json(data);
    } catch (_e) {
        console.error("Recent fetch failed", _e);
        return c.json({ error: "Fetch failed" }, 500);
    }
});

// 3. Historical data for specific provider
app.get('/history/:prefix', async (c) => {
    const prefix = c.req.param("prefix");
    const provider = providers[prefix];
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const gauges = (c.req.query("gauges") || "").split(",").filter(v => v);
    const start = parseInt(c.req.query("start") || "0") || (Date.now() - 86400000);
    const end = parseInt(c.req.query("end") || "0") || Date.now();
    const includeForecast = c.req.query("forecast") === "true";

    try {
        const data = await provider.getHistory(gauges, start, end, includeForecast);
        return c.json(data);
    } catch (_e) {
        console.error("History fetch failed", _e);
        return c.json({ error: "Fetch failed" }, 500);
    }
});

// 4. Historical Data (Proxy to providers)
app.openapi(createRoute({
    method: 'get',
    path: '/recent',
    summary: 'Get recent historical data for a set of gauges (multi-provider aware)',
    request: {
        query: z.object({
            gauges: z.string().openapi({ description: 'Comma separated list of Gauge IDs (e.g. USGS:03451500,USGS:03453500)' }),
            units: z.enum(['default', 'imperial', 'metric']).optional().default('default').openapi({ description: 'Unit system to return' }),
            duration: z.string().optional().default('24h').openapi({ description: 'Duration (e.g. 24h, 7d)' })
        })
    },
    responses: {
        200: { description: 'Gauge history map', content: { 'application/json': { schema: HistorySchema } } }
    }
}), async (c) => {
    const { gauges: gaugeString, units } = c.req.valid('query') as { gauges: string, units: Units };
    const gauges = gaugeString.split(",").map(g => g.trim()).filter(g => g.includes(":"));
    
    // Group by provider
    const providerGroups: Record<string, string[]> = {};
    gauges.forEach(g => {
        const [prefix, id] = g.split(":");
        if (!providerGroups[prefix]) providerGroups[prefix] = [];
        providerGroups[prefix].push(id);
    });

    const start = Date.now() - 86400000; // Default 24h
    const promises = Object.entries(providerGroups).map(async ([prefix, ids]) => {
        const provider = providers[prefix];
        if (!provider) return {};
        try {
            const data = await provider.getHistory(ids, start, Date.now());
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
    return c.json(merged);
});

// 5. The full flowdata.json generator (River-aware)
app.get('/flowdata', async (c) => {
    const cached = await c.env.FLOW_STORAGE.get("sitedata.json");
    if (cached) {
        return c.json(await cached.json(), {
            headers: { "Cache-Control": "public, max-age=300" }
        });
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
        200: { description: 'Gauge data and metadata', content: { 'application/json': { schema: z.any() } } },
        404: { description: 'Provider or Gauge not found' }
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

        return c.json(toUnitSystemHistory(history, units));
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
        const { results: dbResults } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
        const dbGauges = (dbResults || []).map((r: any) => r.gauge_id);

        // 2. Pull gauges from Static Registry (Searchable discovery gauges)
        const searchableGauges = Object.keys(registryMetadata);

        // 3. Unique set of ALL gauges we care about
        const allGauges = [...new Set([...dbGauges, ...searchableGauges])];
        console.log(`Scraping ${allGauges.length} gauges (${dbGauges.length} active river linked)...`);

        // Group by provider
        const providerGroups: Record<string, string[]> = {};
        allGauges.forEach(g => {
            const [prefix, id] = g.split(":");
            if (!providerGroups[prefix]) providerGroups[prefix] = [];
            providerGroups[prefix].push(id);
        });

        // Fetch and merge
        const mergedData: Record<string, GaugeHistory> = {};
        const startTs = Date.now() - 86400000; // 24h lookup

        const promises = Object.entries(providerGroups).map(async ([prefix, ids]) => {
            const provider = providers[prefix];
            if (!provider) return;
            
            console.log(`- Fetching ${ids.length} gauges from ${prefix}...`);
            try {
                const data = await provider.getHistory(ids, startTs, Date.now());
                Object.entries(data).forEach(([id, history]) => {
                    mergedData[`${prefix}:${id}`] = history;
                });
            } catch (_e) {
                console.error(`- ERROR: provider ${prefix} failed:`, _e);
            }
        });

        await Promise.all(promises);
        await env.FLOW_STORAGE.put("sitedata.json", JSON.stringify(mergedData), {
             httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=86400" }
        });
        console.log(`Background sync complete. Pushed ${Object.keys(mergedData).length} gauges to R2.`);
    }
};
