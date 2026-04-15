import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite } from './provider';

export function formatGaugeName(name: string): { name: string; section?: string } {
    const lowercaseWords = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr']);
    const expansions: Record<string, string> = {
        nr: 'near',
        blw: 'below',
        abv: 'above',
        br: 'branch',
        cr: 'creek'
    };
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

            const expansion = expansions[lowerToken];
            if (expansion) {
                const isLowercaseExpandedWord = lowercaseWords.has(expansion);
                if (!isFirst && isLowercaseExpandedWord) {
                    formatted += expansion;
                } else {
                    formatted += expansion.charAt(0).toUpperCase() + expansion.slice(1);
                }
            } else if (acronyms.has(upperToken)) {
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

    const delimiters = [' at ', ' near ', ' above ', ' below '];
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

// Parses the USGS output back into legacy formatting/GaugeHistory
export function processUSGSResponse(obj: any): Record<string, GaugeHistory> {
  const timeSeries = obj.value.timeSeries || [];
  const usgsSites: Record<string, GaugeHistory> = {};

  for (let i = 0; i < timeSeries.length; i++) {
    const seriesItem = timeSeries[i];
    const sourceInfo = seriesItem.sourceInfo;
    const siteCode = sourceInfo.siteCode[0].value;

    if (!usgsSites[siteCode]) {
      const formatted = formatGaugeName(sourceInfo.siteName);
      usgsSites[siteCode] = {
        id: siteCode,
        name: formatted.name,
        section: formatted.section,
        readings: [],
      };
      
      // Attempt to populate lat/lon if present
      if (sourceInfo.geoLocation?.geogLocation) {
        usgsSites[siteCode].lat = sourceInfo.geoLocation.geogLocation.latitude;
        usgsSites[siteCode].lon = sourceInfo.geoLocation.geogLocation.longitude;
      }
    }
    const siteObj = usgsSites[siteCode];
    let values = seriesItem.values[0].value || [];

    const noDataValue = Number(seriesItem.variable.noDataValue);
    values = values.filter((val: any) => Number(val.value) !== noDataValue);

    let property: keyof GaugeReading | undefined;
    const unitCode = seriesItem.variable.unit.unitCode;
    
    switch (unitCode) {
      case "deg C":
        values.forEach((val: any) => {
          const tempInF = Number(val.value) * 1.8 + 32;
          val.value = Math.round(tempInF * 100) / 100;
        });
      // Fall through intentional (legacy logic mapped deg C -> F and logged as temp)
      case "deg F":
        property = "temp_f";
        break;
      case "ft3/s":
        property = "cfs";
        break;
      case "ft":
        property = "ft";
        break;
      case "in":
        property = "precip_in";
        break;
      default:
        continue;
    }

    if (property) {
      // Build a map of dateTime matched to values
      // Note: we'll augment readings array efficiently.
      // But we need to group by time (snapped to 5 mins).
      // Let's use a temporary map per site.
      (siteObj as any)._readingMap = (siteObj as any)._readingMap || new Map<number, GaugeReading>();
      const readingMap = (siteObj as any)._readingMap;

      values.forEach((val: any) => {
        const rawTime = new Date(val.dateTime).getTime();
        const snappedTime = Math.round(rawTime / 300000) * 300000;
        
        let currentReading = readingMap.get(snappedTime);
        if (!currentReading) {
          currentReading = { dateTime: snappedTime };
          readingMap.set(snappedTime, currentReading);
        }
        (currentReading as any)[property] = Number(val.value);
      });
    }
  }

  // Combine and sort timestamps
  for (const gaugeID in usgsSites) {
    const site = usgsSites[gaugeID];
    if ((site as any)._readingMap) {
        const timestamps = Array.from(((site as any)._readingMap as Map<number, GaugeReading>).keys()).sort((a, b) => a - b);
        site.readings = timestamps.map(ts => ((site as any)._readingMap as Map<number, GaugeReading>).get(ts)!);
        delete (site as any)._readingMap;
    }
  }

  return usgsSites;
}

// Reusable batch fetcher
async function fetchUSGSBatch(siteCodes: string[], timeQuery: string): Promise<Record<string, GaugeHistory>> {
    const BATCH_SIZE = 150;
    const allSites: Record<string, GaugeHistory> = {};

    const batches: string[][] = [];
    for (let i = 0; i < siteCodes.length; i += BATCH_SIZE) {
        batches.push(siteCodes.slice(i, i + BATCH_SIZE));
    }

    const CONCURRENCY_LIMIT = 3;
    let batchIndex = 0;

    const worker = async () => {
        while (batchIndex < batches.length) {
            const batch = batches[batchIndex++];
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${batch.join(",")}${timeQuery}&parameterCd=00060,00065,00010,00011,00045&siteStatus=all`;
            
            let success = false;
            let attempts = 0;
            const MAX_RETRIES = 2;

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
                        await new Promise(r => setTimeout(r, attempts * 3000));
                    }
                }
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return allSites;
}

export const usgsProvider: GaugeProvider = {
    id: "USGS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const histories = await fetchUSGSBatch(siteCodes, "&period=PT4H"); // fetch recent 4 hours
        const latest: Record<string, GaugeReading> = {};
        for (const [id, history] of Object.entries(histories)) {
            if (history.readings.length > 0) {
                // Return the last element
                latest[id] = history.readings[history.readings.length - 1];
            }
        }
        return latest;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const startIso = new Date(startTs).toISOString();
        const timeQuery = endTs 
            ? `&startDT=${startIso}&endDT=${new Date(endTs).toISOString()}`
            : `&startDT=${startIso}`;
            
        return fetchUSGSBatch(siteCodes, timeQuery);
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        if (siteCodes.length === 0) return [];
        // The IV endpoint returns geoLocation in the timeSeries sourceInfo payload if recent data exists.
        // Even if water data is missing, we grab a tiny timeframe just to get site metadata
        const histories = await fetchUSGSBatch(siteCodes, "&period=PT1H");
        const sites: GaugeSite[] = [];
        
        for (const id of siteCodes) {
            const hist = histories[id];
            if (hist && (hist as any).lat !== undefined) {
                sites.push({
                    id,
                    name: hist.name, // optionally format name
                    lat: (hist as any).lat,
                    lon: (hist as any).lon
                });
            }
        }
        return sites;
    }
};

