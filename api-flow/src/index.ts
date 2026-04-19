import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { canadaProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { franceProvider } from "./services/france";
import { GaugeProvider, GaugeHistory, Units } from "./services/provider";
import { HistorySchema, ErrorSchema, GenericObjectSchema } from "./schema";
import { toUnitSystemHistory } from "./utils/units";
import { compileGaugeRegistry } from "./services/gaugeRegistry";
import { sendEmail } from "./email";

function slugify(text: string) {
  if (!text) return '';
  const cleaned = text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
  return cleaned.split('-').filter(Boolean).join('-');
}

export interface Env {
    FLOW_STORAGE: R2Bucket;
    DB: D1Database;
}

export const providers: Record<string, GaugeProvider> = {
    "USGS": usgsProvider,
    "NWS": nwsProvider,
    "EC": canadaProvider,
    "UK": ukProvider,
    "ireland": irelandProvider,
    "france": franceProvider
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
            gauges: z.string().openapi({ param: { name: 'gauges', in: 'query' }, example: 'USGS:03451500,ireland:0001' }),
            units: z.string().optional().default('default').openapi({ param: { name: 'units', in: 'query' } }),
            days: z.string().optional().default('7').openapi({ param: { name: 'days', in: 'query' } }),
            forecast: z.string().optional().default('true').openapi({ param: { name: 'forecast', in: 'query' } })
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
            prefix: z.string().openapi({ param: { name: 'prefix', in: 'path' } }),
            id: z.string().openapi({ param: { name: 'id', in: 'path' } })
        }),
        query: z.object({
            units: z.string().optional().openapi({ param: { name: 'units', in: 'query' } })
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
        console.log(`Starting background sync (Cron: ${event.cron})...`);

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
                    registryMetadata = await compileGaugeRegistry(registryMetadata);
                    await env.FLOW_STORAGE.put("gauge_registry.json", JSON.stringify(registryMetadata), {
                        httpMetadata: { contentType: "application/json" }
                    });
                } catch (_e) {
                    console.error("CRITICAL: Registry compilation failed.", _e);
                }
            }

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

            const sanitizeCoordinate = (val: any): number | undefined => {
                if (val === undefined || val === null) return undefined;
                const base = Array.isArray(val) ? val[0] : val;
                const parsed = parseFloat(base);
                return isNaN(parsed) ? undefined : parsed;
            };

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
            });

            await Promise.all(promises);
            (mergedData as any).generatedAt = Date.now();

            await env.FLOW_STORAGE.put("sitedata.json", JSON.stringify(mergedData), {
                httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=300" }
            });

            // --- DAILY DIGEST NOTIFICATION ENGINE ---
            const nowMs = Date.now();
            const currentTime = Math.floor(nowMs / 1000);

            const digestQuery = `
                SELECT 
                    l.owner_id as user_id, 
                    u.email, 
                    u.notifications_time_of_day,
                    c.river_id, 
                    r.name, 
                    r.section,
                    r.flow_min, 
                    r.flow_max, 
                    r.gauges, 
                    c.custom_min, 
                    c.custom_max
                FROM community_lists l
                JOIN community_list_rivers c ON l.id = c.list_id
                JOIN rivers r ON c.river_id = r.id
                JOIN users u ON l.owner_id = u.user_id
                WHERE l.notifications_enabled = 1 
                  AND u.notifications_enabled = 1 
                  AND u.email IS NOT NULL AND u.email != ''
                  AND u.notifications_none_until <= ?
            `;
            const { results: listeningRows } = await env.DB.prepare(digestQuery).bind(currentTime).all();

            const usersMap = new Map<string, { email: string, timeOfDay: string, rivers: any[] }>();
            for (const row of (listeningRows || [])) {
                if (!usersMap.has(row.user_id as string)) {
                    usersMap.set(row.user_id as string, {
                        email: row.email as string,
                        timeOfDay: row.notifications_time_of_day as string || "10:00",
                        rivers: []
                    });
                }
                usersMap.get(row.user_id as string)!.rivers.push({
                    name: row.name,
                    section: row.section,
                    min: row.custom_min !== null ? row.custom_min : row.flow_min,
                    max: row.custom_max !== null ? row.custom_max : row.flow_max,
                    gauges: typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || [])
                });
            }

            const updates: any[] = [];
            const emailsPromises: Promise<any>[] = [];

            for (const [userId, userObj] of usersMap.entries()) {
                const high: string[] = [];
                const running: string[] = [];
                const low: string[] = [];

                for (const river of userObj.rivers) {
                    if (!river.gauges || river.gauges.length === 0) continue;
                    const primaryGaugeId = river.gauges[0].id;
                    const match = mergedData[primaryGaugeId];
                    if (!match || !match.readings || match.readings.length === 0) continue;
                    
                    const reading = match.readings[0].value;
                    const displayName = river.name + (river.section ? ` (${river.section})` : '');

                    if (river.min !== null && river.max !== null) {
                        if (reading > river.max) high.push(`<li>${displayName}: ${reading} (Too High)</li>`);
                        else if (reading >= river.min) running.push(`<li>${displayName}: ${reading}</li>`);
                        else low.push(`<li>${displayName}: ${reading} (Too Low)</li>`);
                    } else if (river.min !== null) {
                        if (reading >= river.min) running.push(`<li>${displayName}: ${reading}</li>`);
                        else low.push(`<li>${displayName}: ${reading} (Too Low)</li>`);
                    } else if (river.max !== null) {
                        if (reading <= river.max) running.push(`<li>${displayName}: ${reading}</li>`);
                        else high.push(`<li>${displayName}: ${reading} (Too High)</li>`);
                    }
                }

                const totalActive = high.length + running.length;

                // Legacy behavior: Only email if something is active
                if (totalActive > 0) {
                    let subject = "Rivers are running!";
                    if (running.length === 1 && high.length === 0) {
                        const rName = running[0].split(':')[0].replace('<li>', '').trim();
                        subject = (rName.endsWith('Creek') ? '' : 'The ') + rName + " is running!";
                    } else if (running.length > 1) {
                        subject = `${running.length} rivers are running!`;
                    }

                    let html = `<html><body>`;
                    if (high.length > 0) html += `<h3>Rivers that are Too High:</h3><ul>${high.join('')}</ul>`;
                    if (running.length > 0) html += `<h3>Rivers that are Running:</h3><ul>${running.join('')}</ul>`;
                    if (low.length > 0) html += `<h3>Rivers that are Too Low:</h3><ul>${low.join('')}</ul>`;
                    
                    html += `<p><a href="https://rivers.run/favorites">View All Favorites on rivers.run</a></p>`;
                    html += `<p>Click <a href="https://rivers.run/favorites">here</a> to manage your subscription.</p></body></html>`;

                    emailsPromises.push(
                        sendEmail({ env, to: userObj.email, subject, html })
                    );
                }

                // Compute NEXT trigger time (legacy getNewNoneUntil logic)
                const [hh, mm] = userObj.timeOfDay.split(':').map(Number);
                const now = new Date();
                const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 10, mm || 0, 0, 0);
                
                if (target.getTime() <= nowMs) {
                    target.setTime(target.getTime() + 24 * 60 * 60 * 1000);
                }
                
                const nextTimestamp = Math.floor(target.getTime() / 1000);
                updates.push(env.DB.prepare("UPDATE users SET notifications_none_until = ? WHERE user_id = ?").bind(nextTimestamp, userId));
            }

            if (emailsPromises.length > 0) {
                _ctx.waitUntil(Promise.all(emailsPromises));
            }
            if (updates.length > 0) {
                // Throttle maximum batches to 100 sequentially to prevent hitting maximum statement limits on massive D1 runs
                for (let i = 0; i < updates.length; i += 100) {
                    const chunk = updates.slice(i, i + 100);
                    await env.DB.batch(chunk);
                }
            }

            // --- SITEMAP GENERATION ---
            if (isDailyMaintenance) {
                console.log("Generating Sitemap...");
                try {
                    const SITE_URL = 'https://rivers.run';
                    const date = new Date().toISOString().split('T')[0];

                    // 1. Fetch D1 data
                    const [riverNamesRaw, listsRaw] = await env.DB.batch([
                        env.DB.prepare("SELECT id, name, section, isGauge FROM rivers"),
                        env.DB.prepare("SELECT id, title FROM community_lists WHERE is_published = 1")
                    ]);

                    const curatedRivers = (riverNamesRaw.results as any[]) || [];
                    const curatedRiverIdsSet = new Set(curatedRivers.map(r => r.id));
                    const lists = (listsRaw.results as any[]) || [];

                    // 2. Build XML
                    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

                    // Static Routes
                    const staticRoutes = ['', '/map', '/lists', '/clubs', '/favorites', '/faq', '/settings', '/terms', '/privacy', '/disclaimer'];
                    staticRoutes.forEach(route => {
                        const p = (route === '' || route === '/map') ? '1.0' : '0.8';
                        xml += `  <url>\n    <loc>${SITE_URL}${route}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p}</priority>\n  </url>\n`;
                    });

                    // Curated Rivers (Priority 0.7 as requested)
                    curatedRivers.forEach(river => {
                        let slug = slugify(river.name);
                        if (river.section) slug += '-' + slugify(river.section);
                        const prefix = river.isGauge ? '/gauge' : '/river';
                        xml += `  <url>\n    <loc>${SITE_URL}${prefix}/${river.id}/${slug}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                    });

                    // Standalone Gauges (Priority 0.4 as requested)
                    Object.entries(registryMetadata).forEach(([fullId, meta]: [string, any]) => {
                        if (curatedRiverIdsSet.has(fullId)) return; // Skip if already covered by curation
                        const slug = slugify(meta.name || fullId);
                        xml += `  <url>\n    <loc>${SITE_URL}/gauge/${fullId}/${slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n`;
                    });

                    // Public Lists (Priority 0.5)
                    lists.forEach(list => {
                        const slug = slugify(list.title);
                        xml += `  <url>\n    <loc>${SITE_URL}/lists/${list.id}/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
                    });

                    xml += `</urlset>`;

                    await env.FLOW_STORAGE.put("sitemap.xml", xml, {
                        httpMetadata: { contentType: "application/xml" }
                    });
                    console.log("Sitemap generation successful.");
                } catch (e) {
                    console.error("Sitemap generation failed:", e);
                }
            }

        } catch (err: unknown) {
            console.error("FATAL: Background sync crashed unexpectedly:", err);
        }
    }
};

const openApiConfig = {
    openapi: '3.0.0',
    info: { title: 'Rivers.run Flow API', version: '1.0.0' }
};

app.doc('/openapi.json', openApiConfig);

app.get('/docs', (c, next) => {
    return apiReference({
        content: app.getOpenAPIDocument(openApiConfig),
        theme: 'purple',
        layout: 'modern'
    })(c as any, next as any);
});
