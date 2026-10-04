import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';

/**
 * U.S. Army Corps of Engineers dams, as two gauges per dam:
 *  - "<id>" (Outflow): release in cfs, the river stage just below the dam
 *    ("Stage Tailwater") in ft, and the district's projected releases as forecast rows.
 *  - "<id>.Lake" (Lake Level): pool elevation in ft.
 *
 * Two USACE APIs are used:
 *  - The Access2Water reporting API behind water.usace.army.mil. One request lists
 *    every project nationwide with labeled series ("Outflow", "Elevation") and their
 *    latest values; it also serves history. Undocumented, but it is what the public
 *    USACE site runs on.
 *  - The CWMS Data API (CDA), for projected releases. The reporting API has no
 *    forecasts, and their series names differ by district, so each dam's forecast
 *    series is resolved daily (syncUsaceSites) and saved to R2 with its other series.
 *
 * Nothing is written to the flow store: the cycle fetches latest values for
 * sitedata.json, and graphs fetch history and forecasts live.
 *
 * Site ids are `${provider}.${code}` with unsafe characters replaced (see siteIdOf),
 * e.g. "LRH.Summersville", and "LRH.Summersville.Lake" for the lake gauge.
 */

const A2W_BASE = 'https://water.usace.army.mil/cda/reporting';
const CDA_BASE = 'https://cwms-data.usace.army.mil/cwms-data';

/** Per-site series ids, rebuilt daily by syncUsaceSites. */
export const USACE_SITES_KEY = 'usace/sites.json';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Graphs show recent releases leading into the forecast; older history is not needed. */
const MAX_HISTORY_MS = 7 * DAY_MS;
const FORECAST_HORIZON_MS = 30 * DAY_MS;
const SITES_CACHE_MS = 60 * 60 * 1000;

interface A2WSeries {
    tsid: string;
    label: string;
    unit?: string;
    latest_time?: string | null;
    latest_value?: number | null;
}

export interface A2WProject {
    provider: string;
    code: string;
    public_name?: string;
    state?: string;
    lat?: number;
    lon?: number;
    timeseries: A2WSeries[];
}

export interface UsaceSite {
    /** Reporting API provider slug, e.g. "LRH" or "NWDP". */
    provider: string;
    name: string;
    state?: string;
    /** Series served as cfs. */
    flow?: string;
    /** Series served as ft. */
    stage?: string;
    forecast?: { office: string; tsId: string };
}

/** The gauges each dam is split into, by reporting API series label. */
const GAUGE_KINDS = [
    { suffix: '', label: 'Outflow', flow: 'Outflow', stage: 'Stage Tailwater' },
    { suffix: '.Lake', label: 'Lake Level', stage: 'Elevation' },
] as const;

