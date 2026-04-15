import { usgsProvider } from "./services/usgs";
import { nwsProvider } from "./services/nws";
import { canadaProvider } from "./services/canada";
import { ukProvider } from "./services/uk";
import { irelandProvider } from "./services/ireland";
import { GaugeProvider, GaugeHistory, GaugeReading, GaugeSite } from "./services/provider";

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

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        const headers = new Headers();
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

        if (request.method === "OPTIONS") {
             return new Response(null, { headers });
        }

        if (url.pathname === "/recent") {
            const object = await env.FLOW_STORAGE.get("flowdata.json");
            if (!object) return new Response("404 Not Found", { status: 404, headers });
            
            headers.set("Content-Type", "application/json");
            return new Response(object.body, { headers });
        }

        if (url.pathname === "/latest") {
            const object = await env.FLOW_STORAGE.get("latestdata.json");
            if (!object) return new Response("404 Not Found", { status: 404, headers });
            
            const gaugesParam = url.searchParams.get("gauges");
            let responseBody: BodyInit = object.body;
            
            if (gaugesParam) {
                 const allLatest = await object.json() as Record<string, any>;
                 const grouping = parseGaugesParam(gaugesParam);
                 const filtered: Record<string, any> = {};
                 
                 for (const [prefix, ids] of Object.entries(grouping)) {
                     for (const id of ids) {
                          const key = `${prefix}:${id}`;
                          if (allLatest[key]) {
                               filtered[key] = allLatest[key];
                          }
                     }
                 }
                 if (allLatest.generatedAt) filtered.generatedAt = allLatest.generatedAt;
                 responseBody = JSON.stringify(filtered);
            }
            
            headers.set("Content-Type", "application/json");
            headers.set("Cache-Control", "public, max-age=300");
            return new Response(responseBody, { headers });
        }

        if (url.pathname === "/history") {
            const grouping = parseGaugesParam(url.searchParams.get("gauges"));
            
            // Allow startTs / endTs params
            const endTsParam = url.searchParams.get("endTs");
            const endTs = endTsParam ? parseInt(endTsParam, 10) : Date.now();
            
            const startTsParam = url.searchParams.get("startTs");
            const startTs = startTsParam ? parseInt(startTsParam, 10) : endTs - (7 * 24 * 60 * 60 * 1000); // default 7 days
            
            const forecastParam = url.searchParams.get("forecast") === "true";

            const mergedData: Record<string, GaugeHistory> = {};

            const promises = Object.entries(grouping).map(async ([prefix, ids]) => {
                const provider = providers[prefix];
                if (provider) {
                    const data = await provider.getHistory(ids, startTs, endTs, forecastParam);
                    for (const [id, history] of Object.entries(data)) {
                        mergedData[`${prefix}:${id}`] = history;
                    }
                }
            });

            try {
                await Promise.all(promises);
                headers.set("Content-Type", "application/json");
                headers.set("Cache-Control", "public, max-age=300");
                return new Response(JSON.stringify(mergedData), { headers });
            } catch (err: any) {
                console.error("History Fetch Error:", err);
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
            }
        }

        if (url.pathname === "/sites") {
            // Allows fetching site listing directly, or hitting cache
            const refresh = url.searchParams.get("refresh") === "true";
            
            if (!refresh) {
                 const cached = await env.FLOW_STORAGE.get("sitedata.json");
                 if (cached) {
                     headers.set("Content-Type", "application/json");
                     return new Response(cached.body, { headers });
                 }
            }

            // Sync from D1
            const { results } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
            if (!results) return new Response("{}", { status: 200, headers });
            
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
            
            // Cache to R2
            await env.FLOW_STORAGE.put("sitedata.json", JSON.stringify(mergedData), {
                 httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=86400" }
            });

            headers.set("Content-Type", "application/json");
            return new Response(JSON.stringify(mergedData), { headers });
        }

        return new Response("Flow Sync API Online.", { status: 200, headers });
    },

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
        
        console.log(`Assembly complete. Pushing ${Object.keys(flowData).length} combined gauges to R2...`);

        await env.FLOW_STORAGE.put("flowdata.json", JSON.stringify(flowData), {
            httpMetadata: {
                contentType: "application/json",
                cacheControl: "public, max-age=900, s-maxage=900"
            }
        });

        // Compute minimal latestData payload for fast polling
        const latestData: Record<string, any> = {};
        for (const [key, history] of Object.entries(flowData)) {
             if (key === "generatedAt") {
                 latestData.generatedAt = history;
                 continue;
             }
             const readings = (history as GaugeHistory).readings;
             if (readings && readings.length > 0) {
                 latestData[key] = readings[readings.length - 1]; // grab absolute latest reading
             }
        }

        await env.FLOW_STORAGE.put("latestdata.json", JSON.stringify(latestData), {
            httpMetadata: {
                contentType: "application/json",
                cacheControl: "public, max-age=900, s-maxage=900"
            }
        });
    }
};
