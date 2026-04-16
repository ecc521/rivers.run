import { useState, useEffect, useMemo } from "react";
import type { RiverData, GaugeReading } from "../types/River";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";
import { FLOW_API_URL } from "../services/api";

const dynamicUSGSCache = new Map<string, { lastFetchedMs: number; gaugeData: Record<string, GaugeReading[]>; gaugeNames?: Record<string, string> }>();

export function useDynamicUSGS(river: RiverData) {
  // Store only the dynamic payload, not the whole river
  const [dynamicPayload, setDynamicPayload] = useState<{ gaugeData: Record<string, GaugeReading[]>; gaugeNames?: Record<string, string> } | null>(null);

  useEffect(() => {
    const usgsIDs = river.gauges?.filter(g => g.id.startsWith("USGS:")).map(g => g.id.replace("USGS:", "")) || [];
    const nwpsIDs = river.gauges?.filter(g => g.id.startsWith("NWS:")).map(g => g.id.replace("NWS:", "")) || [];
    if (usgsIDs.length === 0 && nwpsIDs.length === 0) return;

    const cacheKey = usgsIDs.join(",") + "|" + nwpsIDs.join(",");
    const cached = dynamicUSGSCache.get(cacheKey);

    const primaryGaugeID = river.gauges?.[0]?.id;
    const existingDatasetLength = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.length ? river.gaugeData[primaryGaugeID].length : 0;
    const existingFirstTime = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.[0]?.dateTime ? river.gaugeData[primaryGaugeID][0].dateTime : 0;
    const existingLastTime = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.[existingDatasetLength - 1]?.dateTime ? river.gaugeData[primaryGaugeID][existingDatasetLength - 1].dateTime : 0;

    const hasSevenDays = existingDatasetLength > 0 && 
       (existingLastTime - existingFirstTime >= 6.5 * 24 * 60 * 60 * 1000);
    
    // Fall back tightly to a 15 minute fetch constraint
    const newlyFetched = cached && (Date.now() - cached.lastFetchedMs < 15 * 60 * 1000);

    if (hasSevenDays && newlyFetched && cached) {
       setDynamicPayload({ gaugeData: cached.gaugeData, gaugeNames: cached.gaugeNames });
       return;
    }

    let isMounted = true;
    
    const fetchGauges = async () => {
      try {
        const gaugeDataMap: Record<string, Map<number, any>> = {};
        const siteNameMap: Record<string, string> = {};

        const allIds = [...usgsIDs.map(id => `USGS:${id}`), ...nwpsIDs.map(id => `NWS:${id}`)];
        if (allIds.length === 0) return;

        // Fetch from unified flow API
        const url = `${FLOW_API_URL}/history?gauges=${allIds.join(",")}&days=7`;
        const res = await fetch(url);
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Flow API error: ${res.status} ${errorText}`);
        }
        
        const data = await res.json();
        
        for (const [gaugeId, gaugeInfo] of Object.entries(data) as [string, any][]) {
            if (!gaugeDataMap[gaugeId]) gaugeDataMap[gaugeId] = new Map();
            
            if (gaugeInfo.name && !siteNameMap[gaugeId]) {
                siteNameMap[gaugeId] = gaugeInfo.section ? `${gaugeInfo.name} ${gaugeInfo.section}` : gaugeInfo.name;
            }

            if (gaugeInfo.readings) {
                for (const reading of gaugeInfo.readings) {
                    const ts = reading.dateTime;
                    gaugeDataMap[gaugeId].set(ts, { ...reading });
                }
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
        setDynamicPayload({ gaugeData: mergedGaugeData, gaugeNames: siteNameMap });

      } catch (err: unknown) {
        if (isMounted && err instanceof Error) console.error("Dynamic Gauge Fetch Error:", err.message);
      }
    };

    const timeoutId = setTimeout(fetchGauges, 300);

    return () => { 
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [river.id, river.gauges?.map(g => g.id).join(",")]);

  const enrichedRiver = useMemo(() => {
    if (!dynamicPayload) return null;
    
    // Create a fresh clone to apply synchronous enrichment
    const enriched = { ...river };
    enriched.gaugeData = { ...(enriched.gaugeData || {}), ...dynamicPayload.gaugeData };
    
    const names = dynamicPayload.gaugeNames;
    if (names && enriched.gauges) {
        enriched.gauges = enriched.gauges.map(g => {
            if (names[g.id]) return { ...g, name: names[g.id] };
            return g;
        });
    }
    
    const primaryGaugeID = enriched.gauges?.[0]?.id;
    const primaryData = primaryGaugeID && enriched.gaugeData[primaryGaugeID] ? enriched.gaugeData[primaryGaugeID] : null;
    
    let latest = null;
    if (primaryData && primaryData.length > 0) {
        for (let i = primaryData.length - 1; i >= 0; i--) {
            if (primaryData[i].cfs !== undefined || primaryData[i].ft !== undefined) {
                latest = primaryData[i];
                break;
            }
        }
    }

    if (latest) {
        // 2-hour relative staleness rule: (Fetch Time - Reading Time)
        // Since we just fetched this live, the "sync time" is effectively now.
        const ageInMs = Date.now() - latest.dateTime;
        enriched.isReadingStale = ageInMs > 2 * 60 * 60 * 1000;

        enriched.cfs = latest.cfs ?? enriched.cfs;
        const ftValue = latest.ft;
        enriched.ft = (ftValue !== undefined && !isNaN(ftValue)) ? ftValue : enriched.ft;
        enriched.running = calculateRelativeFlow(enriched) ?? enriched.running;
        
        if (enriched.cfs && enriched.ft) enriched.flowInfo = `${Math.round(enriched.cfs)}cfs, ${Math.round(enriched.ft * 100) / 100}ft`;
        else if (enriched.cfs) enriched.flowInfo = `${Math.round(enriched.cfs)}cfs`;
        else if (enriched.ft) enriched.flowInfo = `${Math.round(enriched.ft * 100) / 100}ft`;
    }
    
    return enriched;
  }, [river, dynamicPayload]);

  return enrichedRiver;
}
