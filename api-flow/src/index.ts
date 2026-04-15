import { loadSitesFromUSGS } from "./services/usgs";
import { loadSitesFromNWS } from "./services/nws";
import { loadCanadianProvince } from "./services/canada";

export interface Env {
    FLOW_STORAGE: R2Bucket;
    DB: D1Database;
}

export default {
    /**
     * STANDARD PROXY ROUTES (GET /recent, GET /history)
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // CORS Headers universally allow access for graphing tools or 3rd party domains
        const headers = new Headers();
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

        if (request.method === "OPTIONS") {
             return new Response(null, { headers });
        }

        if (url.pathname === "/recent") {
            const object = await env.FLOW_STORAGE.get("flowdata.json");
            if (!object) return new Response("404 Not Found", { status: 404, headers });
            
            // Native pass-through routing directly from R2 to the client
            headers.set("Content-Type", "application/json");
            // NOTE: Brotli is handled seamlessly by Cloudflare automatically on txt/json responses!
            return new Response(object.body, { headers });
        }

        if (url.pathname === "/history") {
            const gauge = url.searchParams.get("gauge");
            if (!gauge) return new Response("Missing gauge parameter", { status: 400, headers });

            // Example integration wrapper mimicking historical proxy for Canada / NWS
            // (Expanding on this later based on CORS mitigation needs)
            headers.set("Content-Type", "application/json");
            return new Response(JSON.stringify({ error: "Proxy interface scaffolded for " + gauge }), { headers });
        }

        return new Response("Flow Sync API Online.", { status: 200, headers });
    },

    /**
     * THE 15-MINUTE GAUGE SCRAPER (CRON)
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log("Starting 15-minute gauge background sync protocol...");

        // 1. Fetch exactly what gauges are explicitly cared about natively from the DB
        const { results } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
        if (!results || results.length === 0) {
             console.log("No active gauges found in D1, terminating sync cleanly.");
             return;
        }

        const usgsSet = new Set<string>();
        const canadaSet = new Set<string>();
        const nwsSet = new Set<string>();

        for (const row of results as { gauge_id: string }[]) {
             if (!row.gauge_id) continue;
             if (row.gauge_id.startsWith("USGS:")) usgsSet.add(row.gauge_id.replace("USGS:", ""));
             else if (row.gauge_id.startsWith("canada:")) canadaSet.add(row.gauge_id.replace("canada:", ""));
             else if (row.gauge_id.startsWith("NWS:")) nwsSet.add(row.gauge_id.replace("NWS:", ""));
        }

        const activeUsgsGauges = Array.from(usgsSet);
        const activeCanadaGauges = Array.from(canadaSet);
        const activeNwsGauges = Array.from(nwsSet);

        // Extrapolate canada provinces
        const provinces = new Set<string>();
        const validProvinces = new Set(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]);
        activeCanadaGauges.forEach(code => {
             if (code.length > 2) {
                  const prov = code.substring(0, 2).toUpperCase();
                  if (validProvinces.has(prov)) provinces.add(prov);
             }
        });

        console.log(`Discovered ${activeUsgsGauges.length} USGS, ${activeNwsGauges.length} NWS, ${activeCanadaGauges.length} Canada targets.`);

        // 3. Kick off async network pulls concurrently
        const flowData: Record<string, any> = {};

        const [usgsData, nwsData, ...canadaProvinceData] = await Promise.all([
             loadSitesFromUSGS(activeUsgsGauges, 1000 * 60 * 60 * 3), 
             loadSitesFromNWS(activeNwsGauges, 1000 * 60 * 60 * 3),
             ...Array.from(provinces).map(prov => loadCanadianProvince(prov))
        ]);

        // 4. Merge results deeply
        for (const [key, value] of Object.entries(usgsData)) {
             flowData["USGS:" + key] = value;
        }
        for (const [key, value] of Object.entries(nwsData)) {
             flowData["NWS:" + key] = value;
        }
        canadaProvinceData.forEach((provData: any) => {
             for (const [key, value] of Object.entries(provData)) {
                  if (canadaSet.has(key)) flowData["canada:" + key] = value;
             }
        });

        flowData.generatedAt = Date.now();
        console.log(`Assembly complete. Pushing ${Object.keys(flowData).length} combined gauges to R2...`);

        // 5. Write Payload directly into R2 Storage
        const payloadJson = JSON.stringify(flowData);

        // Put the json physically into the bucket
        await env.FLOW_STORAGE.put("flowdata.json", payloadJson, {
            httpMetadata: {
                contentType: "application/json",
                cacheControl: "public, max-age=900, s-maxage=900"
            }
        });

        console.log("Cron execution terminated successfully.");
    }
};
