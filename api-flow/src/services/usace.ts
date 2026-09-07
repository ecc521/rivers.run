import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';

/**
 * U.S. Army Corps of Engineers (USACE) Reservoir Pool Elevation Service.
 *
 * Backed by the public CWMS Data API (https://cwms-data-api.readthedocs.io/latest/).
 * Unlike USGS/NWS, USACE has no single nationwide "site code" scheme — every reading
 * is addressed by an office (district) + a full CWMS timeseries identifier, and that
 * identifier's version suffix is NOT standardized nationwide: Huntington District uses
 * ".OBS", Sacramento District uses ".MANUAL"/".Calc-manual"/".Rev-CDEC-Combined", Jordan
 * Lake (NC) uses ".USGS-raw" — confirmed by hand across districts. Some real projects
 * (e.g. Englebright Lake) have no elevation telemetry in CWMS at all.
 *
 * So instead of a fixed suffix pattern, a project's elevation series is resolved by
 * discovery: fetch every ".Elev." series for that location, then pick whichever has the
 * most recent `last-update` (tie-broken by shortest interval), rejecting anything not
 * updated in the last 30 days. This generalizes across districts at the cost of
 * occasionally preferring a coarse once-daily manual reading over nothing.
 *
 * Deliberately sorts on `last-update` (when the series was actually last touched), NOT
 * `latest-time` (the timestamp of its last value) — confirmed by hand on Bluestone Lake
 * that some series carry a `latest-time` far in the future: a ".RUL" rule/target curve
 * had `latest-time` in December while the real ".OBS" telemetry's was, naturally, "now".
 * Sorting on `latest-time` would let a forward-dated planning curve permanently beat live
 * telemetry. `last-update` can never be in the future, so it can't have this problem.
 * Series whose version tag marks them as a rule curve or forecast are excluded outright
 * (belt-and-suspenders on top of the sort) since those are categorically not "current
 * observed pool elevation" regardless of how often they happen to refresh.
 *
 * Site IDs are `${office}.${locationSlug}` (spaces in the location name become
 * underscores — the shared normalizeGaugeId() strips whitespace from raw gauge IDs
 * before it reaches any provider, so no space can survive in the code we receive). IDs
 * are minted by getFullSiteListing()'s discovery crawl (see below) — there is no
 * hand-maintained override table; every site, including the two originally hand-verified
 * (Summersville, Bluestone), resolves through the same live discovery path.
 */

const CWMS_BASE = 'https://cwms-data.usace.army.mil/cwms-data';

// CWMS's own `public-name` field (e.g. "Summersville Lake") is materially cleaner than
// the raw location slug resolveReservoir() falls back to (e.g. "Summersville-Lake") —
// there's no reliable string transform from one to the other (see e.g. "JWFlannagan-Lake"
// -> "J.W. Flannagan Reservoir"), so getHistory() prefers the name already fetched into
// the registry by getFullSiteListing(), mirroring the cached-registry-name fallback
// usgs.ts uses for the same reason. No `section` — a reservoir has no natural "reach".
let cachedRegistryNames: Record<string, { name: string; state?: string }> | null = null;

