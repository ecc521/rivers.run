"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUSGSResponse = processUSGSResponse;
exports.loadSitesFromUSGS = loadSitesFromUSGS;
// Parses the USGS output back into legacy formatting
function processUSGSResponse(obj) {
    const timeSeries = obj.value.timeSeries || [];
    const usgsSites = {};
    for (let i = 0; i < timeSeries.length; i++) {
        const seriesItem = timeSeries[i];
        const siteCode = seriesItem.sourceInfo.siteCode[0].value;
        if (!usgsSites[siteCode]) {
            usgsSites[siteCode] = {
                name: seriesItem.sourceInfo.siteName,
                readings: new Map()
            };
        }
        const siteObj = usgsSites[siteCode];
        let values = seriesItem.values[0].value || [];
        const noDataValue = seriesItem.variable.noDataValue;
        values = values.filter((val) => val.value !== noDataValue && val.value !== String(noDataValue));
        let property;
        const unitCode = seriesItem.variable.unit.unitCode;
        switch (unitCode) {
            case "deg C":
                values.forEach((val) => {
                    const tempInF = Number(val.value) * 1.8 + 32;
                    val.value = Math.round(tempInF * 100) / 100;
                });
            // Fall through intentional (legacy logic mapped deg C -> F and logged as temp)
            case "deg F":
                property = "temp";
                break;
            case "ft3/s":
                property = "cfs";
                break;
            case "ft":
                property = "feet";
                break;
            case "in":
                property = "precip";
                break;
            default:
                console.warn(`Unknown Unit ${unitCode}`);
                continue;
        }
        if (property) {
            values.forEach((val) => {
                const dateTime = new Date(val.dateTime).getTime();
                let currentReading = siteObj.readings.get(dateTime);
                if (!currentReading) {
                    currentReading = {};
                    siteObj.readings.set(dateTime, currentReading);
                }
                currentReading[property] = Number(val.value);
            });
        }
    }
    // Combine and sort timestamps
    for (const gaugeID in usgsSites) {
        const site = usgsSites[gaugeID];
        const timestamps = Array.from(site.readings.keys()).sort((a, b) => a - b);
        const newReadings = [];
        timestamps.forEach((timestamp) => {
            const newReading = site.readings.get(timestamp);
            newReading.dateTime = timestamp;
            newReadings.push(newReading);
        });
        site.readings = newReadings;
    }
    return usgsSites;
}
// Fetch loop function supporting chunking
async function loadSitesFromUSGS(siteCodes, timeInPastMs = 1000 * 60 * 60 * 3) {
    const periodHours = Math.round(timeInPastMs / (1000 * 60 * 60));
    const periodStr = `&period=PT${periodHours}H`;
    const BATCH_SIZE = 150;
    const allSites = {};
    for (let i = 0; i < siteCodes.length; i += BATCH_SIZE) {
        const batch = siteCodes.slice(i, i + BATCH_SIZE);
        const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${batch.join(",")}${periodStr}&parameterCd=00060,00065,00010,00011,00045&siteStatus=all`;
        try {
            const res = await fetch(url);
            if (!res.ok)
                throw new Error(`USGS HTTP Error: ${res.status}`);
            const data = await res.json();
            const processedSites = processUSGSResponse(data);
            Object.assign(allSites, processedSites);
        }
        catch (e) {
            console.error(`USGS Fetch failed for batch, skipping: ${e.message}`);
        }
    }
    return allSites;
}
//# sourceMappingURL=usgs.js.map