import { logToD1, pruneLogs } from "./utils/logger";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { apiKeyFlowMiddleware } from "./auth";

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
import { normalizeGaugeId } from "./utils/formatting";
import { generateSitemap } from "./services/sitemap";
import { processNotifications } from "./services/notifications";
import { performDataSync } from "./services/syncScheduler";
import { runIngestCycle, projectSitedata, readLinkedGaugeIds, rowsWrittenByCycle, storeCovers } from "./services/flowSync";
import { readSeries, readSyncState } from "./services/flowStore";
import { syncUsgsReaches } from "./services/usgsReaches";
import { verifyUnsubscribeToken } from "./utils/unsubscribeToken";
import { renderUnsubscribeConfirmation, renderUnsubscribeConfirmPrompt, renderUnsubscribeError, renderUnsubscribeServerError } from "./templates/unsubscribeConfirmation";

export interface Env {
    FLOW_STORAGE: R2Bucket;
    DB: D1Database;
    /** Flow history store (see api-flow/AGENTS.md). Optional: unbound means the legacy path. */
    FLOW_DB?: D1Database;
    /** Optional per-cycle cap on USGS backfill requests (e.g. for local runs). */
    FLOW_BACKFILL_MAX_REQUESTS?: string;
    USGS_API_KEY?: string;
    GMAIL_APP_PASSWORD?: string;
    UNSUBSCRIBE_SECRET?: string;
}

export const providers: Record<string, GaugeProvider> = {
    "USGS": usgsProvider,
    "NWS": nwsProvider,
    "EC": ecProvider,
    "UK": ukProvider,
    "IE": irelandProvider
};

const app = new OpenAPIHono<{ Bindings: Env }>();

// Middlewares
app.use("*", cors({
    origin: "*",
    // POST is intentionally NOT advertised here: the only POST route (/unsubscribe) is hit
    // server-to-server by the mail provider (RFC 8058 one-click) and by a same-origin form,
    // neither of which is CORS-governed. Keeping POST out avoids opening cross-origin POST
    // to every api-flow route by default.
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key", "X-API-Key"],
    // ETag must be exposed for workbox-broadcast-update: it compares this header between
    // the old and new cached /flowdata response to decide whether to notify open tabs that
    // fresh data is available. Without it listed here, the browser hides ETag from JS on
    // this cross-origin response entirely, so the comparison always finds nothing to compare
    // and silently assumes the response is unchanged — tabs then only pick up new data via
    // the visibility-change/heartbeat fallback in useRivers.ts, not the SW's own broadcast.
    exposeHeaders: ["Content-Length", "X-Knative-Response-Contained", "ETag"],
    maxAge: 86400,
}));

// Global error handler
app.onError((err, c) => {
    console.error(`Internal crash processing ${c.req.url}:`, err);
    return c.json({ error: "Internal Server Error" }, 500);
});

