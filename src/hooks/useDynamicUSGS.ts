import { useState, useEffect } from "react";
import type { RiverData } from "../types/River";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";

const dynamicUSGSCache = new Map<string, { lastFetchedMs: number; data: any[] }>();

export function useDynamicUSGS(river: RiverData) {
  const [liveRiver, setLiveRiver] = useState<RiverData | null>(null);

  useEffect(() => {
    // Only attempt fetch if USGS gauges exist
    const usgsIDs = river.gauges?.filter(g => g.id.startsWith("USGS:")).map(g => g.id.replace("USGS:", "")) || [];
    if (usgsIDs.length === 0) return;

    const cacheKey = usgsIDs.join(",");
    const cached = dynamicUSGSCache.get(cacheKey);

    const existingData = cached?.data || river.flowData || [];
    const hasThreeDays = existingData.length > 0 && 
       (existingData[existingData.length - 1].dateTime - existingData[0].dateTime >= 2.5 * 24 * 60 * 60 * 1000);
    
    // Fall back tightly to a 15 minute fetch constraint
    const newlyFetched = cached && (Date.now() - cached.lastFetchedMs < 15 * 60 * 1000);

    const enrichAndSet = (data: any[]) => {
       const latest = data[data.length - 1];
       
       // Mutate globally so parent 'RiverItem' automatically adopts the new preview natively without prop bubbling
       river.flowData = data;
       river.cfs = latest.cfs;
       const ftValue = latest.ft || latest.feet;
       river.ft = isNaN(ftValue) ? undefined : ftValue;
       river.running = calculateRelativeFlow(river) ?? undefined;
       
       if (river.cfs && river.ft) river.flow = `${Math.round(river.cfs)} cfs ${Math.round(river.ft * 100) / 100} ft`;
       else if (river.cfs) river.flow = `${Math.round(river.cfs)} cfs`;
       else if (river.ft) river.flow = `${Math.round(river.ft * 100) / 100} ft`;
       
       setLiveRiver({ ...river });
    };

    if (hasThreeDays && newlyFetched && cached) {
       enrichAndSet(cached.data);
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
        const readingsMap = new Map<number, any>();

        for (const seriesItem of timeSeries) {
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
                    const existing = readingsMap.get(ts) || { dateTime: ts };
                    existing[property] = Number(val.value);
                    readingsMap.set(ts, existing);
                });
            }
        }

        if (!isMounted) return;

        // Compile and sort the live readings natively
        const sortedLive = Array.from(readingsMap.values()).sort((a, b) => a.dateTime - b.dateTime);
        if (sortedLive.length === 0) return;

        // Splice seamlessly with our 15-minute cached `flowData` from Firebase!
        const mergedData = [...(river.flowData || [])];
        
        for (const liveReading of sortedLive) {
            const matchIndex = mergedData.findIndex(item => item.dateTime === liveReading.dateTime);
            if (matchIndex >= 0) {
               // Update completely precisely inline (e.g. if the cache was missing parameter values)
               mergedData[matchIndex] = { ...mergedData[matchIndex], ...liveReading };
            } else {
               mergedData.push(liveReading);
            }
        }
        
        // Final resort
        mergedData.sort((a, b) => a.dateTime - b.dateTime);
        dynamicUSGSCache.set(cacheKey, { lastFetchedMs: Date.now(), data: mergedData });
        enrichAndSet(mergedData);

      } catch (err) {
        console.error("Dynamic USGS Native Fetch Error:", err);
      }
    };

    fetchUSGS();

    return () => { isMounted = false; };
  }, [river.gauges, river.flowData]);

  return liveRiver;
}
