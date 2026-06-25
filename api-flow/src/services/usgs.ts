import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatGaugeName } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';

let cachedReaches: Record<string, string> | null = null;

const USGS_API_BASE = "https://api.waterdata.usgs.gov/ogcapi/v0/collections";
const PARAMETER_CODES = "00060,00065,00010,00011,00045";

const FIPS_TO_STATE: Record<string, string> = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "72": "PR", "78": "VI"
};

// --- RESPONSE PARSING ---

function mapUnitToProperty(unitCode: string): { property: keyof GaugeReading | undefined; celsius: boolean } {
    // Normalize: lowercase, replace Unicode superscript ³, collapse whitespace
    const unit = unitCode.toLowerCase().replace(/³/g, '^3').replace(/\s+/g, ' ').trim();
    if (unit === 'ft^3/s' || unit === 'ft3/s') return { property: 'cfs', celsius: false };
    if (unit === 'ft') return { property: 'ft', celsius: false };
    if (unit === 'deg c' || unit === 'degrees celsius') return { property: 'temp_f', celsius: true };
    if (unit === 'deg f' || unit === 'degrees fahrenheit') return { property: 'temp_f', celsius: false };
    if (unit === 'in') return { property: 'precip_in', celsius: false };
    return { property: undefined, celsius: false };
}

function finalizeSiteReadings(usgsSites: Record<string, GaugeHistory>) {
    for (const gaugeID in usgsSites) {
        const site = usgsSites[gaugeID];
        if ((site as any)._readingMap) {
            const readingMap = (site as any)._readingMap as Map<number, GaugeReading>;
            const timestamps = Array.from(readingMap.keys()).sort((a, b) => a - b);
            site.readings = timestamps
                .map(ts => readingMap.get(ts)!)
                .filter(r => {
                    const keys = Object.keys(r);
                    return keys.some(k => k !== 'dateTime' && k !== 'isForecast');
                });
            delete (site as any)._readingMap;
        }
    }
}

// Parses an array of OGC API GeoJSON features into GaugeHistory records.
export function processUSGSResponse(features: any[]): Record<string, GaugeHistory> {
    const usgsSites: Record<string, GaugeHistory> = {};

    for (const feature of features) {
        const props = feature.properties || {};
        const rawId = (props.monitoring_location_id || '').replace(/^USGS-/i, '');
        if (!rawId) continue;

        if (!usgsSites[rawId]) {
            const formatted = formatGaugeName(props.monitoring_location_name || rawId, "USGS");
            usgsSites[rawId] = {
                id: rawId,
                name: formatted.name,
                section: formatted.section,
                readings: [],
                country: "US"
            };

            const stateCd = props.state_code;
            if (stateCd && FIPS_TO_STATE[stateCd]) {
                usgsSites[rawId].state = FIPS_TO_STATE[stateCd];
            }

            const geo = feature.geometry;
            if (geo?.type === "Point" && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
                (usgsSites[rawId] as any).lat = geo.coordinates[1];
                (usgsSites[rawId] as any).lon = geo.coordinates[0];
            }
        }

        const siteObj = usgsSites[rawId];
        if (props.value === null || props.value === undefined || props.value === '') continue;
        const rawValue = Number(props.value);
        if (isNaN(rawValue)) continue;

        const { property, celsius } = mapUnitToProperty(props.unit_of_measure || '');
        if (!property) continue;

        const value = celsius ? Math.round((rawValue * 1.8 + 32) * 100) / 100 : rawValue;
        if (!isValidReadingValue(value, property)) continue;

        (siteObj as any)._readingMap = (siteObj as any)._readingMap || new Map<number, GaugeReading>();
        const readingMap = (siteObj as any)._readingMap as Map<number, GaugeReading>;

        const rawTime = new Date(props.time).getTime();
        const snappedTime = Math.round(rawTime / 300000) * 300000;

        let reading = readingMap.get(snappedTime);
        if (!reading) {
            reading = { dateTime: snappedTime };
            readingMap.set(snappedTime, reading);
        }
        (reading as any)[property] = value;
    }

    finalizeSiteReadings(usgsSites);
    return usgsSites;
}

// --- FETCH HELPERS ---

