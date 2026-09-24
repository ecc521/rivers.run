import { useState, useEffect, useMemo } from "react";
import type { RiverData, GaugeReading } from "../types/River";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";
import { FLOW_API_URL } from "../services/api";
import { useSettings } from "../context/SettingsContext";
import { applyUnitSettingsToReadings } from "../utils/unitConversions";
import { planHistoryRequest, seedFromCache, trimToWindow } from "../utils/flowDelta";
import { fetchModelForecasts, mergeModelForecast, type ModelForecast } from "../utils/modelForecast";

const dynamicFlowCache = new Map<string, {
  lastFetchedMs: number;
  gaugeData: Record<string, GaugeReading[]>;
  gaugeNames?: Record<string, { name: string; section?: string }>;
  modelForecasts?: Record<string, ModelForecast>;
}>();
const activeFetches = new Set<string>();


/**
 * useDynamicFlow
 * Fetches 7 days of historical flow data + forecasts on-demand for all gauge providers.
 * Used primarily for the "Search Discovery" detailed view and River Details page.
 */
export function useDynamicFlow(river: RiverData, dataGeneratedAt?: number | null, skipFetch?: boolean) {
  const [dynamicPayload, setDynamicPayload] = useState<{
    gaugeData: Record<string, GaugeReading[]>;
    gaugeNames?: Record<string, { name: string; section?: string }>;
    modelForecasts?: Record<string, ModelForecast>;
  } | null>(null);
  const settings = useSettings();

  useEffect(() => {
    if (skipFetch) return;
    if (!river.gauges || river.gauges.length === 0) return;

    const allGauges = river.gauges.map(g => g.id);
    const cacheKey = [...allGauges].sort((a, b) => a.localeCompare(b)).join(",");
    const cached = dynamicFlowCache.get(cacheKey);

    const primaryGaugeID = river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id;
    const existingDatasetLength = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.length ? river.gaugeData[primaryGaugeID].length : 0;
    const existingFirstTime = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.[0]?.dateTime ? river.gaugeData[primaryGaugeID][0].dateTime : 0;
    const existingLastTime = primaryGaugeID && river.gaugeData?.[primaryGaugeID]?.[existingDatasetLength - 1]?.dateTime ? river.gaugeData[primaryGaugeID][existingDatasetLength - 1].dateTime : 0;

    // We consider the data "fresh enough" if it covers at least 27.5 days and was fetched in the last 15 mins
    const hasThirtyDays = existingDatasetLength > 0 && 
       (existingLastTime - existingFirstTime >= 27.5 * 24 * 60 * 60 * 1000);
    
    const newlyFetched = cached && (Date.now() - cached.lastFetchedMs < 15 * 60 * 1000);

    if (hasThirtyDays && newlyFetched && cached) {
       if (!dynamicPayload || dynamicPayload.gaugeData !== cached.gaugeData || dynamicPayload.gaugeNames !== cached.gaugeNames || dynamicPayload.modelForecasts !== cached.modelForecasts) {
           setDynamicPayload({ gaugeData: cached.gaugeData, gaugeNames: cached.gaugeNames, modelForecasts: cached.modelForecasts });
       }
       return;
    }

    if (activeFetches.has(cacheKey)) {
       return;
    }

    let isMounted = true;
    
    const fetchGauges = async () => {
      if (activeFetches.has(cacheKey)) return;
      activeFetches.add(cacheKey);
      try {
        const gaugeDataMap: Record<string, Map<number, any>> = {};
        const siteNameMap: Record<string, { name: string; section?: string }> = {};

        if (allGauges.length === 0) return;

        // With a recent window cached, ask only for what landed since (with
        // an overlap). Planned from the cached payload, not river.gaugeData,
        // which can be a 3h slice out of sitedata.json.
        const cachedForDelta = dynamicFlowCache.get(cacheKey);
        const { params, resumeFrom } = planHistoryRequest(allGauges, cachedForDelta);

        // Model forecasts load alongside /history and never throw.
        let modelForecasts = cachedForDelta?.modelForecasts;
        const forecastPromise = fetchModelForecasts(FLOW_API_URL, allGauges, modelForecasts);

        const res = await fetch(`${FLOW_API_URL}/history?${params}`);

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Flow API error: ${res.status} ${errorText}`);
        }

        const data = await res.json();

        // A delta response only carries new readings, so seed the merge map
        // (and names) with what we already had or the chart would lose them.
        if (resumeFrom > 0 && cachedForDelta) {
            seedFromCache(gaugeDataMap, cachedForDelta.gaugeData);
            Object.assign(siteNameMap, cachedForDelta.gaugeNames ?? {});
        }
        
        for (const [gaugeId, gaugeInfo] of Object.entries(data) as [string, any][]) {
            if (!gaugeDataMap[gaugeId]) gaugeDataMap[gaugeId] = new Map();
            
            if (gaugeInfo.name) {
                siteNameMap[gaugeId] = { name: gaugeInfo.name, section: gaugeInfo.section };
            }

            if (gaugeInfo.readings) {
                for (const reading of gaugeInfo.readings) {
                    const ts = reading.dateTime;
                    gaugeDataMap[gaugeId].set(ts, { ...reading });
                }
            }
        }

        if (!isMounted) return;

        // Helper to perform initial render
        const updatePayload = () => {
            const mergedGaugeData: Record<string, GaugeReading[]> = {};
            for (const [gaugeId, map] of Object.entries(gaugeDataMap)) {
                const cachedDataset = river.gaugeData?.[gaugeId] || [];
                
                // Merge backwards so cache doesn't overwrite live flow data
                for (let i = 0; i < cachedDataset.length; i++) {
                    const cachedItem = cachedDataset[i];
                    const existingLive = map.get(cachedItem.dateTime);
                    
                    if (existingLive) {
                        map.set(cachedItem.dateTime, { ...cachedItem, ...existingLive });
                    } else {
                        map.set(cachedItem.dateTime, cachedItem);
                    }
                }
                
                const mergedSorted = Array.from(map.values()).sort((a, b) => a.dateTime - b.dateTime);
                mergedGaugeData[gaugeId] = trimToWindow(mergedSorted as GaugeReading[]);
            }

            dynamicFlowCache.set(cacheKey, { lastFetchedMs: Date.now(), gaugeData: mergedGaugeData, gaugeNames: siteNameMap, modelForecasts });
            setDynamicPayload({ gaugeData: mergedGaugeData, gaugeNames: siteNameMap, modelForecasts });
        };

        // Render historical data instantly!
        updatePayload();

        // Swap in the forecasts without rebuilding (and re-animating) the readings.
        modelForecasts = await forecastPromise;
        const entry = dynamicFlowCache.get(cacheKey);
        if (entry) dynamicFlowCache.set(cacheKey, { ...entry, modelForecasts });
        if (isMounted) setDynamicPayload(prev => prev && { ...prev, modelForecasts });

      } catch (err: unknown) {
        if (isMounted && err instanceof Error) console.error("Dynamic Gauge Fetch Error:", err.message);
      } finally {
        activeFetches.delete(cacheKey);
      }
    };

    const timeoutId = setTimeout(fetchGauges, 300);

    return () => { 
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [river.id, river.gauges?.map(g => g.id).join(",") ?? "", skipFetch]);

  const enrichedRiver = useMemo(() => {
    if (skipFetch) return river;
    if (!dynamicPayload) return null;
    
    const enriched = { ...river };
    const convertedGaugeData: Record<string, GaugeReading[]> = {};
    const forecasts = dynamicPayload.modelForecasts ?? {};
    for (const [gaugeId, readings] of Object.entries(dynamicPayload.gaugeData)) {
        convertedGaugeData[gaugeId] = mergeModelForecast(
            applyUnitSettingsToReadings(readings, settings), forecasts[gaugeId], settings?.flowUnits);
    }
    enriched.gaugeData = { ...(enriched.gaugeData || {}), ...convertedGaugeData };
    enriched.modelForecasts = Object.fromEntries(Object.entries(forecasts)
        .filter(([gaugeId]) => dynamicPayload.gaugeData[gaugeId])
        .map(([gaugeId, f]) => [gaugeId, { issueTime: f.issueTime, reliability: f.reliability }]));
    
    const names = dynamicPayload.gaugeNames;
    if (names && enriched.gauges) {
        enriched.gauges = enriched.gauges.map(g => {
            const info = names[g.id];
            if (!info) return g;
            return {
                ...g,
                name: g.name || info.name, // DB-curated names take priority
                ...(!g.section && info.section ? { section: info.section } : {}),
            };
        });
    }
    
    const primaryGaugeID = enriched.gauges?.find((g: any) => g.isPrimary)?.id || enriched.gauges?.[0]?.id;
    const primaryData = primaryGaugeID && enriched.gaugeData[primaryGaugeID] ? enriched.gaugeData[primaryGaugeID] : null;
    
    let latest = null;
    if (primaryData && primaryData.length > 0) {
        for (let i = primaryData.length - 1; i >= 0; i--) {
            if (!primaryData[i].forecast && (primaryData[i].cfs !== undefined || primaryData[i].ft !== undefined || primaryData[i].cms !== undefined || primaryData[i].m !== undefined)) {
                latest = primaryData[i];
                break;
            }
        }
    }

    if (latest) {
        const ageInMs = (dataGeneratedAt || Date.now()) - latest.dateTime;
        enriched.isReadingStale = ageInMs > 2 * 60 * 60 * 1000;

        enriched.cfs = latest.cfs ?? enriched.cfs;
        const ftValue = latest.ft;
        enriched.ft = (ftValue !== undefined && !isNaN(ftValue)) ? ftValue : enriched.ft;
        
        enriched.cms = latest.cms ?? enriched.cms;
        const mValue = latest.m;
        enriched.m = (mValue !== undefined && !isNaN(mValue)) ? mValue : enriched.m;
        
        enriched.running = calculateRelativeFlow(enriched) ?? enriched.running;
        
        const showMetric = settings?.flowUnits === "metric" || (settings?.flowUnits === "default" && latest.cms !== undefined && latest.cfs === undefined);
        
        if (showMetric) {
            if (enriched.cms !== undefined && enriched.m !== undefined) enriched.flowInfo = `${Math.round(enriched.cms)}cms, ${Math.round(enriched.m * 100) / 100}m`;
            else if (enriched.cms !== undefined) enriched.flowInfo = `${Math.round(enriched.cms)}cms`;
            else if (enriched.m !== undefined) enriched.flowInfo = `${Math.round(enriched.m * 100) / 100}m`;
        } else {
            if (enriched.cfs !== undefined && enriched.ft !== undefined) enriched.flowInfo = `${Math.round(enriched.cfs)}cfs, ${Math.round(enriched.ft * 100) / 100}ft`;
            else if (enriched.cfs !== undefined) enriched.flowInfo = `${Math.round(enriched.cfs)}cfs`;
            else if (enriched.ft !== undefined) enriched.flowInfo = `${Math.round(enriched.ft * 100) / 100}ft`;
        }
    }
    
    return enriched;
  }, [river, dynamicPayload, dataGeneratedAt, settings?.flowUnits, settings?.tempUnits, settings?.precipUnits, skipFetch]);

  return enrichedRiver;
}