const historyRoute = createRoute({
    middleware: [apiKeyFlowMiddleware],
    method: 'get',
    path: '/history',
    summary: 'Fetch Multiple Gauge Histories',
    description: 'Retrieve historical flow readings for up to 10 gauges across multiple providers (e.g. USGS, Environment Canada, NWS).',
    request: {
        query: z.object({
            gauges: z.string().openapi({ param: { name: 'gauges', in: 'query', required: true }, example: 'USGS:03451500,ireland:0001' }),
            units: z.string().openapi({ param: { name: 'units', in: 'query', required: false } }).optional().default('default'),
            days: z.string().openapi({ param: { name: 'days', in: 'query', required: false } }).optional().default('7'),
            forecast: z.string().optional().openapi({ param: { name: 'forecast', in: 'query', required: false }, example: 'true' }),
            since: z.string().optional().openapi({
                param: { name: 'since', in: 'query', required: false },
                example: '1780000000000',
                description: 'Epoch ms. Returns only readings newer than this, for clients that already hold a window and want the delta.'
            }),
        })
    },
    responses: {
        200: {
            description: 'Gauge history map',
            content: { 'application/json': { schema: GenericObjectSchema } }
        },
        304: {
            description: 'Not modified (ETag matched)'
        },
        400: {
            description: 'Invalid Request (Safety Limits Exceeded)',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
});

app.openapi(historyRoute, async (c) => {
    const { gauges: gaugeString, units, days, forecast, since } = c.req.valid('query') as any;
    const gauges = gaugeString.split(",")
        .map((g: string) => normalizeGaugeId(g))
        .filter((g: string) => g.includes(":"));

    // Safety Limits
    if (gauges.length > 10) {
        return c.json({ error: "Too many gauges. Max 10 per request." }, 400);
    }

    const durationDays = parseInt(days) || 7;
    if (durationDays > 30) {
        return c.json({ error: "Duration too long. Max 30 days." }, 400);
    }

    const now = Date.now();
    const windowStart = now - (durationDays * 24 * 60 * 60 * 1000);
    const sinceTs = Number(since);
    // `since` narrows the window but can never widen it past the 30-day cap.
    const start = Number.isFinite(sinceTs) && sinceTs > windowStart ? sinceTs : windowStart;
    const includeForecast = forecast === "true";

    // Serve from the store only where its coverage spans the whole request.
    let stored: Record<string, GaugeHistory> = {};
    let fromStore = new Set<string>();
    if (c.env.FLOW_DB) {
        try {
            const state = await readSyncState(c.env.FLOW_DB, gauges);
            fromStore = new Set(gauges.filter((g: string) => storeCovers(g, state.get(g), start)));
            if (fromStore.size > 0) stored = await readSeries(c.env.FLOW_DB, [...fromStore], start, now, now);
        } catch (e) {
            console.error("Flow store read failed, falling back to live fetch:", e);
            stored = {};
            fromStore = new Set();
        }
    }

    const groupByProvider = (ids: string[]) => {
        const groups: Record<string, string[]> = {};
        for (const g of ids) {
            const [prefix, id] = g.split(":");
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(id);
        }
        return groups;
    };

    const liveGroups = groupByProvider(gauges.filter((g: string) => !fromStore.has(g)));
    const forecastGroups = includeForecast ? groupByProvider([...fromStore]) : {};

    const fetchGroup = async (prefix: string, ids: string[], forecastOnly: boolean) => {
        const provider = providers[prefix];
        if (!provider || (forecastOnly && !provider.getForecast)) return {};
        try {
            const data = forecastOnly
                ? await provider.getForecast!(ids, c.env)
                : await provider.getHistory(ids, start, undefined, includeForecast, c.env);
            const normalized: Record<string, GaugeHistory> = {};
            for (const [id, history] of Object.entries(data)) normalized[`${prefix}:${id}`] = history;
            return normalized;
        } catch (_e) {
            console.error(`Provider ${prefix} history fetch failed:`, _e);
            return {};
        }
    };

    const [live, forecasts] = await Promise.all([
        Promise.all(Object.entries(liveGroups).map(([p, ids]) => fetchGroup(p, ids, false)))
            .then(parts => Object.assign({}, ...parts) as Record<string, GaugeHistory>),
        Promise.all(Object.entries(forecastGroups).map(([p, ids]) => fetchGroup(p, ids, true)))
            .then(parts => Object.assign({}, ...parts) as Record<string, GaugeHistory>),
    ]);

    const merged: Record<string, GaugeHistory> = { ...live };
    for (const [gaugeId, history] of Object.entries(stored)) {
        const future = forecasts[gaugeId]?.readings ?? [];
        merged[gaugeId] = future.length === 0 ? history : {
            ...history,
            readings: [...history.readings, ...future].sort((a, b) => a.dateTime - b.dateTime),
        };
    }

    const converted: Record<string, GaugeHistory> = {};
    for (const [gaugeId, history] of Object.entries(merged)) {
        converted[gaugeId] = toUnitSystemHistory(history, units as Units);
    }

    // Weak ETag over the full body, so a revised value changes it too.
    const body = JSON.stringify(converted);
    const etag = `W/"${body.length}-${hashSignature(body)}"`;
    c.header("ETag", etag);
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    if (c.req.header("If-None-Match") === etag) {
        return c.body(null, 304);
    }
    return c.body(body, 200, { "Content-Type": "application/json" });
});

/** FNV-1a. Not security-relevant; a compact, stable ETag discriminator. */
function hashSignature(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16);
}

const flowdataRoute = createRoute({
    middleware: [apiKeyFlowMiddleware],
    method: 'get',
    path: '/flowdata',
    summary: 'Sync Full Flow Dataset',
    description: 'Download the entire active gauge dataset. Supports ETag headers for efficient local caching and synchronization.',
    responses: {
        200: { 
            description: 'Full reading map', 
            content: { 'application/json': { schema: GenericObjectSchema } } 
        },
        304: {
            description: 'Not modified'
        },
        503: {
            description: 'Sitedata not ready',
            content: { 'application/json': { schema: ErrorSchema } }
        }
    }
});

app.openapi(flowdataRoute, async (c) => {
    const object = await c.env.FLOW_STORAGE.get("sitedata.json", {
        onlyIf: c.req.raw.headers
    });

    if (!object) {
        c.header("Cache-Control", "no-store, max-age=0");
        return c.json({ error: "Sitedata not yet generated" }, 503);
    }

    // Cache the flowdata response for 5 minutes at edge, with 10-minute stale revalidate
    c.header("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
    c.header("ETag", object.httpEtag);

    if (!('body' in object)) {
        return c.body(null, 304);
    }

    // Instead of parsing the JSON and re-stringifying it via c.json(),
    // we can serve the raw JSON string directly from R2 for much better performance!
    c.header("Content-Type", "application/json");
    return c.body(object.body);
});

const gaugeRoute = createRoute({
    middleware: [apiKeyFlowMiddleware],
    method: 'get',
    path: '/gauge/{prefix}/{id}',
    summary: 'Fetch Single Gauge',
    description: 'Get flow readings, historical logs, and metadata for a specific gauge and provider.',
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

    // 6 hours of history populates charts/tables adequately.
    const start = Date.now() - 21600000;
    const gaugeId = normalizeGaugeId(`${prefix}:${id}`);

    if (c.env.FLOW_DB) {
        try {
            const state = await readSyncState(c.env.FLOW_DB, [gaugeId]);
            if (storeCovers(gaugeId, state.get(gaugeId), start)) {
                const stored = await readSeries(c.env.FLOW_DB, [gaugeId], start, Date.now());
                const history = stored[gaugeId];
                if (history && history.readings.length > 0) {
                    return c.json(toUnitSystemHistory(history, units as Units), 200);
                }
            }
        } catch (e) {
            console.error("Flow store read failed, falling back to live fetch:", e);
        }
    }

    try {
        const historyMap = await provider.getHistory([id], start, Date.now(), undefined, c.env);
        const history = historyMap[id];
        if (!history) return c.json({ error: "Gauge not found" }, 404);

        return c.json(toUnitSystemHistory(history, units as Units), 200);
    } catch (_e) {
        console.error("Gauge history fetch failed", _e);
        return c.json({ error: "Fetch failed" }, 500);
    }
});

// Unauthenticated one-click unsubscribe target for List-Unsubscribe / List-Unsubscribe-Post
// (RFC 8058), verifying an HMAC-signed token and flipping the same global
// `users.notifications_enabled` flag the in-app notification settings toggle uses.
//
// GET never mutates - corporate email security gateways and link-safety scanners routinely
// pre-fetch every URL in an email (including the List-Unsubscribe header target) before a
// human opens the message, so a verified GET only renders a confirm step. POST performs the
// actual mutation, used both by Gmail's silent one-click and by that confirm page's own form.
app.on(["GET", "POST"], "/unsubscribe", async (c) => {
    try {
        const uid = c.req.query("uid");
        const iat = Number(c.req.query("iat"));
        const sig = c.req.query("sig") ?? "";

        if (!uid || !c.env.UNSUBSCRIBE_SECRET || !(await verifyUnsubscribeToken(c.env.UNSUBSCRIBE_SECRET, uid, iat, sig))) {
            return c.html(renderUnsubscribeError(), 400);
        }

        const user = await c.env.DB.prepare("SELECT email FROM users WHERE user_id = ?").bind(uid).first<{ email: string }>();
        if (!user) {
            return c.html(renderUnsubscribeError(), 400);
        }

        if (c.req.method === "GET") {
            return c.html(renderUnsubscribeConfirmPrompt({ actionUrl: c.req.url, email: user.email }));
        }

        await c.env.DB.prepare("UPDATE users SET notifications_enabled = 0 WHERE user_id = ?").bind(uid).run();

        const ageDays = Math.floor((Date.now() / 1000 - iat) / 86400);
        await logToD1(c.env, "INFO", "email", `Unsubscribed ${uid} via signed link (${ageDays}d old)`);

        return c.html(renderUnsubscribeConfirmation({ email: user.email, listsUrl: "https://rivers.run/lists" }));
    } catch (e) {
        console.error("Unsubscribe route failed:", e);
        return c.html(renderUnsubscribeServerError(), 500);
    }
});

/**
 * Local dev only: copies production sitedata.json into local R2 and, if
 * missing, derives gauge_registry.json from it so the first cron run skips
 * the multi-minute registry recompile.
 */
app.get("/seed-local-r2", async (c) => {
    const host = new URL(c.req.url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return c.text("Not found", 404);
    try {
        const res = await fetch("https://flow.rivers.run/flowdata", {
            headers: { Origin: "https://rivers.run" },
        });
        if (!res.ok) throw new Error(`Failed to fetch production sitedata: ${res.status} ${res.statusText}`);
        const sitedata = await res.json() as Record<string, any>;
        await c.env.FLOW_STORAGE.put("sitedata.json", JSON.stringify(sitedata), {
            httpMetadata: { contentType: "application/json" }
        });

        let registryNote = "existing gauge_registry.json kept";
        if (!(await c.env.FLOW_STORAGE.head("gauge_registry.json"))) {
            const registry: Record<string, any> = {};
            for (const [id, gauge] of Object.entries(sitedata)) {
                if (!gauge || typeof gauge !== "object" || !id.includes(":")) continue;
                const meta: Record<string, any> = { ...gauge, id };
                delete meta.readings;
                registry[id] = meta;
            }
            await c.env.FLOW_STORAGE.put("gauge_registry.json", JSON.stringify(registry), {
                httpMetadata: { contentType: "application/json" }
            });
            registryNote = `gauge_registry.json derived (${Object.keys(registry).length} gauges)`;
        }
        return c.text(`Local R2 seed successful; ${registryNote}.`);
    } catch (e: any) {
        console.error("Local R2 seeding failed:", e);
        return c.text(`Seeding failed: ${e.message}`, 500);
    }
});


export default {
    fetch: app.fetch,

    async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
        const startTs = Date.now();
        await logToD1(env, "INFO", "sync", `Background sync started. Trigger: ${event.cron || "manual"}`);

        try {
            let registryMetadata: Record<string, any> = {};
            const isWeeklyRecompile = event.cron === "0 0 * * 0" || event.cron === "0 0 * * 5"; // Every Sunday (tests) or Friday (production)
            const isDailyMaintenance = event.cron === "0 0 * * *" || isWeeklyRecompile;
            let needsRecompile = isWeeklyRecompile;

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

                // Sync USGS to NWM reaches mapping
                await syncUsgsReaches(env);
            }


            // 1. Fetch gauges.
            //
            // With FLOW_DB bound, readings are ingested into the durable history
            // store and sitedata.json is projected back out of it. Without it,
            // fall back to the original stateless path so a missing binding
            // degrades rather than breaks.
            let mergedData: Record<string, any>;

            if (env.FLOW_DB) {
                const syncStart = Date.now();
                const now = syncStart;
                const linkedIds = await readLinkedGaugeIds(env);
                const cap = Number(env.FLOW_BACKFILL_MAX_REQUESTS);
                const stats = await runIngestCycle(env, env.FLOW_DB, registryMetadata, providers, now, {
                    linkedIds,
                    backfillRequests: Number.isFinite(cap) && env.FLOW_BACKFILL_MAX_REQUESTS ? cap : undefined,
                });

                let previous: Record<string, any> | null = null;
                try {
                    const obj = await env.FLOW_STORAGE.get("sitedata.json");
                    if (obj) previous = await obj.json() as Record<string, any>;
                } catch (e) {
                    console.warn("Failed to read previous sitedata.json", e);
                }
                mergedData = await projectSitedata(env.FLOW_DB, registryMetadata, linkedIds, stats.forecasts, previous, now);

                const written = rowsWrittenByCycle(stats);
                const u = stats.usgs;
                await logToD1(env, "INFO", "sync",
                    `Store ingest in ${((Date.now() - syncStart) / 1000).toFixed(1)}s: ` +
                    `rows written ${Object.values(written).reduce((a, b) => a + b, 0)}, ` +
                    `USGS requests ${u?.requests ?? 0} (window ${u?.windowBatches ?? 0} batches, ` +
                    `${u?.windowFailed ?? 0} failed; revision ${u?.revision ?? "n/a"}; ` +
                    `backfill ${u?.backfillRequests ?? 0} ${u?.backfillStopped ?? ""}), ` +
                    `rate remaining ${u?.rateRemaining ?? "?"}, errors ${stats.errors}.`,
                    { cycleAt: now, written, usgs: u, providerRows: stats.providerRows });

            } else {
                mergedData = await performDataSync(env, registryMetadata, providers);

                // Resiliency pass: if a gauge failed to fetch readings (e.g. USGS partial outage),
                // recover its previous readings from the existing sitedata.json so the frontend
                // shows stale data rather than nothing.
                //
                // This exists only because the legacy path has no durable store. The FLOW_DB
                // branch above needs no equivalent: a failed provider fetch simply adds no new
                // readings, and the ones already stored are still served.
                try {
                    const previousObject = await env.FLOW_STORAGE.get("sitedata.json");
                    if (previousObject) {
                        const previousData = await previousObject.json() as Record<string, any>;
                        let recoveredCount = 0;
                        for (const [key, gauge] of Object.entries(mergedData)) {
                            if (gauge.readings && gauge.readings.length === 0 && previousData[key] && previousData[key].readings?.length > 0) {
                                gauge.readings = previousData[key].readings;
                                recoveredCount++;
                            }
                        }
                        if (recoveredCount > 0) {
                            await logToD1(env, "INFO", "sync", `Recovered stale readings for ${recoveredCount} gauges due to provider API failures.`);
                        }
                    }
                } catch (e) {
                    console.warn("Failed to merge previous sitedata for outage resilience", e);
                }
            }

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
            
            const totalDuration = (Date.now() - startTs) / 1000;
            await logToD1(env, "INFO", "sync", `Background sync completed successfully in ${totalDuration.toFixed(1)}s.`);

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            await logToD1(env, "ERROR", "sync", `Background sync crashed: ${msg}`, { stack });
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
        const openApiDoc = app.getOpenAPIDocument(openApiConfig);
        if (openApiDoc.paths) {
            for (const methods of Object.values(openApiDoc.paths)) {
                for (const operation of Object.values(methods as any)) {
                    const op = operation as any;
                    op.tags = ['Public Flow & Gauge APIs (API Key Allowed)'];
                }
            }
        }

        app.doc('/openapi.json', openApiDoc);

        app.get('/docs', apiReference({
            content: openApiDoc,
            theme: 'purple',
            layout: 'modern'
        }));
    } catch (e) {
        console.error("OpenAPI/Docs initialization failed:", e);
    }
}
