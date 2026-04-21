import { logToD1, pruneLogs } from "./utils/logger";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { ecProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { GaugeProvider, GaugeHistory, Units } from "./services/provider";
import { HistorySchema, ErrorSchema, GenericObjectSchema } from "./schema";
import { toUnitSystemHistory } from "./utils/units";
import { compileGaugeRegistry } from "./services/gaugeRegistry";
import { withTimeout } from "./utils/timeout";
import { stringifyJSONObject } from "./utils/stream";
import { generateSitemap } from "./services/sitemap";
import { processNotifications } from "./services/notifications";
import { performDataSync } from "./services/syncScheduler";

export interface Env {
    FLOW_STORAGE: R2Bucket;
    DB: D1Database;
}

export const providers: Record<string, GaugeProvider> = {
    "USGS": usgsProvider,
    "NWS": nwsProvider,
    "EC": ecProvider,
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

const historyRoute = createRoute({
    method: 'get',
    path: '/history',
    summary: 'Get historical data for a set of gauges (multi-provider aware)',
    request: {
        query: z.object({
            gauges: z.string().openapi({ param: { name: 'gauges', in: 'query', required: true }, example: 'USGS:03451500,ireland:0001' }),
            units: z.string().openapi({ param: { name: 'units', in: 'query', required: false } }).optional().default('default'),
            days: z.string().openapi({ param: { name: 'days', in: 'query', required: false } }).optional().default('7'),
        })
    },
    responses: {
        200: { 
            description: 'Gauge history map', 
            content: { 'application/json': { schema: GenericObjectSchema } } 
        },
        400: {
            description: 'Invalid Request (Safety Limits Exceeded)',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
});

app.openapi(historyRoute, async (c) => {
    const { gauges: gaugeString, units, days, forecast } = c.req.valid('query') as any;
    const gauges = gaugeString.split(",").map((g: string) => g.trim()).filter((g: string) => g.includes(":"));
    
    // Safety Limits
    if (gauges.length > 10) {
        return c.json({ error: "Too many gauges. Max 10 per request." }, 400);
    }
    
    const durationDays = parseInt(days) || 7;
    if (durationDays > 28) {
        return c.json({ error: "Duration too long. Max 28 days." }, 400);
    }

    const providerGroups: Record<string, string[]> = {};
    gauges.forEach((g: string) => {
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
            const normalized: Record<string, GaugeHistory> = {};
            Object.entries(data).forEach(([id, history]) => {
                normalized[`${prefix}:${id}`] = toUnitSystemHistory(history, units as Units);
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

const flowdataRoute = createRoute({
    method: 'get',
    path: '/flowdata',
    summary: 'The full gauge dataset for local sync',
    responses: {
        200: { 
            description: 'Full reading map', 
            content: { 'application/json': { schema: GenericObjectSchema } } 
        },
        503: {
            description: 'Sitedata not ready',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
});

app.openapi(flowdataRoute, async (c) => {
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
            prefix: z.string().openapi({ param: { name: 'prefix', in: 'path', required: true } }),
            id: z.string().openapi({ param: { name: 'id', in: 'path', required: true } })
        }),
        query: z.object({
            units: z.string().openapi({ param: { name: 'units', in: 'query', required: false } }).optional()
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
    const { units } = c.req.valid('query') as any;
    const provider = providers[prefix];
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    try {
        const historyMap = await provider.getHistory([id], Date.now() - 3600000, Date.now());
        const history = historyMap[id];
        if (!history) return c.json({ error: "Gauge not found" }, 404);

        return c.json(toUnitSystemHistory(history, units as Units), 200);
    } catch (_e) {
        console.error("Gauge history fetch failed", _e);
        return c.json({ error: "Fetch failed" }, 500);
    }
});

export default {
    fetch: app.fetch,

    async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
        await logToD1(env, "INFO", "sync", `Background sync started. Trigger: ${event.cron || "manual"}`);

        try {
            let registryMetadata: Record<string, any> = {};
            const isMonthlyRecompile = event.cron === "0 0 1 * *";
            const isDailyMaintenance = event.cron === "0 0 * * *" || isMonthlyRecompile;
            let needsRecompile = isMonthlyRecompile;

            try {
                const registryObject = await env.FLOW_STORAGE.get("gauge_registry.json");
                if (registryObject) {
                    registryMetadata = await registryObject.json();
                } else {
                    needsRecompile = true;
                }
            } catch (_e) {
                console.warn("Registry metadata load failed, forcing recompile.", _e);
                needsRecompile = true;
            }

            if (needsRecompile) {
                console.log("Triggering Gauge Registry Recompilation (USGS + Canada)...");
                try {
                    // Enforce a maximum 10-minute timeout for the entire registry compilation
                    registryMetadata = await withTimeout(compileGaugeRegistry(env, registryMetadata), 600000, "Registry compilation timed out");
                    
                    // Use streams to avoid stringifying 20k+ gauges entirely into RAM at once
                    const registryBuffer = stringifyJSONObject(registryMetadata);
                    await env.FLOW_STORAGE.put("gauge_registry.json", registryBuffer, {
                        httpMetadata: { contentType: "application/json" }
                    });
                } catch (_e) {
                    console.error("CRITICAL: Registry compilation failed or timed out.", _e);
                }
            }

            // 1. Fetch Gauges
            const mergedData = await performDataSync(env, registryMetadata, providers);

            // Save to storage using buffered construction for R2 compatibility
            const syncBuffer = stringifyJSONObject(mergedData, { generatedAt: Date.now() });

            await env.FLOW_STORAGE.put("sitedata.json", syncBuffer, {
                httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=300" }
            });
            await logToD1(env, "INFO", "sync", `Successfully updated sitedata.json (${Object.keys(mergedData).length} gauges).`);

            // 2. Process Notifications
            await processNotifications(env, mergedData, _ctx);

            // 3. Update Sitemap
            if (isDailyMaintenance) {
                await logToD1(env, "INFO", "maintenance", "Starting daily maintenance (Sitemap generation)...");
                await generateSitemap(env, registryMetadata);
            }

            // 4. Cleanup
            await pruneLogs(env);
            await logToD1(env, "INFO", "sync", "Background sync completed successfully.");

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            await logToD1(env, "ERROR", "sync", `Background sync crashed: ${msg}`, err);
            console.error("FATAL: Background sync crashed unexpectedly:", err);
        }
    }
};

const openApiConfig = {
    openapi: '3.0.0',
    info: { title: 'Rivers.run Flow API', version: '1.0.0' },
    servers: [
        { url: 'https://flow.rivers.run', description: 'Production' },
        { url: 'http://localhost:8787', description: 'Local Development' }
    ]
};

if (process.env.NODE_ENV !== 'test') {
    try {
        app.doc('/openapi.json', openApiConfig);

        app.get('/docs', apiReference({
            content: app.getOpenAPIDocument(openApiConfig),
            theme: 'purple',
            layout: 'modern'
        }));
    } catch (e) {
        console.error("OpenAPI/Docs initialization failed:", e);
    }
}