export function siteIdOf(provider: string, code: string): string {
    return `${provider}.${code.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** The CDA office holding a reporting provider's data. Northwest districts publish under their division. */
export function cdaOfficeOf(provider: string): string {
    if (['NWP', 'NWS', 'NWW'].includes(provider)) return 'NWDP';
    if (['NWK', 'NWO'].includes(provider)) return 'NWDM';
    return provider;
}

const timeOf = (s: A2WSeries) => (s.latest_time ? new Date(s.latest_time).getTime() : 0);

/** The freshest series with this label, or undefined. */
function seriesFor(project: A2WProject, label: string): A2WSeries | undefined {
    return project.timeseries
        .filter(s => s.label === label)
        .sort((a, b) => timeOf(b) - timeOf(a))[0];
}

export async function fetchProjects(): Promise<A2WProject[]> {
    const res = await fetchWithTimeout(`${A2W_BASE}/providers/projects?fmt=geojson`, { headers: DEFAULT_HEADERS }, 60000);
    if (!res.ok) throw new Error(`USACE reporting API error: ${res.status}`);
    const features: any[] = await res.json();
    return features
        .filter(f => f?.properties?.provider && f.properties.code)
        .map(f => ({
            ...f.properties,
            lon: f.geometry?.coordinates?.[0],
            lat: f.geometry?.coordinates?.[1],
            timeseries: f.properties.timeseries ?? [],
        }));
}

/**
 * Each of a project's gauges with its series ids. Exported for testing.
 */
export function projectSites(project: A2WProject): Array<[string, UsaceSite]> {
    const base = siteIdOf(project.provider, project.code);
    const out: Array<[string, UsaceSite]> = [];
    for (const kind of GAUGE_KINDS) {
        const flow = 'flow' in kind ? seriesFor(project, kind.flow)?.tsid : undefined;
        const stage = seriesFor(project, kind.stage)?.tsid;
        if (!flow && !stage) continue;
        out.push([base + kind.suffix, {
            provider: project.provider,
            name: `${project.public_name || project.code} (${kind.label})`,
            state: project.state,
            flow,
            stage,
        }]);
    }
    return out;
}

/**
 * A gauge's newest values as one reading. Districts report series on different
 * schedules, so the reading takes the flow's time when there is one.
 */
export function latestReading(project: A2WProject, site: UsaceSite): GaugeReading | null {
    const byId = (tsId?: string) => (tsId ? project.timeseries.find(t => t.tsid === tsId) : undefined);
    const flow = byId(site.flow);
    const stage = byId(site.stage);
    const reading: GaugeReading = { dateTime: 0 };
    if (flow && isValidReadingValue(flow.latest_value, 'cfs')) {
        reading.cfs = Number(flow.latest_value);
        reading.dateTime = timeOf(flow);
    }
    if (stage && isValidReadingValue(stage.latest_value, 'ft')) {
        reading.ft = Number(stage.latest_value);
        reading.dateTime ||= timeOf(stage);
    }
    return reading.dateTime > 0 ? reading : null;
}

// Version tags of forecast series. Observed in use: CELRH-FCST-DAILY, Fcst-SWF-CWMS,
// National-CWMS-Forecast, CWMS-Forecast-QPF, LRL-cavi-fct, lakerep-rev-forecast.
const FORECAST_VERSION = /fcst|forecast|fct/i;
const OUTFLOW_PARAMETER = /^(Flow-Out|Flow-Res Out|Flow-ResOut|Flow-Outflow|Flow-Release|Flow-Total|Flow-Controlled|Flow-Reg)$/i;
const OUTFLOW_LOCATION = /out|tw|tailwater|release/i;

/**
 * Forecast series in an office catalog that could be a project's projected release,
 * in two tiers: those at the outflow series' own location and parameter, then other
 * outflow parameters at related locations. A "-Lake" location's plain Flow is inflow
 * and never matches. Exported for testing.
 */
export function forecastCandidates(outflowTsId: string, projectCode: string, catalog: string[]): string[][] {
    const [outLoc, outParam] = outflowTsId.split('.');
    const locs = [outLoc, projectCode];
    const related = (loc: string) => locs.some(l => loc === l || loc.startsWith(`${l}-`) || l.startsWith(`${loc}-`));
    const exact: string[] = [];
    const other: string[] = [];
    for (const name of catalog) {
        const parts = name.split('.');
        const [loc, param] = parts;
        if (!FORECAST_VERSION.test(parts[parts.length - 1]) || !related(loc)) continue;
        if (loc === outLoc && param === outParam) exact.push(name);
        else if (OUTFLOW_PARAMETER.test(param) || (param === 'Flow' && OUTFLOW_LOCATION.test(loc))) other.push(name);
    }
    return [exact, other];
}

async function cdaJson(path: string, params: Record<string, string>, timeoutMs = 60000): Promise<any> {
    const res = await fetchWithTimeout(`${CDA_BASE}${path}?${new URLSearchParams(params)}`, { headers: DEFAULT_HEADERS }, timeoutMs);
    if (!res.ok) throw new Error(`CWMS Data API error ${res.status} for ${path}`);
    return res.json();
}

/** Every forecast flow series in an office's catalog. */
async function fetchForecastCatalog(office: string): Promise<string[]> {
    const names: string[] = [];
    let page: string | undefined;
    do {
        const params: Record<string, string> = { office, 'page-size': '5000', like: '.*\\.Flow[^.]*\\..*(fcst|forecast|fct).*' };
        if (page) params.page = page;
        const data = await cdaJson('/catalog/TIMESERIES', params, 120000);
        for (const e of data.entries ?? []) if (typeof e.name === 'string') names.push(e.name);
        page = data['next-page'];
    } while (page);
    return names;
}

/** Time of the last value within the forecast horizon, or undefined. */
async function probeNewestTime(office: string, tsId: string, now: number): Promise<number | undefined> {
    const data = await cdaJson('/timeseries', {
        office, name: tsId, begin: new Date(now).toISOString(), end: new Date(now + FORECAST_HORIZON_MS).toISOString(), 'page-size': '5000',
    }, 30000);
    const values: Array<[number, number | null]> = data.values ?? [];
    for (let i = values.length - 1; i >= 0; i--) if (values[i][1] !== null) return values[i][0];
    return undefined;
}

/**
 * Newest value time per series, for those that have one. The catalog's own extents
 * are not maintained reliably, so this is how a forecast series proves it is live.
 * The bulk "recent" endpoint returns a database error for some series, so a failed
 * batch is checked one series at a time.
 */
async function fetchNewestTimes(office: string, tsIds: string[], now: number): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (let i = 0; i < tsIds.length; i += 25) {
        const batch = tsIds.slice(i, i + 25);
        try {
            const data = await cdaJson('/timeseries/recent', { office, 'ts-ids': batch.join(',') });
            for (const row of Array.isArray(data) ? data : []) {
                const t = row?.dqu?.['date-time'];
                if (typeof row?.id === 'string' && typeof t === 'number') out.set(row.id, t);
            }
        } catch {
            for (const tsId of batch) {
                const t = await probeNewestTime(office, tsId, now).catch(() => undefined);
                if (t !== undefined) out.set(tsId, t);
            }
        }
    }
    return out;
}

/** From the best tier with a live series (data past `now`), the one reaching furthest ahead. */
export function chooseForecast(tiers: string[][], newest: Map<string, number>, now: number): string | undefined {
    for (const tier of tiers) {
        const live = tier.filter(c => (newest.get(c) ?? 0) > now);
        if (live.length > 0) return live.toSorted((a, b) => newest.get(b)! - newest.get(a)!)[0];
    }
    return undefined;
}

/**
 * Rebuilds USACE_SITES_KEY: every gauge's series ids, plus the outflow gauge's
 * projected-release series where the district publishes one. About one catalog and
 * a few "recent" requests per office.
 */
export async function syncUsaceSites(env: any, now: number = Date.now()): Promise<{ sites: number; forecasts: number }> {
    const projects = await fetchProjects();
    const sites: Record<string, UsaceSite> = {};
    const byOffice = new Map<string, Array<{ id: string; project: A2WProject; outflow: string }>>();
    for (const project of projects) {
        for (const [id, site] of projectSites(project)) {
            sites[id] = site;
            // Only the outflow gauge carries a flow series, and with it the forecast.
            if (!site.flow) continue;
            const office = cdaOfficeOf(project.provider);
            if (!byOffice.has(office)) byOffice.set(office, []);
            byOffice.get(office)!.push({ id, project, outflow: site.flow });
        }
    }

    let forecasts = 0;
    const offices = [...byOffice.keys()];
    let next = 0;
    const worker = async () => {
        while (next < offices.length) {
            const office = offices[next++];
            try {
                const catalog = await fetchForecastCatalog(office);
                if (catalog.length === 0) continue;
                const entries = byOffice.get(office)!.map(e => ({ ...e, candidates: forecastCandidates(e.outflow, e.project.code, catalog) }));
                const wanted = [...new Set(entries.flatMap(e => e.candidates.flat()))];
                if (wanted.length === 0) continue;
                const newest = await fetchNewestTimes(office, wanted, now);
                for (const e of entries) {
                    const tsId = chooseForecast(e.candidates, newest, now);
                    if (tsId) {
                        sites[e.id].forecast = { office, tsId };
                        forecasts++;
                    }
                }
            } catch (e) {
                await logToD1(env, 'WARN', 'usace', `Forecast series lookup failed for ${office}`, e);
            }
        }
    };
    await Promise.all(Array(4).fill(0).map(() => worker()));

    await env.FLOW_STORAGE.put(USACE_SITES_KEY, JSON.stringify(sites), { httpMetadata: { contentType: 'application/json' } });
    cachedSites = { at: now, sites };
    return { sites: Object.keys(sites).length, forecasts };
}

let cachedSites: { at: number; sites: Record<string, UsaceSite> } | null = null;

/** Site series ids from R2, or straight from the reporting API (without forecasts) when not yet built. */
async function loadSites(env?: any): Promise<Record<string, UsaceSite>> {
    if (cachedSites && Date.now() - cachedSites.at < SITES_CACHE_MS) return cachedSites.sites;
    try {
        const obj = await env?.FLOW_STORAGE?.get(USACE_SITES_KEY);
        if (obj) {
            cachedSites = { at: Date.now(), sites: await obj.json() };
            return cachedSites.sites;
        }
    } catch (e) {
        console.warn('Failed to load USACE sites from R2', e);
    }
    const sites: Record<string, UsaceSite> = {};
    for (const project of await fetchProjects()) {
        for (const [id, site] of projectSites(project)) sites[id] = site;
    }
    cachedSites = { at: Date.now(), sites };
    return sites;
}

/** Values of one reporting API series; gaps come back as null. */
async function fetchSeries(provider: string, tsId: string, start: number, end: number): Promise<Array<[number, number | null]>> {
    const params = new URLSearchParams({ name: tsId, begin: new Date(start).toISOString(), end: new Date(end).toISOString() });
    const res = await fetchWithTimeout(`${A2W_BASE}/providers/${provider.toLowerCase()}/timeseries?${params}`, { headers: DEFAULT_HEADERS }, 30000);
    if (!res.ok) throw new Error(`USACE reporting API error ${res.status} for ${tsId}`);
    const data: any = await res.json();
    return (data.values ?? [])
        .map(([t, v]: [string, number | null]) => [new Date(t).getTime(), v] as [number, number | null])
        .filter(([t]: [number, number | null]) => !isNaN(t));
}

/** Projected releases after `after`, as forecast rows. */
async function fetchForecastRows(forecast: { office: string; tsId: string }, after: number, now: number): Promise<GaugeReading[]> {
    const data = await cdaJson('/timeseries', {
        office: forecast.office,
        name: forecast.tsId,
        unit: 'EN',
        begin: new Date(after).toISOString(),
        end: new Date(now + FORECAST_HORIZON_MS).toISOString(),
        'page-size': '5000',
    }, 30000);
    return (data.values ?? [])
        .filter(([t, v]: [number, number]) => t > after && isValidReadingValue(v, 'cfs'))
        .map(([t, v]: [number, number]) => ({ dateTime: t, cfs: Math.round(v * 100) / 100, isForecast: true, forecastSource: 'USACE' }));
}

/** Flow and stage merged by time, then projected releases after the last observation. */
async function siteHistory(code: string, site: UsaceSite, start: number, end: number, includeForecast: boolean, now: number): Promise<GaugeHistory> {
    const [flow, stage] = await Promise.all([
        site.flow ? fetchSeries(site.provider, site.flow, start, end) : [],
        site.stage ? fetchSeries(site.provider, site.stage, start, end) : [],
    ]);
    const byTime = new Map<number, GaugeReading>();
    const at = (t: number) => byTime.get(t) ?? byTime.set(t, { dateTime: t }).get(t)!;
    for (const [t, v] of flow) if (isValidReadingValue(v, 'cfs')) at(t).cfs = Number(v);
    for (const [t, v] of stage) if (isValidReadingValue(v, 'ft')) at(t).ft = Number(v);
    const readings = [...byTime.values()].sort((a, b) => a.dateTime - b.dateTime);

    if (includeForecast && site.forecast) {
        const lastObserved = readings.length > 0 ? readings[readings.length - 1].dateTime : now;
        try {
            readings.push(...await fetchForecastRows(site.forecast, lastObserved, now));
        } catch (e) {
            console.warn(`USACE forecast fetch failed for ${code}`, e);
        }
    }
    return { id: code, name: site.name, state: site.state, readings, units: site.flow ? 'cfs' : 'ft', country: 'US' };
}

export const usaceProvider: GaugeProvider = {
    id: 'USACE',
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: true,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const wanted = new Set(siteCodes);
        const results: Record<string, GaugeReading> = {};
        for (const project of await fetchProjects()) {
            for (const [id, site] of projectSites(project)) {
                if (!wanted.has(id)) continue;
                const reading = latestReading(project, site);
                if (reading) results[id] = reading;
            }
        }
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>> {
        const now = Date.now();
        const end = endTs ?? now;
        const start = Math.max(startTs, end - MAX_HISTORY_MS);
        const sites = await loadSites(env);
        const results: Record<string, GaugeHistory> = {};

        await Promise.all(siteCodes.map(async (code) => {
            const site = sites[code];
            if (!site) return;
            try {
                results[code] = await siteHistory(code, site, start, end, Boolean(includeForecast), now);
            } catch (e) {
                const msg = `USACE history fetch failed for ${code}`;
                if (env?.DB) await logToD1(env, 'WARN', 'usace', msg, e); else console.warn(msg, e);
            }
        }));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const wanted = new Set(siteCodes);
        return (await this.getFullSiteListing!()).filter(s => wanted.has(s.id));
    },

    async getFullSiteListing(): Promise<GaugeSite[]> {
        const results: GaugeSite[] = [];
        for (const project of await fetchProjects()) {
            if (typeof project.lat !== 'number' || typeof project.lon !== 'number') continue;
            for (const [id, site] of projectSites(project)) {
                results.push({ id, name: site.name, lat: project.lat, lon: project.lon, state: project.state?.toUpperCase(), country: 'US' });
            }
        }
        return results;
    }
};
