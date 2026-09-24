import { readHourlySums } from "./flowStore";

/**
 * Hourly export of recent USGS discharge and stage for the forecast model.
 * Format is documented in api-flow/AGENTS.md; keep the two in sync.
 *
 * Values live in typed arrays and the JSON is streamed through gzip, so a
 * full snapshot (~30MB of JSON) never exists as one string in memory.
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

/** sites x hours grids, row-major. NaN marks a missing mean. */
export interface HourlyGrid {
    sites: string[];
    start: number;
    cfs: Float64Array;
    cfsN: Uint8Array;
    ft: Float64Array;
    ftN: Uint8Array;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export async function collectUsgsHourly(db: D1Database, siteIds: string[], now: number): Promise<HourlyGrid> {
    const sites = [...new Set(siteIds)].sort((a, b) => a.localeCompare(b));
    const end = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
    const start = end - SNAPSHOT_HOURS * HOUR_MS;
    const size = sites.length * SNAPSHOT_HOURS;
    const grid: HourlyGrid = {
        sites, start,
        cfs: new Float64Array(size).fill(NaN), cfsN: new Uint8Array(size),
        ft: new Float64Array(size).fill(NaN), ftN: new Uint8Array(size),
    };

    for (let i = 0; i < sites.length; i += SITES_PER_QUERY) {
        const chunk = sites.slice(i, i + SITES_PER_QUERY);
        const sums = await readHourlySums(db, chunk.map(s => `USGS:${s}`), start, end, now);
        chunk.forEach((site, j) => {
            for (const [hourTs, s] of sums.get(`USGS:${site}`) ?? []) {
                const h = (hourTs - start) / HOUR_MS;
                if (h < 0 || h >= SNAPSHOT_HOURS) continue;
                const idx = (i + j) * SNAPSHOT_HOURS + h;
                if (s.cfsN > 0) { grid.cfs[idx] = round(s.cfsSum / s.cfsN); grid.cfsN[idx] = s.cfsN; }
                if (s.ftN > 0) { grid.ft[idx] = round(s.ftSum / s.ftN); grid.ftN[idx] = s.ftN; }
            }
        });
    }
    return grid;
}

function rowJson(values: Float64Array | Uint8Array, row: number): string {
    const parts: string[] = new Array(SNAPSHOT_HOURS);
    for (let h = 0; h < SNAPSHOT_HOURS; h++) {
        const v = values[row * SNAPSHOT_HOURS + h];
        parts[h] = Number.isNaN(v) ? "null" : String(v);
    }
    return `[${parts.join(",")}]`;
}

/** The snapshot JSON as a sequence of string parts. */
export function* snapshotJsonParts(grid: HourlyGrid, now: number): Generator<string> {
    const header = {
        version: SNAPSHOT_VERSION, generated_at: now, start: grid.start,
        hours: SNAPSHOT_HOURS, step_ms: HOUR_MS, sites: grid.sites,
    };
    yield JSON.stringify(header).slice(0, -1);
    const columns: Array<[string, Float64Array | Uint8Array]> = [
        ["discharge_cfs", grid.cfs], ["discharge_n", grid.cfsN], ["stage_ft", grid.ft], ["stage_n", grid.ftN],
    ];
    for (const [name, values] of columns) {
        yield `,"${name}":[`;
        for (let row = 0; row < grid.sites.length; row++) {
            yield (row > 0 ? "," : "") + rowJson(values, row);
        }
        yield "]";
    }
    yield "}";
}

/** Parsed snapshot, for tests and debugging. */
export async function buildUsgsHourlySnapshot(db: D1Database, siteIds: string[], now: number): Promise<UsgsHourlySnapshot> {
    const grid = await collectUsgsHourly(db, siteIds, now);
    return JSON.parse([...snapshotJsonParts(grid, now)].join(""));
}

export async function writeUsgsHourlySnapshot(
    env: { FLOW_STORAGE: R2Bucket },
    db: D1Database,
    siteIds: string[],
    now: number
): Promise<{ sites: number; jsonBytes: number; gzBytes: number }> {
    const grid = await collectUsgsHourly(db, siteIds, now);

    const gzip = new CompressionStream("gzip");
    const compressed = new Response(gzip.readable).arrayBuffer();
    const writer = gzip.writable.getWriter();
    const encoder = new TextEncoder();
    let jsonBytes = 0;
    let pending: string[] = [];
    let pendingLength = 0;
    const flush = async () => {
        if (pendingLength === 0) return;
        await writer.write(encoder.encode(pending.join("")));
        pending = [];
        pendingLength = 0;
    };
    for (const part of snapshotJsonParts(grid, now)) {
        jsonBytes += part.length;
        pending.push(part);
        pendingLength += part.length;
        if (pendingLength >= 256_000) await flush();
    }
    await flush();
    await writer.close();
    const gz = await compressed;

    await env.FLOW_STORAGE.put(SNAPSHOT_KEY, gz, {
        httpMetadata: { contentType: "application/gzip" },
        customMetadata: { version: String(SNAPSHOT_VERSION), generated_at: String(now), start: String(grid.start) },
    });
    return { sites: grid.sites.length, jsonBytes, gzBytes: gz.byteLength };
}
