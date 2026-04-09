"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCanadianProvince = loadCanadianProvince;
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const meterInFeet = 3.2808399;
const cubicMeterInFeet = Math.pow(meterInFeet, 3);
function reformatReadings(readingsArr) {
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
async function loadCanadianProvince(province) {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_hourly_hydrometric.csv`;
    let res;
    try {
        res = await fetch(url);
        if (!res.ok) {
            if (res.status === 404)
                return {}; // seasonal gauge downtime
            throw new Error(`Canada HTTP Error: ${res.status}`);
        }
    }
    catch (e) {
        console.error(`Canadian Fetch failed for ${province}: ${e.message}`);
        return {};
    }
    const gaugeReadings = {};
    const nodeStream = stream_1.Readable.fromWeb(res.body);
    try {
        await new Promise((resolve, reject) => {
            nodeStream.pipe((0, csv_parser_1.default)({
                mapHeaders: ({ header }) => {
                    if (header === "Water Level / Niveau d'eau (m)")
                        return "meters";
                    if (header === "Discharge / Débit (cms)")
                        return "cms";
                    if (header === "Date")
                        return "dateTime";
                    if (header === " ID")
                        return "ID";
                    return null;
                }
            }))
                .on('data', (data) => {
                if (!gaugeReadings[data.ID])
                    gaugeReadings[data.ID] = [];
                gaugeReadings[data.ID].push(data);
                delete data.ID;
            })
                .on('end', resolve)
                .on('error', reject);
        });
    }
    catch (e) {
        console.error(`Canada CSV parse failed for ${province}: ${e.message}`);
        return {};
    }
    const outputGauges = {};
    // Optional bounding timeframe could go here, but CSV is minimal length already.
    const cutoffTime = Date.now() - (1000 * 60 * 60 * 6); // Cap at last 6 hours locally to trim fat
    for (const gaugeID in gaugeReadings) {
        const results = gaugeReadings[gaugeID];
        reformatReadings(results);
        // Trim readings
        const trimmed = results.filter((r) => r.dateTime >= cutoffTime);
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
//# sourceMappingURL=canada.js.map