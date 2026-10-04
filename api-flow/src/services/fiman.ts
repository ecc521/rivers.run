import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue, isRiverStageFt } from './provider';
import { edgeCachedJson } from '../utils/edgeCache';
import { logToD1 } from '../utils/logger';
import { formatGaugeName } from '../utils/formatting';

/**
 * NC Flood Inundation Mapping and Alert Network (FIMAN, fiman.nc.gov), the state's
 * rain and stage gauge network: NCEM, NCDOT, county and town gauges plus some USGS
 * and dam sites. These are stage-only (ft); the few flow readings belong to USGS
 * sites that the USGS provider already serves.
 *
 *  - /api/gaugefeatures lists every gauge with its latest stage in one request.
 *  - /api/gauges/<siteId> adds about 30 days of history, as elevation above sea level.
 *    Stage is that elevation minus the gauge's datum.
 *
 * Times are Eastern local time: `lastUpdate` is "Oct  4 2026  2:31PM" and history
 * `at` is an unzoned ISO string. (`hydroAllDate` is labeled Z but is also Eastern,
 * and is when FIMAN polled the gauge, so it is not used.)
 *
 * Nothing is written to the flow store (FETCH_ONLY_PROVIDERS): the cycle fetches
 * latest values for sitedata.json, and graphs fetch history live.
 */

const FIMAN_BASE = 'https://fiman.nc.gov/api';
const STAGE_CODE = '00065';
const MAX_HISTORY_MS = 30 * 24 * 60 * 60 * 1000;
/** The feed and per-gauge history are shared between callers for this long, per Cloudflare location. */
const FEED_CACHE_SECONDS = 120;
const HISTORY_CACHE_SECONDS = 300;

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const easternParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

