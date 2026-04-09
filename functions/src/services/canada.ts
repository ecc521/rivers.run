import csvParser from "csv-parser";
import { Readable } from "stream";

const meterInFeet = 3.2808399;
const cubicMeterInFeet = Math.pow(meterInFeet, 3);

function reformatReadings(readingsArr: any[]) {
    for (let i = 0; i < readingsArr.length; i++) {
        const reading = readingsArr[i];
        reading.dateTime = new Date(reading.dateTime).getTime();

        if (!isNaN(parseFloat(reading.cms))) {
            const cfs = Number(reading.cms) * cubicMeterInFeet;
            reading.cfs = Math.round(cfs * 10) / 10;
        }
        delete reading.cms;

        if (!isNaN(parseFloat(reading.meters))) {
            const feet = Number(reading.meters) * meterInFeet;
            reading.feet = Math.round(feet * 100) / 100;
        }
        delete reading.meters;
    }
    // Sort so newest values are last
    readingsArr.sort((a, b) => a.dateTime - b.dateTime);
}

// Fetch loop function
export async function loadCanadianProvince(province: string): Promise<any> {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_hourly_hydrometric.csv`;

    let res;
    try {
        res = await fetch(url);
        if (!res.ok) {
            if (res.status === 404) return {}; // seasonal gauge downtime
            throw new Error(`Canada HTTP Error: ${res.status}`);
        }
    } catch (e: any) {
        console.error(`Canadian Fetch failed for ${province}: ${e.message}`);
        return {};
    }

    const gaugeReadings: any = {};
    const nodeStream = Readable.fromWeb(res.body as any);

    try {
        await new Promise((resolve, reject) => {
            nodeStream.pipe(csvParser({
                mapHeaders: ({ header }: { header: string }) => {
                    if (header === "Water Level / Niveau d'eau (m)") return "meters";
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
    } catch (e: any) {
        console.error(`Canada CSV parse failed for ${province}: ${e.message}`);
        return {};
    }

    const outputGauges: any = {};
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
