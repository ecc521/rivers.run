// Parses the USGS output back into legacy formatting
export function processUSGSResponse(obj: any): any {
  const timeSeries = obj.value.timeSeries || [];
  const usgsSites: any = {};

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

    const noDataValue = Number(seriesItem.variable.noDataValue);
    values = values.filter((val: any) => Number(val.value) !== noDataValue);

    let property: string | undefined;
    const unitCode = seriesItem.variable.unit.unitCode;
    
    switch (unitCode) {
      case "deg C":
        values.forEach((val: any) => {
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
      values.forEach((val: any) => {
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
    const timestamps = Array.from(site.readings.keys()).sort((a: any, b: any) => a - b);
    const newReadings: any[] = [];

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
export async function loadSitesFromUSGS(siteCodes: string[], timeInPastMs = 1000 * 60 * 60 * 3): Promise<any> {
    const periodHours = Math.round(timeInPastMs / (1000 * 60 * 60));
    const periodStr = `&period=PT${periodHours}H`;
    
    const BATCH_SIZE = 150;
    const allSites = {};

    const batches: string[][] = [];
    for (let i = 0; i < siteCodes.length; i += BATCH_SIZE) {
        batches.push(siteCodes.slice(i, i + BATCH_SIZE));
    }

    const CONCURRENCY_LIMIT = 3;
    let batchIndex = 0;

    const worker = async () => {
        while (batchIndex < batches.length) {
            const batch = batches[batchIndex++];
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${batch.join(",")}${periodStr}&parameterCd=00060,00065,00010,00011,00045&siteStatus=all`;
            
            let success = false;
            let attempts = 0;
            const MAX_RETRIES = 2; // Up to 3 total attempts

            while (!success && attempts <= MAX_RETRIES) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`USGS HTTP Error: ${res.status}`);
                    
                    const data = await res.json();
                    const processedSites = processUSGSResponse(data);
                    Object.assign(allSites, processedSites);
                    success = true;
                } catch (e: unknown) {
                    attempts++;
                    const msg = e instanceof Error ? e.message : String(e);
                    if (attempts > MAX_RETRIES) {
                        console.error(`USGS Fetch failed completely for batch after ${attempts} attempts, skipping: ${msg}`);
                    } else {
                        console.warn(`USGS Fetch failed (Attempt ${attempts}/${MAX_RETRIES + 1}), backing off... Error: ${msg}`);
                        // 3 seconds backoff, then 6 seconds
                        await new Promise(r => setTimeout(r, attempts * 3000));
                    }
                }
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));

    return allSites;
}