async function fetchAllOGCFeatures(initialUrl: string, timeoutMs: number, env?: any): Promise<any[]> {
    const features: any[] = [];
    let nextUrl: string | null = initialUrl;
    const headers = env?.USGS_API_KEY
        ? { ...DEFAULT_HEADERS, 'X-Api-Key': env.USGS_API_KEY }
        : DEFAULT_HEADERS;

    while (nextUrl) {
        let success = false;
        let attempts = 0;
        const MAX_RETRIES = 2;
        const currentUrl = nextUrl;

        while (!success && attempts <= MAX_RETRIES) {
            try {
                const res = await fetchWithTimeout(currentUrl, { headers }, timeoutMs);
                if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);

                const data = await res.json() as any;
                features.push(...(data.features || []));

                const nextLink = (data.links || []).find((l: any) => l.rel === 'next');
                nextUrl = nextLink?.href || null;
                success = true;
            } catch (e: unknown) {
                attempts++;
                const msg = e instanceof Error ? e.message : String(e);
                if (attempts > MAX_RETRIES) {
                    if (env) {
                        await logToD1(env, "WARN", "usgs", `OGC fetch failed after ${attempts} attempts: ${msg}`, { url: nextUrl ?? '' });
                    } else {
                        console.warn(`OGC fetch failed: ${msg}`);
                    }
                    nextUrl = null;
                } else {
                    await new Promise(r => setTimeout(r, attempts * 3000));
                }
            }
        }
    }

    return features;
}

// --- LATEST (registry sync every 15 min) ---
// Uses latest-continuous with comma-separated monitoring_location_id and parameter_code
// (both documented via OpenAPI split parameters: style=form, explode=false).