/** Milliseconds Eastern wall-clock time is ahead of UTC at the given instant (negative). */
function easternOffsetMs(instant: number): number {
    const p = Object.fromEntries(easternParts.formatToParts(instant).map(x => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}

const HOUR_MS = 3_600_000;

/**
 * UTC ms of an Eastern wall-clock time. In the repeated November hour the first (EDT)
 * reading wins; a time skipped in March is read as EST.
 */
export function easternToUtcMs(y: number, mo: number, d: number, h: number, mi: number, s = 0): number {
    const wall = Date.UTC(y, mo, d, h, mi, s);
    const valid = [4, 5].map(hours => wall + hours * HOUR_MS).filter(t => easternOffsetMs(t) === wall - t);
    return valid[0] ?? wall + 5 * HOUR_MS;
}

/** "Oct  4 2026  2:31PM" as UTC ms, or null. */
export function parseLastUpdate(text: unknown): number | null {
    const m = /^([a-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(text ?? '').trim());
    const month = m ? MONTHS[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()] : undefined;
    if (!m || month === undefined) return null;
    const hour = (Number(m[4]) % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
    return easternToUtcMs(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
}

/** "2026-10-04T14:31:50" (Eastern, unzoned) as UTC ms, or null. */
export function parseHistoryTime(text: unknown): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(text ?? ''));
    if (!m) return null;
    return easternToUtcMs(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

/** Town of Cary gauges are named by stream initials ("SC: Seabrook US"). */
const STREAM_PREFIXES: Record<string, string> = { SC: 'Swift Creek', WC: 'Walnut Creek', CC: 'Crabtree Creek' };

/** A name and section in the house style, e.g. "Eastfork Pigeon River at Cruso Rd" as "Eastfork Pigeon River" and "Cruso Road". */
export function displayName(raw: unknown, fallback: string): { name: string; section?: string } {
    let text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    text = text.replace(/^([A-Z]{2}):\s*/, (match, stream: string) => (STREAM_PREFIXES[stream] ? `${STREAM_PREFIXES[stream]} at ` : match));
    text = text.replace(/@/g, ' at ').replace(/\s+/g, ' ');
    return text ? formatGaugeName(text, 'FIMAN') : { name: fallback };
}

/** Out-of-state gauges have the state in the county ("Danville VA"); everything else is NC. */
const stateOf = (county: unknown) => /\s(VA|SC|TN|GA)$/.exec(String(county ?? '').trim())?.[1] ?? 'NC';

async function fetchFeed(): Promise<any[]> {
    const data = await edgeCachedJson(`${FIMAN_BASE}/gaugefeatures`, { timeoutMs: 60000, ttlSeconds: FEED_CACHE_SECONDS, label: 'FIMAN' });
    return (data.features ?? []).map((f: any) => f?.properties).filter((p: any) => p?.siteId != null);
}

/**
 * Feet to subtract from history elevations to get the feed's stage. Taken from the
 * gauge's own current elevation and stage when both are present, else its datum.
 */
export function stageOffset(gauge: any): number | null {
    const elevation = Number(gauge.currentElevationMsl);
    const stage = Number(gauge.hydroAllStage);
    if (gauge.currentElevationMsl != null && gauge.hydroAllStage != null && isFinite(elevation) && isFinite(stage)) return elevation - stage;
    const datum = Number(gauge.gageDatum);
    return gauge.gageDatum != null && isFinite(datum) ? datum : null;
}

export function latestReading(props: any): GaugeReading | null {
    const dateTime = parseLastUpdate(props.lastUpdate);
    if (dateTime === null || !isValidReadingValue(props.hydroAllStage, 'ft')) return null;
    return { dateTime, ft: Math.round(Number(props.hydroAllStage) * 1000) / 1000 };
}

export const fimanProvider: GaugeProvider = {
    id: 'FIMAN',
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const wanted = new Set(siteCodes);
        const results: Record<string, GaugeReading> = {};
        for (const props of await fetchFeed()) {
            const id = String(props.siteId);
            if (!wanted.has(id)) continue;
            const reading = latestReading(props);
            if (reading) results[id] = reading;
        }
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>> {
        const end = endTs ?? Date.now();
        const start = Math.max(startTs, end - MAX_HISTORY_MS);
        const results: Record<string, GaugeHistory> = {};

        await Promise.all(siteCodes.map(async (code) => {
            try {
                const gauge = await edgeCachedJson(`${FIMAN_BASE}/gauges/${encodeURIComponent(code)}`, {
                    timeoutMs: 30000, ttlSeconds: HISTORY_CACHE_SECONDS, label: 'FIMAN',
                });
                const offset = stageOffset(gauge);
                if (offset === null) return;
                const readings: GaugeReading[] = [];
                for (const h of gauge.historical ?? []) {
                    if (h.code !== STAGE_CODE) continue;
                    const dateTime = parseHistoryTime(h.at);
                    if (dateTime === null || dateTime < start || dateTime > end) continue;
                    const ft = Number(h.value) - offset;
                    if (isValidReadingValue(h.value, 'ft')) readings.push({ dateTime, ft: Math.round(ft * 1000) / 1000 });
                }
                readings.sort((a, b) => a.dateTime - b.dateTime);
                results[code] = {
                    id: code,
                    ...displayName(gauge.name, code),
                    state: stateOf(gauge.county),
                    country: 'US',
                    lat: gauge.latitude,
                    lon: gauge.longitude,
                    readings,
                    units: 'ft',
                };
            } catch (e) {
                const msg = `FIMAN history fetch failed for ${code}`;
                if (env?.DB) await logToD1(env, 'WARN', 'fiman', msg, e); else console.warn(msg, e);
            }
        }));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const wanted = new Set(siteCodes);
        return (await listSites(props => wanted.has(String(props.siteId))));
    },

    /** The gauges worth a map marker of their own; see isMapEligible. */
    async getFullSiteListing(): Promise<GaugeSite[]> {
        const now = Date.now();
        return listSites(props => isMapEligible(props, now));
    }
};

async function listSites(keep: (props: any) => boolean): Promise<GaugeSite[]> {
    const results: GaugeSite[] = [];
    for (const props of await fetchFeed()) {
        const lat = Number(props.latitude);
        const lon = Number(props.longitude);
        if (props.latitude == null || props.longitude == null || !isFinite(lat) || !isFinite(lon) || !keep(props)) continue;
        const id = String(props.siteId);
        results.push({ id, ...displayName(props.name, id), lat, lon, state: stateOf(props.county), country: 'US' });
    }
    return results;
}

/** A reading older than this means a dead sensor, not just a slow one. */
const MAX_LISTING_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Owners whose gauges are urban storm drains, of no use on a river map. Rivers can still link them. */
const EXCLUDED_OWNERS = new Set(['Town of Cary']);

/**
 * Whether a gauge belongs on the map without a river linking it: a working, inland
 * stage gauge that USGS does not already own, reporting a river-like stage.
 */
export function isMapEligible(props: any, now: number): boolean {
    if (props.owner === 'USGS' || EXCLUDED_OWNERS.has(props.owner) || props.inService !== 1 || props.isCoastal || props.rainOnlyGage) return false;
    const stage = Number(props.hydroAllStage);
    if (props.hydroAllStage == null || !isFinite(stage) || !isRiverStageFt(stage)) return false;
    const at = parseLastUpdate(props.lastUpdate);
    return at !== null && now - at <= MAX_LISTING_AGE_MS;
}
