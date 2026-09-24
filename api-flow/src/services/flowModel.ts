import { Container, getContainer } from "@cloudflare/containers";
import type { Env } from "../index";
import type { GaugeSite } from "./provider";

/**
 * The flow forecast model: a Cloudflare Container (image built in the
 * flow_predictions repo, serving/) that the hourly cron runs once per hour.
 *
 * The container has no R2 credentials. It reads and writes blobs with plain
 * HTTP to http://flow.r2/<key>, which the outbound handler below answers from
 * the FLOW_STORAGE binding, limited to keys under model/. Its layout:
 *
 *   model/usgs_hourly.json.gz        input, written by modelSnapshot.ts
 *   model/weather/...                rolling GFS store, the container's own
 *   model/ratings/ratings.json.gz    USGS stage-discharge tables, the container's own
 *   model/forecasts/latest.json.gz   every gauge; shards/<xx>.json.gz per shard
 *   model/nws_usgs.json              NWS forecast point -> USGS site, from the registry
 */

/** Hourly model run, after the :00 cycle has written the USGS snapshot. */
export const FORECAST_CRON = "10 * * * *";

export const MODEL_PREFIX = "model/";
const WRITABLE = ["model/weather/", "model/ratings/", "model/forecasts/"];
export const FORECAST_PREFIX = "model/forecasts/";
export const N_SHARDS = 256;
const STORAGE_HOST = "flow.r2";
// Plain HTTP on purpose: both hosts are virtual and never leave Cloudflare. The
// container's requests to flow.r2 are intercepted by the outbound handler, and
// "container" addresses the container from its Durable Object.
export const MODEL_STORAGE_ORIGIN = `http://${STORAGE_HOST}`;
// eslint-disable-next-line sonarjs/no-clear-text-protocols
const CONTAINER_ORIGIN = "http://container";

/** 32-bit FNV-1a of the site number's ASCII bytes, mod 256; serving/run.py shard_of. */
export function shardOf(site: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < site.length; i++) {
        h ^= site.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % N_SHARDS;
}

export const shardKey = (shard: number) => `${FORECAST_PREFIX}shards/${shard.toString(16).padStart(2, "0")}.json.gz`;

/**
 * GET/PUT/DELETE http://flow.r2/<key>, and GET http://flow.r2/<prefix>?list=<rest>
 * returning {"keys": [...]} relative to <prefix>. Reads are limited to model/,
 * writes to its weather/, ratings/ and forecasts/ subtrees.
 */
export async function handleModelStorage(req: Request, bucket: R2Bucket): Promise<Response> {
    const url = new URL(req.url);
    const path = decodeURIComponent(url.pathname.slice(1));
    if (!path.startsWith(MODEL_PREFIX) || path.split("/").includes("..")) {
        return new Response("forbidden key", { status: 403 });
    }

    const listArg = url.searchParams.get("list");
    if (req.method === "GET" && listArg !== null) {
        const base = path.endsWith("/") ? path : `${path}/`;
        const keys: string[] = [];
        let cursor: string | undefined;
        do {
            const page = await bucket.list({ prefix: base + listArg, cursor });
            for (const o of page.objects) keys.push(o.key.slice(base.length));
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
        return Response.json({ keys });
    }

    if (req.method === "GET") {
        const obj = await bucket.get(path);
        return obj ? new Response(obj.body) : new Response(null, { status: 404 });
    }
    if (!WRITABLE.some(p => path.startsWith(p))) {
        return new Response("read-only key", { status: 403 });
    }
    if (req.method === "PUT") {
        await bucket.put(path, await req.arrayBuffer(), {
            httpMetadata: { contentType: req.headers.get("Content-Type") ?? "application/octet-stream" },
        });
        return new Response(null, { status: 204 });
    }
    if (req.method === "DELETE") {
        await bucket.delete(path);
        return new Response(null, { status: 204 });
    }
    return new Response("method not allowed", { status: 405 });
}

export class FlowModel extends Container<Env> {
    defaultPort = 8080;
    // Long enough to finish a pass (about 1 to 3 minutes), short of the next hourly run.
    sleepAfter = "10m";
    envVars = {
        SERVING_STORAGE: `${MODEL_STORAGE_ORIGIN}/model`,
        SERVING_SNAPSHOT: `${MODEL_STORAGE_ORIGIN}/model/usgs_hourly.json.gz`,
    };

    static readonly outboundByHost = {
        [STORAGE_HOST]: (req: Request, env: Env) => handleModelStorage(req, env.FLOW_STORAGE),
    };
}

export interface ModelRunResult {
    status: number;
    body: any;
}

/** One hourly pass: weather refresh plus inference, inside the container. */
export async function runForecastModel(env: Env): Promise<ModelRunResult> {
    if (!env.FLOW_MODEL) throw new Error("FLOW_MODEL is not bound");
    const res = await getContainer(env.FLOW_MODEL, "national").fetch(
        new Request(`${CONTAINER_ORIGIN}/run`, { method: "POST" })
    );
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* keep the raw text */ }
    return { status: res.status, body };
}

