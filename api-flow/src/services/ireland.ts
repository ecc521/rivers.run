import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite } from './provider';

/**
 * Ireland (WaterLevel.ie / OPW) Gauge Data Service
 */

export const irelandProvider: GaugeProvider = {
    id: "ireland",
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const results: Record<string, GaugeReading> = {};
        const url = "https://waterlevel.ie/geojson/latest/";
        
        try {
            const res = await fetch(url);
            if (!res.ok) return results;
            
            const data: any = await res.json();
            const features = data.features || [];
            
            const siteSet = new Set(siteCodes);
            
            for (const f of features) {
                const props = f.properties || {};
                const id = props.station_ref;
                if (!id || !siteSet.has(id)) continue;
                
                if (props.value !== undefined) {
                    results[id] = {
                        dateTime: new Date(props.datetime).getTime(),
                        m: Number(props.value)
                    };
                }
            }
        } catch (e: unknown) {
            console.error("Ireland getLatest Failed:", e);
        }
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const durationMs = maxTime - startTs;
        const period = durationMs > 1000 * 60 * 60 * 24 * 7 ? "month" : "week";
        const results: Record<string, GaugeHistory> = {};
        
        const CONCURRENCY_LIMIT = 3;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const stationId = siteCodes[index++];
                // We'll primarily fetch gauge 0001 (water level)
                const url = `https://waterlevel.ie/data/${period}/${stationId}_0001.csv`;
                
                try {
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    
                    const text = await res.text();
                    const lines = text.split('\n');
                    if (lines.length < 2) continue;
                    
                    const readings: GaugeReading[] = [];
                    
                    // OPW CSV format: datetime,value (without headers in some cases, or has generic headers)
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line || line.startsWith("#") || line.startsWith("datetime")) continue;
                        
                        const [dtStr, valStr] = line.split(',');
                        const ts = new Date(dtStr).getTime();
                        if (isNaN(ts) || ts < startTs || ts > maxTime) continue;
                        
                        readings.push({
                            dateTime: ts,
                            m: Number(valStr)
                        });
                    }
                    
                    results[stationId] = {
                        id: stationId,
                        name: `Ireland Station ${stationId}`,
                        readings: readings.sort((a, b) => a.dateTime - b.dateTime),
                        units: "m"
                    };
                } catch (e) {
                    console.warn(`Ireland history fetch failed for ${stationId}`, e);
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const url = "https://waterlevel.ie/geojson/latest/";
        const results: GaugeSite[] = [];
        
        try {
            const res = await fetch(url);
            if (!res.ok) return results;
            
            const data: any = await res.json();
            const features = data.features || [];
            
            const siteSet = new Set(siteCodes);
            const wantAll = siteCodes.length === 0; // if empty, map all? Optionally.
            
            for (const f of features) {
                const props = f.properties || {};
                const id = props.station_ref;
                const coords = f.geometry?.coordinates || [0, 0];
                
                if (id && (wantAll || siteSet.has(id))) {
                    results.push({
                        id: id,
                        name: props.station_name || `Ireland Station ${id}`,
                        lat: coords[1],
                        lon: coords[0]
                    });
                }
            }
        } catch (e: unknown) {}
        
        return results;
    }
};
