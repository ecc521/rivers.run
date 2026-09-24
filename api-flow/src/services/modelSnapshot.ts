import { readHourlySums } from "./flowStore";

/**
 * Hourly export of recent USGS discharge and stage for the forecast model.
 * Format is documented in api-flow/AGENTS.md; keep the two in sync.
 */

export const SNAPSHOT_KEY = "model/usgs_hourly.json.gz";
export const SNAPSHOT_HOURS = 192;
export const SNAPSHOT_VERSION = 1;
const HOUR_MS = 3_600_000;
const SITES_PER_QUERY = 500;

export interface UsgsHourlySnapshot {
    version: number;
    generated_at: number;
    /** Label (start, ms) of hour index 0. The last hour is the current, partial one. */
    start: number;
    hours: number;
    step_ms: number;
    sites: string[];
    discharge_cfs: Array<Array<number | null>>;
    discharge_n: number[][];
    stage_ft: Array<Array<number | null>>;
    stage_n: number[][];
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export async function buildUsgsHourlySnapshot(
    db: D1Database,
    siteIds: string[],
    now: number
): Promise<UsgsHourlySnapshot> {
    const sites = [...new Set(siteIds)].sort((a, b) => a.localeCompare(b));
    const end = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
    const start = end - SNAPSHOT_HOURS * HOUR_MS;

    const snap: UsgsHourlySnapshot = {
        version: SNAPSHOT_VERSION, generated_at: now, start, hours: SNAPSHOT_HOURS, step_ms: HOUR_MS,
        sites, discharge_cfs: [], discharge_n: [], stage_ft: [], stage_n: [],
    };

    for (let i = 0; i < sites.length; i += SITES_PER_QUERY) {
        const chunk = sites.slice(i, i + SITES_PER_QUERY);
        const sums = await readHourlySums(db, chunk.map(s => `USGS:${s}`), start, end, now);
        for (const site of chunk) {
            const perHour = sums.get(`USGS:${site}`);
            const cfs: Array<number | null> = new Array(SNAPSHOT_HOURS).fill(null);
            const cfsN: number[] = new Array(SNAPSHOT_HOURS).fill(0);
            const ft: Array<number | null> = new Array(SNAPSHOT_HOURS).fill(null);
            const ftN: number[] = new Array(SNAPSHOT_HOURS).fill(0);
            for (const [hourTs, s] of perHour ?? []) {
                const idx = (hourTs - start) / HOUR_MS;
                if (idx < 0 || idx >= SNAPSHOT_HOURS) continue;
                if (s.cfsN > 0) { cfs[idx] = round(s.cfsSum / s.cfsN); cfsN[idx] = s.cfsN; }
                if (s.ftN > 0) { ft[idx] = round(s.ftSum / s.ftN); ftN[idx] = s.ftN; }
            }
            snap.discharge_cfs.push(cfs);
            snap.discharge_n.push(cfsN);
            snap.stage_ft.push(ft);
            snap.stage_n.push(ftN);
        }
    }
    return snap;
}

export async function gzip(text: string): Promise<ArrayBuffer> {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
}

export async function writeUsgsHourlySnapshot(
    env: { FLOW_STORAGE: R2Bucket },
    db: D1Database,
    siteIds: string[],
    now: number
): Promise<{ sites: number; jsonBytes: number; gzBytes: number }> {
    const snap = await buildUsgsHourlySnapshot(db, siteIds, now);
    const json = JSON.stringify(snap);
    const gz = await gzip(json);
    await env.FLOW_STORAGE.put(SNAPSHOT_KEY, gz, {
        httpMetadata: { contentType: "application/gzip" },
        customMetadata: { version: String(snap.version), generated_at: String(now), start: String(snap.start) },
    });
    return { sites: snap.sites.length, jsonBytes: json.length, gzBytes: gz.byteLength };
}
