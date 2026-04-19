import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode, formatGaugeName } from '../utils/formatting';

/**
 * Hub'Eau France (Hydrométrie API) Gauge Data Service
 */
export const franceProvider: GaugeProvider = {
    id: "france",
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const results: Record<string, GaugeReading> = {};
        
        // If we want the latest for all or many, it's efficient to fetch the last hour
        // For a specific small list, we could use code_entite, but the "all last hour"
        // approach is robust for the background sync.
        
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const isoDate = oneHourAgo.toISOString().split('.')[0] + 'Z';

        const fetchMetric = async (metric: 'H' | 'Q') => {
            const baseUrl = "https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr";
            let url = `${baseUrl}?size=20000&date_obs_min=${isoDate}&grandeur_hydro=${metric}`;
            
            // If specific site codes are provided, and the list is small enough, we can filter by them
            // However, Hub'Eau observation query for many IDs is slow/limited.
            // For discovery/sync, siteCodes is often empty or a massive list.
            const siteSet = new Set(siteCodes);
            const filterByIds = siteCodes.length > 0 && siteCodes.length < 50;
            
            if (filterByIds) {
                url += `&code_entite=${siteCodes.join(',')}`;
            }

            try {
                const res = await fetch(url);
                if (!res.ok) return;
                
                const data: any = await res.json();
                const items = data.data || [];
                
                for (const item of items) {
                    const id = item.code_station;
                    if (!id) continue;
                    if (siteCodes.length > 0 && !siteSet.has(id)) continue;

                    const ts = new Date(item.date_obs).getTime();
                    const val = Number(item.resultat_obs);
                    
                    if (!results[id]) {
                        results[id] = { dateTime: ts };
                    }

                    // Hub'Eau sorts desc by default, so first one we see is the latest
                    if (ts > results[id].dateTime) {
                        results[id].dateTime = ts;
                    }

                    if (metric === 'H') {
                        if (isValidReadingValue(val / 1000, "m")) {
                            results[id].m = val / 1000; // mm to m
                        }
                    } else {
                        if (isValidReadingValue(val / 1000, "cms")) {
                            results[id].cms = val / 1000; // L/s to m3/s
                        }
                    }
                }
            } catch (e) {
                console.error(`France getLatest ${metric} failed:`, e);
            }
        };

        await Promise.all([fetchMetric('H'), fetchMetric('Q')]);
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const results: Record<string, GaugeHistory> = {};
        const maxTime = endTs ?? Date.now();
        const isoStart = new Date(startTs).toISOString().split('.')[0] + 'Z';
        
        const CONCURRENCY_LIMIT = 3;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const id = siteCodes[index++];
                const readingsMap: Record<number, GaugeReading> = {};

                const fetchMetricHistory = async (metric: 'H' | 'Q') => {
                    const url = `https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?code_entite=${id}&date_obs_min=${isoStart}&grandeur_hydro=${metric}&size=5000&sort=asc`;
                    try {
                        const res = await fetch(url);
                        if (!res.ok) return;
                        const data: any = await res.json();
                        const items = data.data || [];
                        
                        for (const item of items) {
                            const ts = new Date(item.date_obs).getTime();
                            const val = Number(item.resultat_obs);
                            if (ts > maxTime) continue;

                            if (!readingsMap[ts]) {
                                readingsMap[ts] = { dateTime: ts };
                            }

                            if (metric === 'H') {
                                if (isValidReadingValue(val / 1000, "m")) {
                                    readingsMap[ts].m = val / 1000;
                                }
                            } else {
                                if (isValidReadingValue(val / 1000, "cms")) {
                                    readingsMap[ts].cms = val / 1000;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`France history fetch failed for ${id} ${metric}`, e);
                    }
                };

                await Promise.all([fetchMetricHistory('H'), fetchMetricHistory('Q')]);

                const readings = Object.values(readingsMap).toSorted((a, b) => a.dateTime - b.dateTime);
                if (readings.length > 0) {
                    const formatted = formatGaugeName(id); // Name will be refined if we have site mapping
                    results[id] = {
                        id,
                        name: formatted.name,
                        readings,
                        units: "m"
                    };
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        // Normally used for individual history lookup metadata
        // For France, we can fetch metadata for a specific station
        const results: GaugeSite[] = [];
        const CONCURRENCY_LIMIT = 5;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const id = siteCodes[index++];
                const url = `https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?code_station=${id}`;
                try {
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    const data: any = await res.json();
                    const item = data.data?.[0];
                    if (item && item.latitude && item.longitude) {
                        const formatted = formatGaugeName(item.libelle_station || id);
                        results.push({
                            id,
                            name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                            lat: item.latitude,
                            lon: item.longitude,
                            state: formatStateCode(item.code_departement, "france")
                        });
                    }
                } catch (e) {
                    console.warn(`France site metadata fetch failed for ${id}`, e);
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getFullSiteListing(): Promise<GaugeSite[]> {
        console.log("France Provider: Fetching full site listing...");
        const results: GaugeSite[] = [];
        let nextUrl: string | null = "https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?en_service=true&size=1000";

        try {
            while (nextUrl) {
                const res = await fetch(nextUrl);
                if (!res.ok) break;
                const data: any = await res.json();
                const items = data.data || [];
                
                for (const item of items) {
                    // Filter for stations that actually have real-time capabilities to avoid junk
                    if (!item.grandeur_h_reelle && !item.grandeur_q_reelle) continue;
                    
                    if (item.code_station && item.latitude && item.longitude) {
                        const rawName = item.libelle_station || item.libelle_site || `France Station ${item.code_station}`;
                        const formatted = formatGaugeName(rawName);
                        results.push({
                            id: item.code_station,
                            name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                            lat: item.latitude,
                            lon: item.longitude,
                            state: formatStateCode(item.code_departement, "france")
                        });
                    }
                }
                nextUrl = data.next || null;
            }
        } catch (e) {
            console.error("France Provider: Full site listing failed", e);
            throw e;
        }
        
        return results;
    }
};