export interface GaugeForecast {
    issueTime: number;
    cycle: number;
    start: number;
    stepMs: number;
    hours: number;
    units: string;
    calibrated: boolean;
    model: unknown;
    reliability: string | null;
    obsCfs: number | null;
    q10: number[];
    q50: number[];
    q90: number[];
    /** Stage (ft) by the gauge's USGS rating; absent without one, null outside its range. */
    ft10?: (number | null)[];
    ft50?: (number | null)[];
    ft90?: (number | null)[];
}

async function readShard(bucket: R2Bucket, shard: number): Promise<any | null> {
    const obj = await bucket.get(shardKey(shard));
    if (!obj) return null;
    const text = await new Response(obj.body.pipeThrough(new DecompressionStream("gzip"))).text();
    return JSON.parse(text);
}

/** Latest model forecasts for USGS site numbers (no prefix); sites without one are omitted. */
export async function readForecasts(bucket: R2Bucket, sites: string[]): Promise<Record<string, GaugeForecast>> {
    const byShard = new Map<number, string[]>();
    for (const s of sites) {
        const k = shardOf(s);
        byShard.set(k, [...(byShard.get(k) ?? []), s]);
    }
    const out: Record<string, GaugeForecast> = {};
    await Promise.all([...byShard].map(async ([shard, members]) => {
        const doc = await readShard(bucket, shard);
        if (!doc) return;
        for (const site of members) {
            const g = doc.gauges?.[site];
            if (!g) continue;
            out[site] = {
                issueTime: doc.issue_time, cycle: doc.cycle, start: doc.start, stepMs: doc.step_ms,
                hours: doc.hours, units: doc.units, calibrated: doc.calibrated, model: doc.model,
                reliability: g.reliability, obsCfs: g.obs_cfs, q10: g.q10, q50: g.q50, q90: g.q90,
                ...(g.ft50 ? { ft10: g.ft10, ft50: g.ft50, ft90: g.ft90 } : {}),
            };
        }
    }));
    return out;
}

/** NWS forecast point id to the USGS site it sits on (null: none). */
export const NWS_USGS_KEY = "model/nws_usgs.json";
const NWS_USGS_TTL_MS = 10 * 60 * 1000;
let nwsUsgsCache: { at: number; map: Record<string, string | null> } | null = null;

/** The NWS-to-USGS map, cached per isolate for a few minutes. */
export async function readNwsUsgsMap(bucket: R2Bucket, now = Date.now()): Promise<Record<string, string | null>> {
    if (nwsUsgsCache && now - nwsUsgsCache.at < NWS_USGS_TTL_MS) return nwsUsgsCache.map;
    const obj = await bucket.get(NWS_USGS_KEY);
    const map: Record<string, string | null> = obj ? await obj.json() : {};
    nwsUsgsCache = { at: now, map };
    return map;
}

export function clearNwsUsgsCache(): void {
    nwsUsgsCache = null;
}

/**
 * Rebuilds the map for the NWS gauges rivers link to: the registry's (compiled
 * weekly, with each one's NWPS `usgsId`) plus any linked since. A gauge without
 * a registry `usgsId` keeps its previous answer, else is looked up with
 * `listSites` (NWPS gauge metadata); a failed lookup is retried on the next run.
 * Writes only on change; returns the number of NWS gauges with a USGS site.
 */
export async function syncNwsUsgsMap(
    bucket: R2Bucket,
    registry: Record<string, any>,
    linkedIds: string[],
    listSites: (ids: string[]) => Promise<GaugeSite[]>,
): Promise<number> {
    const obj = await bucket.get(NWS_USGS_KEY);
    const prev: Record<string, string | null> = obj ? await obj.json() : {};
    const next: Record<string, string | null> = {};
    const missing: string[] = [];
    const ids = new Set([...Object.keys(registry), ...linkedIds].filter(id => id.startsWith("NWS:")));
    for (const id of ids) {
        const lid = id.slice(4);
        const entry = registry[id];
        if (entry?.usgsId !== undefined) next[lid] = entry.usgsId || null;
        else if (lid in prev) next[lid] = prev[lid];
        else missing.push(lid);
    }
    if (missing.length > 0) {
        for (const site of await listSites(missing)) next[site.id] = site.usgsId || null;
    }
    const sorted = (m: Record<string, string | null>) => JSON.stringify(m, Object.keys(m).sort((a, b) => a.localeCompare(b)));
    const body = sorted(next);
    if (body !== sorted(prev)) {
        await bucket.put(NWS_USGS_KEY, body, { httpMetadata: { contentType: "application/json" } });
        nwsUsgsCache = null;
    }
    return Object.values(next).filter(Boolean).length;
}