async function fetchLatestBatch(siteCodes: string[], env?: any): Promise<Record<string, GaugeHistory>> {
    const BATCH_SIZE = 200;
    const allSites: Record<string, GaugeHistory> = {};
    const validCodes = siteCodes.filter(id => /^\d+$/.test(id));

    const batches: string[][] = [];
    for (let i = 0; i < validCodes.length; i += BATCH_SIZE) {
        batches.push(validCodes.slice(i, i + BATCH_SIZE));
    }

    const CONCURRENCY_LIMIT = 4;
    let batchIndex = 0;

    const worker = async () => {
        while (batchIndex < batches.length) {
            const batch = batches[batchIndex++];
            const ids = batch.map(id => `USGS-${id}`).join(',');
            const url = `${USGS_API_BASE}/latest-continuous/items?f=json&monitoring_location_id=${ids}&parameter_code=${PARAMETER_CODES}&limit=1000`;

            try {
                const features = await fetchAllOGCFeatures(url, 90000, env);
                Object.assign(allSites, processUSGSResponse(features));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (env) {
                    await logToD1(env, "WARN", "usgs", `latest-continuous batch failed (${batch.length} sites): ${msg}`);
                } else {
                    console.warn(`latest-continuous batch failed: ${msg}`);
                }
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return allSites;
}

// --- HISTORY (linked gauges sync + on-demand /history endpoint) ---
// /continuous supports comma-separated monitoring_location_id (same as latest-continuous).
// Responses are paginated via next links; fetchAllOGCFeatures follows them automatically.

async function fetchContinuousSites(
    siteCodes: string[],
    startTs: number,
    endTs?: number,
    env?: any
): Promise<Record<string, GaugeHistory>> {
    const allSites: Record<string, GaugeHistory> = {};
    const validCodes = siteCodes.filter(id => /^\d+$/.test(id));

    const toISO = (ts: number) => new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const datetime = `${toISO(startTs)}/${endTs ? toISO(endTs) : '..'}`;

    const BATCH_SIZE = 10;
    const CONCURRENCY_LIMIT = 4;

    const batches: string[][] = [];
    for (let i = 0; i < validCodes.length; i += BATCH_SIZE) {
        batches.push(validCodes.slice(i, i + BATCH_SIZE));
    }

    let batchIdx = 0;
    const worker = async () => {
        while (batchIdx < batches.length) {
            const batch = batches[batchIdx++];
            const ids = batch.map(id => `USGS-${id}`).join(',');
            const url = `${USGS_API_BASE}/continuous/items?f=json&monitoring_location_id=${ids}&parameter_code=${PARAMETER_CODES}&datetime=${datetime}&limit=10000`;

            try {
                const features = await fetchAllOGCFeatures(url, 90000, env);
                Object.assign(allSites, processUSGSResponse(features));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (env) {
                    await logToD1(env, "WARN", "usgs", `continuous fetch failed for ${batch.length} sites: ${msg}`);
                } else {
                    console.warn(`continuous fetch failed: ${msg}`);
                }
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return allSites;
}

// --- SITE DISCOVERY (weekly registry recompile) ---
// Two-phase: (1) crawl latest-continuous for active site IDs + coordinates,
// (2) batch-fetch names and state from monitoring-locations.

const REGISTRY_FRESHNESS_MS = 14 * 24 * 60 * 60 * 1000;
const METADATA_BATCH_SIZE = 200;

async function fetchActiveUSGSSites(env?: any): Promise<Map<string, { lat: number; lon: number }>> {
    const url = `${USGS_API_BASE}/latest-continuous/items?f=json&parameter_code=00060&limit=10000`;
    const features = await fetchAllOGCFeatures(url, 600000, env);

    const cutoff = Date.now() - REGISTRY_FRESHNESS_MS;
    const active = new Map<string, { lat: number; lon: number }>();

    for (const feature of features) {
        const props = feature.properties || {};
        const rawId = (props.monitoring_location_id || '').replace(/^USGS-/i, '');
        if (!rawId || !/^\d+$/.test(rawId)) continue;

        const t = props.time;
        if (!t || new Date(t).getTime() < cutoff) continue;

        const geo = feature.geometry;
        if (geo?.type === "Point" && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
            active.set(rawId, { lat: geo.coordinates[1], lon: geo.coordinates[0] });
        }
    }

    return active;
}

async function fetchSiteMetadata(
    siteIds: string[],
    env?: any
): Promise<Map<string, { name: string; section?: string; state?: string }>> {
    const metadata = new Map<string, { name: string; section?: string; state?: string }>();
    const batches: string[][] = [];
    for (let i = 0; i < siteIds.length; i += METADATA_BATCH_SIZE) {
        batches.push(siteIds.slice(i, i + METADATA_BATCH_SIZE));
    }

    const CONCURRENCY_LIMIT = 4;
    let idx = 0;

    const worker = async () => {
        while (idx < batches.length) {
            const batch = batches[idx++];
            const ids = batch.map(id => `USGS-${id}`).join(',');
            const url = `${USGS_API_BASE}/monitoring-locations/items?f=json&id=${ids}&limit=${METADATA_BATCH_SIZE}`;

            try {
                const features = await fetchAllOGCFeatures(url, 60000, env);
                for (const feature of features) {
                    const props = feature.properties || {};
                    const num = props.monitoring_location_number || '';
                    if (!num) continue;
                    const formatted = formatGaugeName(props.monitoring_location_name || num, "USGS");
                    const stateCd = props.state_code;
                    metadata.set(num, {
                        name: formatted.name,
                        section: formatted.section,
                        state: stateCd ? FIPS_TO_STATE[stateCd] : undefined
                    });
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn(`monitoring-locations metadata batch failed: ${msg}`);
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return metadata;
}

// --- PROVIDER ---

export const usgsProvider: GaugeProvider = {
    id: "USGS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: true,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[], env?: any): Promise<Record<string, GaugeReading>> {
        const histories = await fetchLatestBatch(siteCodes, env);
        const latest: Record<string, GaugeReading> = {};
        for (const [id, history] of Object.entries(histories)) {
            if (history.readings.length > 0) {
                latest[id] = history.readings[history.readings.length - 1];
            }
        }
        return latest;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>> {
        const histories = await fetchContinuousSites(siteCodes, startTs, endTs, env);

        if (!cachedReaches && env?.FLOW_STORAGE) {
            try {
                const reachesObject = await env.FLOW_STORAGE.get("usgs_reaches.json");
                if (reachesObject) {
                    cachedReaches = await reachesObject.json();
                }
            } catch (e) {
                console.warn("Failed to load usgs_reaches.json from R2", e);
            }
        }
        const reaches = (cachedReaches || {}) as Record<string, string>;

        siteCodes.forEach((site) => {
            const history = histories[site];
            const reachId = reaches[site];
            if (history && reachId) {
                history.nwmReachId = reachId;
            }
        });

        return histories;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        if (siteCodes.length === 0) return [];
        const histories = await fetchLatestBatch(siteCodes);
        const sites: GaugeSite[] = [];

        for (const id of siteCodes) {
            const hist = histories[id];
            if (hist && (hist as any).lat !== undefined) {
                sites.push({
                    id,
                    name: hist.name,
                    section: hist.section,
                    lat: (hist as any).lat,
                    lon: (hist as any).lon,
                    state: hist.state,
                    country: hist.country || "US"
                });
            }
        }
        return sites;
    },

    async getFullSiteListing(env?: any): Promise<GaugeSite[]> {
        if (!env?.USGS_API_KEY) {
            console.warn("USGS Provider: USGS_API_KEY not set — requests will be unauthenticated and subject to lower rate limits");
        }
        console.log("USGS Provider: Fetching active sites from latest-continuous...");

        const activeSites = await fetchActiveUSGSSites(env);
        console.log(`USGS Provider: ${activeSites.size} active sites (≤14 days), fetching metadata...`);

        if (activeSites.size === 0) {
            console.error("USGS Provider: No active sites returned — aborting registry build");
            return [];
        }

        const siteIds = Array.from(activeSites.keys());
        const metadata = await fetchSiteMetadata(siteIds, env);

        const sites: GaugeSite[] = [];
        for (const [id, coords] of activeSites) {
            const meta = metadata.get(id);
            if (!meta) continue;
            sites.push({
                id,
                name: meta.name,
                section: meta.section,
                lat: coords.lat,
                lon: coords.lon,
                state: meta.state,
                country: "US"
            });
        }

        console.log(`USGS Provider: Registry built with ${sites.length} sites`);
        return sites;
    }
};
