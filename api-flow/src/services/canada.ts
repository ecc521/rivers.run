export interface CanadaGaugeReading {
    dateTime: number;
    cms?: number;
    m?: number;
}

export interface CanadaGauge {
    readings: CanadaGaugeReading[];
    units: string;
    name?: string | null;
}

export type CanadianProvinceData = Record<string, CanadaGauge>;

function reformatReadings(readingsArr: any[]) {
    for (let i = 0; i < readingsArr.length; i++) {
        const reading = readingsArr[i];
        reading.dateTime = new Date(reading.dateTime).getTime();
        
        if (reading.cms !== undefined && !isNaN(parseFloat(reading.cms))) {
            reading.cms = Number(reading.cms);
        }

        if (reading.m !== undefined && !isNaN(parseFloat(reading.m))) {
            reading.m = Number(reading.m);
        }
    }
    // Sort so newest values are last
    readingsArr.sort((a, b) => a.dateTime - b.dateTime);
}

// Fetch loop function
export async function loadCanadianProvince(province: string): Promise<CanadianProvinceData> {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_hourly_hydrometric.csv`;

    let res;
    try {
        res = await fetch(url);
        if (!res.ok) {
            if (res.status === 404) return {}; // seasonal gauge downtime
            throw new Error(`Canada HTTP Error: ${res.status}`);
        }
    } catch (e: unknown) {
        console.error(`Canadian Fetch failed for ${province}:`, e instanceof Error ? e.message : e);
        return {};
    }

    const text = await res.text();
    const lines = text.split('\n');
    if (lines.length < 2) return {};

    // Standard columns observed: "ID", "Date", "Water Level / Niveau d'eau (m)", "Discharge / Débit (cms)"
    const headers = lines[0].split(',').map(h => h.replace(/["\r]/g, '').trim());
    
    // Find index of relevant fields natively without a heavy dependency
    const idIdx = headers.indexOf('ID') !== -1 ? headers.indexOf('ID') : 0;
    const dateIdx = headers.indexOf('Date');
    const levelIdx = headers.indexOf("Water Level / Niveau d'eau (m)");
    const cmsIdx = headers.indexOf("Discharge / Débit (cms)");

    if (dateIdx === -1) return {}; // Malformed payload check

    const gaugeReadings: Record<string, any[]> = {};

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.replace(/["\r]/g, '').trim());
        if (row.length < headers.length - 1) continue;

        const id = row[idIdx];
        if (!id) continue;

        if (!gaugeReadings[id]) gaugeReadings[id] = [];
        
        gaugeReadings[id].push({
            dateTime: row[dateIdx],
            m: levelIdx !== -1 ? row[levelIdx] : undefined,
            cms: cmsIdx !== -1 ? row[cmsIdx] : undefined
        });
    }

    const outputGauges: CanadianProvinceData = {};
    const cutoffTime = Date.now() - (1000 * 60 * 60 * 6); // Cap at last 6 hours locally to trim fat

    for (const gaugeID in gaugeReadings) {
        const results = gaugeReadings[gaugeID];
        reformatReadings(results);

        // Trim readings
        const trimmed = results.filter((r: any) => r.dateTime >= cutoffTime);
        
        if (trimmed.length > 0) {
            outputGauges[gaugeID] = {
                readings: trimmed,
                units: "m",
            };
        }
    }

    return outputGauges;
}

export async function loadSingleCanadianGauge(gaugeID: string, province: string): Promise<CanadaGauge | null> {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_${gaugeID}_hourly_hydrometric.csv`;

    let res;
    try {
        res = await fetch(url);
        if (!res.ok) return null;
    } catch {
        return null; // Connection failure
    }

    const text = await res.text();
    const lines = text.split('\n');
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.replace(/["\r]/g, '').trim());
    const dateIdx = headers.indexOf('Date');
    const levelIdx = headers.indexOf("Water Level / Niveau d'eau (m)");
    const cmsIdx = headers.indexOf("Discharge / Débit (cms)");

    if (dateIdx === -1) return null;

    const readings: any[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.replace(/["\r]/g, '').trim());
        if (row.length < headers.length - 1) continue;

        readings.push({
            dateTime: row[dateIdx],
            m: levelIdx !== -1 ? row[levelIdx] : undefined,
            cms: cmsIdx !== -1 ? row[cmsIdx] : undefined
        });
    }

    reformatReadings(readings);

    return {
        readings,
        units: "m"
    };
}
