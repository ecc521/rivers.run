import { useState, useEffect } from "react";
import type { RiverData, GaugeReading } from "../types/River";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";

const dynamicUSGSCache = new Map<string, { lastFetchedMs: number; gaugeData: Record<string, GaugeReading[]>; gaugeNames?: Record<string, string> }>();

export function useDynamicUSGS(river: RiverData) {
  const [liveRiver, setLiveRiver] = useState<RiverData | null>(null);

  useEffect(() => {
    // Only attempt fetch if USGS gauges exist
    const usgsIDs = river.gauges?.filter(g => g.id.startsWith("USGS:")).map(g => g.id.replace("USGS:", "")) || [];
    if (usgsIDs.length === 0) return;

    const cacheKey = usgsIDs.join(",");
    const cached = dynamicUSGSCache.get(cacheKey);

    const primaryGaugeID = river.gauges?.[0]?.id;
    const existingDatasetLength = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.length ? river.gaugeData[primaryGaugeID].length : 0;
    const existingFirstTime = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.[0]?.dateTime ? river.gaugeData[primaryGaugeID][0].dateTime : 0;
    const existingLastTime = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.[existingDatasetLength - 1]?.dateTime ? river.gaugeData[primaryGaugeID][existingDatasetLength - 1].dateTime : 0;

    const hasThreeDays = existingDatasetLength > 0 && 
       (existingLastTime - existingFirstTime >= 2.5 * 24 * 60 * 60 * 1000);
    
    // Fall back tightly to a 15 minute fetch constraint
    const newlyFetched = cached && (Date.now() - cached.lastFetchedMs < 15 * 60 * 1000);

    const enrichAndSet = (dynamicGaugeData: Record<string, GaugeReading[]>, fetchedNames?: Record<string, string>) => {
       // Create a fresh clone to avoid prop mutation
       const enriched = { ...river };
       enriched.gaugeData = { ...(enriched.gaugeData || {}), ...dynamicGaugeData };
       
       const names = fetchedNames || cached?.gaugeNames;
       if (names && enriched.gauges) {
           enriched.gauges = enriched.gauges.map(g => {
               if (names[g.id]) return { ...g, name: names[g.id] };
               return g;
           });
       }
       
       const primaryData = primaryGaugeID && enriched.gaugeData[primaryGaugeID] ? enriched.gaugeData[primaryGaugeID] : null;
       const latest = primaryData && primaryData.length > 0 ? primaryData[primaryData.length - 1] : null;

       if (latest) {
           enriched.cfs = latest.cfs ?? enriched.cfs;
           const ftValue = latest.ft;
           enriched.ft = (ftValue !== undefined && !isNaN(ftValue)) ? ftValue : enriched.ft;
           enriched.running = calculateRelativeFlow(enriched) ?? enriched.running;
           
           if (enriched.cfs && enriched.ft) enriched.flowInfo = `${Math.round(enriched.cfs)} cfs ${Math.round(enriched.ft * 100) / 100} ft`;
           else if (enriched.cfs) enriched.flowInfo = `${Math.round(enriched.cfs)} cfs`;
           else if (enriched.ft) enriched.flowInfo = `${Math.round(enriched.ft * 100) / 100} ft`;
       }
       
       setLiveRiver(enriched);
    };

    if (hasThreeDays && newlyFetched && cached) {
       enrichAndSet(cached.gaugeData);
       return;
    }

    let isMounted = true;
    
    const fetchUSGS = async () => {
      try {
        const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${usgsIDs.join(",")}&period=P3D&parameterCd=00060,00065,00010,00011,00045`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("USGS server error");
        
        const json = await res.json();
        const timeSeries = json.value?.timeSeries || [];
        
        const gaugeDataMap: Record<string, Map<number, any>> = {};
        const siteNameMap: Record<string, string> = {};

        for (const seriesItem of timeSeries) {
            const sc = seriesItem.sourceInfo?.siteCode?.[0]?.value;
            if (!sc) continue;
            const gaugeId = `USGS:${sc}`;
            
            if (!gaugeDataMap[gaugeId]) gaugeDataMap[gaugeId] = new Map();

            const sn = seriesItem.sourceInfo?.siteName;
            if (sn && !siteNameMap[gaugeId]) {
                siteNameMap[gaugeId] = sn;
            }

            const noDataValue = seriesItem.variable.noDataValue;
            // Filter dead zones
            const values = seriesItem.values[0].value.filter((val: any) => val.value !== noDataValue && val.value !== String(noDataValue));
            const unitCode = seriesItem.variable.unit.unitCode;

            let property: string | undefined;
            if (unitCode === "deg C") {
               property = "temp";
               // Inline conversion to Fahrenheit to match backend parsing
               values.forEach((v: any) => v.value = Math.round((Number(v.value) * 1.8 + 32) * 100) / 100);
            } else if (unitCode === "deg F") {
               property = "temp";
            } else if (unitCode === "ft3/s") {
               property = "cfs";
            } else if (unitCode === "ft") {
               property = "feet";
            } else if (unitCode === "in") {
               property = "precip";
            }

            if (property) {
                values.forEach((val: any) => {
                    const ts = new Date(val.dateTime).getTime();
                    const existing = gaugeDataMap[gaugeId].get(ts) || { dateTime: ts };
                    existing[property] = Number(val.value);
                    gaugeDataMap[gaugeId].set(ts, existing);
                });
            }
        }

        if (!isMounted) return;

        // Splice seamlessly with our 15-minute cached `gaugeData` from Firebase!
        const mergedGaugeData: Record<string, GaugeReading[]> = {};
        
        for (const [gaugeId, map] of Object.entries(gaugeDataMap)) {
            const sortedLive = Array.from(map.values()).sort((a, b) => a.dateTime - b.dateTime);
            const cachedDataset = [...(river.gaugeData?.[gaugeId] || [])];
            
            for (const liveReading of sortedLive) {
                const matchIndex = cachedDataset.findIndex(item => item.dateTime === liveReading.dateTime);
                if (matchIndex >= 0) {
                   // Update completely precisely inline (e.g. if the cache was missing parameter values)
                   cachedDataset[matchIndex] = { ...cachedDataset[matchIndex], ...liveReading };
                } else {
                   cachedDataset.push(liveReading as GaugeReading);
                }
            }
            cachedDataset.sort((a, b) => a.dateTime - b.dateTime);
            mergedGaugeData[gaugeId] = cachedDataset;
        }

        dynamicUSGSCache.set(cacheKey, { lastFetchedMs: Date.now(), gaugeData: mergedGaugeData, gaugeNames: siteNameMap });
        enrichAndSet(mergedGaugeData, siteNameMap);

      } catch (err) {
        if (isMounted) console.error("Dynamic USGS Native Fetch Error:", err);
      }
    };

    const timeoutId = setTimeout(fetchUSGS, 300);

    return () => { 
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [river.id, river.gauges?.map(g => g.id).join(",")]);

  return liveRiver;
}