async function loadRegistryNames(env?: any): Promise<void> {
    if (cachedRegistryNames || !env?.FLOW_STORAGE) return;
    try {
        const regObj = await env.FLOW_STORAGE.get('gauge_registry.json');
        if (regObj) {
            const full = await regObj.json() as Record<string, any>;
            cachedRegistryNames = {};
            for (const [fullId, site] of Object.entries(full)) {
                if (fullId.startsWith('USACE:') && (site as any).name) {
                    cachedRegistryNames[fullId.slice(6)] = { name: (site as any).name, state: (site as any).state };
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load gauge_registry.json from R2', e);
    }
}

// A series with no reading in this window is treated as unavailable — both by live
// resolution (getHistory/getLatest/getSiteListing) and by the full-listing crawl. It's
// fine for the crawl to omit a reservoir this way; if the feed starts updating again, a
// later run will naturally pick it back up.
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

interface ResolvedReservoir {
    office: string;
    elevationTsId: string;
    displayName: string;
    state?: string;
}

function slugifyLocation(location: string): string {
    return location.replace(/\s+/g, '_');
}

function parseSiteCode(code: string): { office: string; location: string } | null {
    const dot = code.indexOf('.');
    if (dot === -1) return null;
    return { office: code.slice(0, dot), location: code.slice(dot + 1).replace(/_/g, ' ') };
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parses CWMS interval strings ("15Minutes", "1Hour", "~1Day") into minutes, for use as
// a freshness tie-breaker. Unparseable/irregular intervals sort last.
export function intervalToMinutes(interval: string): number {
    const match = /^~?(\d+)(Minutes?|Hours?|Days?)$/.exec(interval || '');
    if (!match) return Number.MAX_SAFE_INTEGER;
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('minute')) return n;
    if (unit.startsWith('hour')) return n * 60;
    return n * 1440;
}

export interface SeriesCandidate {
    name: string;
    lastUpdate: number;
    intervalMinutes: number;
}

// Version-tag substrings that mark a series as a planning/rule curve or forecast rather
// than observed telemetry — excluded regardless of freshness. Confirmed on real data:
// Bluestone-Lake carries a ".RUL" rule curve and a ".CELRH-FCST-DAILY" forecast series
// alongside its real ".OBS" feed.
const NON_OBSERVATIONAL_VERSION = /fcst|forecast|^rul$/i;

/**
 * Picks the freshest ".Elev." series from a candidate list, rejecting anything stale.
 * Exported for testing.
 */
export function pickBestSeries(candidates: SeriesCandidate[], now: number): SeriesCandidate | null {
    const fresh = candidates.filter(c => now - c.lastUpdate <= STALE_THRESHOLD_MS);
    if (fresh.length === 0) return null;
    fresh.sort((a, b) => b.lastUpdate - a.lastUpdate || a.intervalMinutes - b.intervalMinutes);
    return fresh[0];
}

async function fetchElevationCandidates(office: string, location: string): Promise<SeriesCandidate[]> {
    // Broad regex match on the whole location prefix, filtered precisely below —
    // CWMS's `like` param matches as a regex, so this can't just filter on ".Elev." in
    // the query itself (e.g. "Elev-Top Con" would also match "Elev.*").
    const pattern = `${escapeRegex(location)}\\..*`;
    const url = `${CWMS_BASE}/catalog/TIMESERIES?` + new URLSearchParams({ office, like: pattern });
    const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 20000);
    if (!res.ok) throw new Error(`CWMS catalog error: ${res.status}`);

    const data: any = await res.json();
    const candidates: SeriesCandidate[] = [];

    for (const e of (data.entries || [])) {
        const parts = String(e.name).split('.');
        if (parts[1] !== 'Elev') continue; // excludes "Elev-Top Con" and similar variants
        if (NON_OBSERVATIONAL_VERSION.test(parts[parts.length - 1])) continue; // excludes rule curves/forecasts
        const lastUpdateStr = e.extents?.[0]?.['last-update'];
        if (!lastUpdateStr) continue;
        const lastUpdate = new Date(lastUpdateStr).getTime();
        if (isNaN(lastUpdate)) continue;
        candidates.push({ name: e.name, lastUpdate, intervalMinutes: intervalToMinutes(e.interval) });
    }

    return candidates;
}

// CWMS caps a single response at page-size=500 values and returns a `next-page` cursor
// whenever more remain (confirmed: a 28-day request at 15-minute resolution needs ~2,689
// values, i.e. 6 pages — silently returning only the first page would truncate to the
// oldest ~5 days of the window and never reach "now", which is exactly what happened
// when this was first tested against the app's default 28-day river graph).
const MAX_PAGES = 50; // generous vs. the ~6 pages a 30-day/15-minute request needs (api-flow's route layer caps `days` at 30); guards only against a runaway cursor loop.

async function fetchElevationValues(office: string, tsId: string, startTs: number, endTs: number): Promise<Array<[number, number, number]>> {
    const baseParams = {
        office,
        name: tsId,
        unit: 'ft',
        begin: new Date(startTs).toISOString(),
        end: new Date(endTs).toISOString()
    };

    const allValues: Array<[number, number, number]> = [];
    let page: string | undefined;
    let pageCount = 0;

    do {
        const params = new URLSearchParams(baseParams);
        if (page) params.set('page', page);

        const res = await fetchWithTimeout(`${CWMS_BASE}/timeseries?${params}`, { headers: DEFAULT_HEADERS }, 30000);
        if (!res.ok) throw new Error(`CWMS Data API Error: ${res.status}`);

        const data: any = await res.json();
        allValues.push(...(data.values || []));
        page = data['next-page'];
        pageCount++;
    } while (page && pageCount < MAX_PAGES);

    return allValues;
}

async function fetchDistrictOffices(): Promise<string[]> {
    const res = await fetchWithTimeout(`${CWMS_BASE}/offices`, { headers: DEFAULT_HEADERS }, 20000);
    if (!res.ok) throw new Error(`CWMS offices error: ${res.status}`);
    const data: any = await res.json();
    return (data || []).filter((o: any) => o.type === 'DIS').map((o: any) => o.name);
}

async function fetchProjectLocations(office: string): Promise<string[]> {
    // page-size=500 comfortably covers every observed district (largest sampled: 64
    // projects) in one request; no district is expected to approach this.
    const url = `${CWMS_BASE}/projects?` + new URLSearchParams({ office, 'page-size': '500' });
    const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 30000);
    if (!res.ok) throw new Error(`CWMS projects error for ${office}: ${res.status}`);
    const data: any = await res.json();
    return (data.projects || []).map((p: any) => p.location?.name).filter(Boolean);
}

// Not every district attaches a project's elevation telemetry to the bare project-name
// location returned by /projects: Huntington District (LRH), for example, lists the
// project as "Summersville" but the actual pool-elevation series lives under a child
// location named "Summersville-Lake" (confirmed: "Summersville.Elev.*" has zero results,
// "Summersville-Lake.Elev.*" does not) — while Louisville District (LRL) attaches series
// directly to the bare name ("Brookville.Elev.*" works as-is). Try the bare name first
// since it's more common, then fall back to the "-Lake" convention.
export async function resolveProjectElevation(office: string, projectName: string): Promise<{ location: string; series: SeriesCandidate } | null> {
    for (const candidateLocation of [projectName, `${projectName}-Lake`]) {
        const candidates = await fetchElevationCandidates(office, candidateLocation);
        const best = pickBestSeries(candidates, Date.now());
        if (best) return { location: candidateLocation, series: best };
    }
    return null;
}

async function fetchLocationMeta(office: string, location: string): Promise<any | null> {
    const url = `${CWMS_BASE}/locations/${encodeURIComponent(location)}?` + new URLSearchParams({ office });
    const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 20000);
    if (!res.ok) return null;
    return res.json();
}

