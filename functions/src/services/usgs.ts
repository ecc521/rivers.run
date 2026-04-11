export function formatGaugeName(name: string): { name: string; section?: string } {
    const lowercaseWords = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr']);
    const stateCodes = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU'
    ]);
    const acronyms = new Set([
        'USGS', 'USA', 'TVA', 'NWS',
        'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
    ]);

    const matches = name.match(/([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g) || [];

    let formatted = "";
    let wordIndex = 0;
    const wordsOnly = matches.filter(m => /^[a-zA-Z0-9]+$/.test(m));

    for (let i = 0; i < matches.length; i++) {
        const token = matches[i];
        if (/^[a-zA-Z0-9]+$/.test(token)) {
            const index = wordIndex++;
            const isFirst = index === 0;
            const isLast = index === wordsOnly.length - 1;
            const upperToken = token.toUpperCase();
            const lowerToken = token.toLowerCase();
            
            const prevToken = i > 0 ? matches[i - 1] : "";
            const followsComma = prevToken.includes(',');

            if (acronyms.has(upperToken)) {
                formatted += upperToken;
            } else if (stateCodes.has(upperToken) && (isLast || followsComma)) {
                formatted += upperToken;
            } else if (!isFirst && lowercaseWords.has(lowerToken)) {
                formatted += lowerToken;
            } else {
                formatted += token.charAt(0).toUpperCase() + lowerToken.slice(1);
            }
        } else {
            formatted += token;
        }
    }

    const formattedString = formatted.replace(/\s+/g, ' ').trim();

    const delimiters = [' at ', ' near ', ' above ', ' below ', ' nr ', ' blw ', ' abv '];
    let splitIndex = -1;
    
    const lowerFormatted = formattedString.toLowerCase();

    for (const d of delimiters) {
        const idx = lowerFormatted.indexOf(d);
        if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
            splitIndex = idx;
        }
    }

    if (splitIndex !== -1) {
        const gaugeName = formattedString.substring(0, splitIndex).trim();
        let section = formattedString.substring(splitIndex).trim();
        section = section.charAt(0).toUpperCase() + section.slice(1); // Capitalize first letter of section
        return { name: gaugeName, section };
    }

    return { name: formattedString };
}

// Parses the USGS output back into legacy formatting
export function processUSGSResponse(obj: any): any {
  const timeSeries = obj.value.timeSeries || [];
  const usgsSites: any = {};

  for (let i = 0; i < timeSeries.length; i++) {
    const seriesItem = timeSeries[i];
    const siteCode = seriesItem.sourceInfo.siteCode[0].value;

    if (!usgsSites[siteCode]) {
      const formatted = formatGaugeName(seriesItem.sourceInfo.siteName);
      usgsSites[siteCode] = {
        name: formatted.name,
        section: formatted.section,
        readings: new Map()
      };
      if (!usgsSites[siteCode].section) {
          delete usgsSites[siteCode].section;
      }
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
        property = "ft";
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
        // Snap to nearest 5 minutes (300,000 ms) to align disparate parameter timestamps
        const rawTime = new Date(val.dateTime).getTime();
        const snappedTime = Math.round(rawTime / 300000) * 300000;
        
        let currentReading = siteObj.readings.get(snappedTime);
        if (!currentReading) {
          currentReading = {};
          siteObj.readings.set(snappedTime, currentReading);
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
