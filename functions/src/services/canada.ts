import csvParser from "csv-parser";

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

    if (!res.body) return {};

    const gaugeReadings: Record<string, any[]> = {};
    const nodeStream = res.body as unknown as NodeJS.ReadableStream;

    try {
        await new Promise((resolve, reject) => {
            nodeStream.pipe(csvParser({
                mapHeaders: ({ header }: { header: string }) => {
                    if (header === "Water Level / Niveau d'eau (m)") return "m";
                    if (header === "Discharge / Débit (cms)") return "cms";
                    if (header === "Date") return "dateTime";
                    if (header === " ID") return "ID";
                    return null;
                }
            }))
            .on('data', (data: any) => {
                if (!gaugeReadings[data.ID]) gaugeReadings[data.ID] = [];
                gaugeReadings[data.ID].push(data);
                delete data.ID;
            })
            .on('end', resolve)
            .on('error', reject);
        });
    } catch (e: unknown) {
        console.error(`Canada CSV parse failed for ${province}:`, e instanceof Error ? e.message : e);
        return {};
    }

    const outputGauges: CanadianProvinceData = {};
    // Optional bounding timeframe could go here, but CSV is minimal length already.
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
                // name: null (legacy fallback since missing metadata block)
            };
        }
    }

    return outputGauges;
}