/**
 * Resolves a site code to its office + best current elevation series, live, via
 * discovery. `code` already carries the exact location that getFullSiteListing()
 * resolved (including any "-Lake" fallback), so no further fallback is needed here.
 */
async function resolveReservoir(code: string): Promise<ResolvedReservoir | null> {
    const parsed = parseSiteCode(code);
    if (!parsed) return null;

    const candidates = await fetchElevationCandidates(parsed.office, parsed.location);
    const best = pickBestSeries(candidates, Date.now());
    if (!best) return null;

    return { office: parsed.office, elevationTsId: best.name, displayName: parsed.location };
}

export const usaceProvider: GaugeProvider = {
    id: 'USACE',
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[], env?: any): Promise<Record<string, GaugeReading>> {
        // Elevation updates roughly every 15 minutes; a few hours of lookback
        // comfortably covers any single missed/delayed update.
        const histories = await this.getHistory(siteCodes, Date.now() - 10800000, Date.now(), false, env);
        const results: Record<string, GaugeReading> = {};

        Object.entries(histories).forEach(([id, history]) => {
            if (history.readings.length > 0) {
                results[id] = history.readings[history.readings.length - 1];
            }
        });

        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const results: Record<string, GaugeHistory> = {};

        await loadRegistryNames(env);

        const CONCURRENCY_LIMIT = 3;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const code = siteCodes[index++];

                let attempts = 0;
                const MAX_RETRIES = 2;
                let success = false;

                while (!success && attempts <= MAX_RETRIES) {
                    try {
                        const reservoir = await resolveReservoir(code);
                        if (!reservoir) break; // no current data for this code; nothing to retry

                        const values = await fetchElevationValues(reservoir.office, reservoir.elevationTsId, startTs, maxTime);

                        const readings: GaugeReading[] = values
                            .filter(([, val]) => isValidReadingValue(val, 'ft'))
                            .map(([ts, val]) => ({ dateTime: ts, ft: Number(val) }));

                        const registryMeta = cachedRegistryNames?.[code];
                        results[code] = {
                            id: code,
                            name: registryMeta?.name || reservoir.displayName,
                            state: registryMeta?.state || reservoir.state,
                            readings,
                            units: 'ft',
                            country: 'US'
                        };
                        success = true;
                    } catch (e: unknown) {
                        attempts++;
                        if (attempts > MAX_RETRIES) {
                            const errorMsg = `USACE CWMS fetch failed for ${code}`;
                            if (env) {
                                await logToD1(env, 'WARN', 'usace', errorMsg, e);
                            } else {
                                console.warn(errorMsg, e);
                            }
                        } else {
                            await new Promise(r => setTimeout(r, attempts * 1500));
                        }
                    }
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const results: GaugeSite[] = [];
        const CONCURRENCY_LIMIT = 3;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const code = siteCodes[index++];

                try {
                    const reservoir = await resolveReservoir(code);
                    if (!reservoir) continue;

                    const location = parseSiteCode(code)?.location ?? reservoir.displayName;
                    const meta = await fetchLocationMeta(reservoir.office, location);
                    if (!meta || meta.latitude === undefined || meta.longitude === undefined) continue;

                    results.push({
                        id: code,
                        name: meta['public-name'] || reservoir.displayName,
                        lat: meta.latitude,
                        lon: meta.longitude,
                        state: formatStateCode(meta['state-initial'], 'USACE') || reservoir.state,
                        country: 'US'
                    });
                } catch (e) {
                    console.warn(`USACE site listing failed for ${code}`, e);
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    /**
     * Crawls every USACE district's project list and resolves each project's current
     * pool elevation series, skipping anything with no series updated in the last 30
     * days (or no elevation series at all). This is a genuinely large crawl (~38
     * district calls, then one or two calls per project — roughly 1,000-1,500 requests
     * nationwide, ~2-3 minutes). Reviewed against a real one-off dump (392 reservoirs,
     * cross-checked for duplicates/known-good values) before being wired into
     * gaugeRegistry.ts's weekly compile — it runs on the same cadence as USGS/EC/UK/IE,
     * not the 15-minute state-polling cron.
     */
    async getFullSiteListing(env?: any): Promise<GaugeSite[]> {
        console.log('USACE Provider: Fetching full reservoir listing...');

        const offices = await fetchDistrictOffices();
        const projectPairs: Array<{ office: string; location: string }> = [];

        {
            let idx = 0;
            const worker = async () => {
                while (idx < offices.length) {
                    const office = offices[idx++];
                    try {
                        const locations = await fetchProjectLocations(office);
                        locations.forEach(location => projectPairs.push({ office, location }));
                    } catch (e) {
                        const msg = `USACE: failed to list projects for office ${office}`;
                        if (env) await logToD1(env, 'WARN', 'usace', msg, e); else console.warn(msg, e);
                    }
                }
            };
            await Promise.all(Array(6).fill(0).map(() => worker()));
        }

        console.log(`USACE Provider: ${projectPairs.length} candidate projects across ${offices.length} districts. Resolving elevation series...`);

        const results: GaugeSite[] = [];
        {
            let idx = 0;
            const worker = async () => {
                while (idx < projectPairs.length) {
                    const { office, location: projectName } = projectPairs[idx++];
                    try {
                        const resolved = await resolveProjectElevation(office, projectName);
                        if (!resolved) continue;

                        const meta = await fetchLocationMeta(office, resolved.location);
                        if (!meta || meta.latitude === undefined || meta.longitude === undefined) continue;

                        results.push({
                            id: `${office}.${slugifyLocation(resolved.location)}`,
                            name: meta['public-name'] || resolved.location,
                            lat: meta.latitude,
                            lon: meta.longitude,
                            state: formatStateCode(meta['state-initial'], 'USACE'),
                            country: 'US'
                        });
                    } catch (e) {
                        const msg = `USACE: failed to resolve project ${office}/${projectName}`;
                        if (env) await logToD1(env, 'WARN', 'usace', msg, e); else console.warn(msg, e);
                    }
                }
            };
            await Promise.all(Array(8).fill(0).map(() => worker()));
        }

        console.log(`USACE Provider: full listing complete — ${results.length} reservoirs with elevation data in the last 30 days.`);
        return results;
    }
};
