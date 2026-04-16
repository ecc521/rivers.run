import { useState, useEffect, useMemo } from "react";
import type { RiverData } from "../types/River";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";
import { fetchAPI, fetchFlowData } from "../services/api";
import { useSettings } from "../context/SettingsContext";
import { applyUnitSettings, applyUnitSettingsToReadings } from "../utils/unitConversions";

interface UseRiversResult {
  rivers: RiverData[];
  loading: boolean;
  error: string | null;
  isGlobalStale: boolean;
  dataGeneratedAt: number | null;
  lastFetchTime: number | null;
  refresh: () => Promise<void>;
}

// Global cache to prevent re-fetching on navigation between Home and Map
let globalRiversCache: RiverData[] | null = null;
let globalDataGeneratedAt: number | null = null;
let globalLastFetchTime: number | null = null;
let globalLoading = false;
let globalError: string | null = null;
const fetchSubscribers: Set<() => void> = new Set();

const notifySubscribers = () => {
    fetchSubscribers.forEach(fn => fn());
};

const enrichRiver = (river: any, _index: number, flowData: any, settings: any) => {
  const activeGaugeId = river.gauges?.[0]?.id;
  const gaugeRecord = activeGaugeId ? flowData[activeGaugeId] : null;

  const { flowUnits } = settings;

  river.gaugeData = {};

  if (river.gauges && Array.isArray(river.gauges)) {
      river.gauges.forEach((g: any) => {
          if (flowData[g.id]) {
              if (flowData[g.id].name) g.name = String(flowData[g.id].name);
              if (flowData[g.id].section) g.section = String(flowData[g.id].section);
              if (flowData[g.id].readings) {
                  river.gaugeData![g.id] = applyUnitSettingsToReadings(flowData[g.id].readings, settings);
              }
          }
      });
  }

  if (gaugeRecord && gaugeRecord.readings && gaugeRecord.readings.length > 0) {
    const rawLatest = gaugeRecord.readings[gaugeRecord.readings.length - 1];
    
    // 2-hour relative staleness rule: Reading must be within 2 hours of the sync generation
    const readingAgeFromSync = (flowData.generatedAt || Date.now()) - rawLatest.dateTime;
    if (readingAgeFromSync > 2 * 60 * 60 * 1000) {
        river.isReadingStale = true;
    }

    const latest = applyUnitSettings(rawLatest, settings);
    
    river.cfs = latest.cfs;
    river.ft = latest.ft;

    river.m = latest.m;
    river.cms = latest.cms;

    river.running = calculateRelativeFlow(river);

    // Build specialized flowInfo based on user preferences
    const showMetric = flowUnits === "metric" || (flowUnits === "default" && latest.cms !== undefined && latest.cfs === undefined);
    
    if (showMetric) {
        if (latest.cms !== undefined && latest.m !== undefined)
            river.flowInfo = `${Math.round(latest.cms)}cms, ${Math.round(latest.m * 100) / 100}m`;
        else if (latest.cms !== undefined) river.flowInfo = `${Math.round(latest.cms)}cms`;
        else if (latest.m !== undefined) river.flowInfo = `${Math.round(latest.m * 100) / 100}m`;
    } else {
        if (latest.cfs !== undefined && latest.ft !== undefined)
            river.flowInfo = `${Math.round(latest.cfs)}cfs, ${Math.round(latest.ft * 100) / 100}ft`;
        else if (latest.cfs !== undefined) river.flowInfo = `${Math.round(latest.cfs)}cfs`;
        else if (latest.ft !== undefined) river.flowInfo = `${Math.round(latest.ft * 100) / 100}ft`;
    }
  }
  return river;
};

const buildStandaloneGauge = (gaugeId: string, gaugeData: any, settings: any): RiverData | null => {
   const gData: any = gaugeData;
   if (!gData.readings || gData.readings.length === 0) return null;

   const rawLatest = gData.readings[gData.readings.length - 1];

   // 2-hour relative staleness rule
   const readingAgeFromSync = (gaugeData.generatedAt || Date.now()) - rawLatest.dateTime;
   const isStale = readingAgeFromSync > 2 * 60 * 60 * 1000;

   const latest = applyUnitSettings(rawLatest, settings);
   const { flowUnits } = settings;
   let flowStr = "";
   const showMetric = flowUnits === "metric" || (flowUnits === "default" && latest.cms !== undefined && latest.cfs === undefined);
   
   if (showMetric) {
      if (latest.cms !== undefined && latest.m !== undefined) flowStr = `${Math.round(latest.cms)}cms, ${Math.round(latest.m * 100) / 100}m`;
      else if (latest.cms !== undefined) flowStr = `${Math.round(latest.cms)}cms`;
      else if (latest.m !== undefined) flowStr = `${Math.round(latest.m * 100) / 100}m`;
   } else {
      if (latest.cfs !== undefined && latest.ft !== undefined) flowStr = `${Math.round(latest.cfs)}cfs, ${Math.round(latest.ft * 100) / 100}ft`;
      else if (latest.cfs !== undefined) flowStr = `${Math.round(latest.cfs)}cfs`;
      else if (latest.ft !== undefined) flowStr = `${Math.round(latest.ft * 100) / 100}ft`;
   }

   return {
       id: gaugeId,
       name: String(gData.name || gaugeId),
       section: String(gData.section || ""),
       gauges: [{ id: gaugeId, isPrimary: true, name: String(gData.name || gaugeId), section: String(gData.section || "") }],
       isGauge: true,
       isReadingStale: isStale,
       cfs: latest.cfs,
       ft: latest.ft,
       cms: latest.cms,
       m: latest.m,
       gaugeData: { [gaugeId]: gData.readings },
       flowInfo: flowStr,
       accessPoints: gData.lat && gData.lon ? [{lat: gData.lat, lon: gData.lon, name: "Gauge Marker", type: "other"}] : undefined,
       skill: "?" // Standalone gauges have no rated skill
   } as unknown as RiverData;
};

const BOOTSTRAP_KEY = "rivers_bootstrap_v1";

export const useRivers = (): UseRiversResult => {
  const [rivers, setRivers] = useState<RiverData[]>(globalRiversCache || []);
  const [loading, setLoading] = useState(globalRiversCache === null ? true : globalLoading);
  const [error, setError] = useState<string | null>(globalError);
  const [dataGeneratedAt, setDataGeneratedAt] = useState<number | null>(globalDataGeneratedAt);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(globalLastFetchTime);
  const [tick, setTick] = useState(0); // 5-minute heartbeat trigger
  const settings = useSettings();

  const isGlobalStale = useMemo(() => {
    // Re-evaluate on every heartbeat tick
    if (!dataGeneratedAt) return false;
    return (Date.now() - dataGeneratedAt) > 60 * 60 * 1000; // 1 hour
  }, [dataGeneratedAt, tick]);

  useEffect(() => {
    // Attempt bootstrap from localStorage if global cache is empty
    if (!globalRiversCache) {
        const cached = localStorage.getItem(BOOTSTRAP_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.rivers && parsed.ts) {
                    globalRiversCache = parsed.rivers;
                    globalDataGeneratedAt = parsed.ts;
                    setRivers(globalRiversCache!);
                    setDataGeneratedAt(globalDataGeneratedAt);
                    setLoading(false);
                }
            } catch {
                console.warn("Failed to parse cached bootstrap data. Falling back to live fetch.");
            }
        }
    }

    // 5-minute heartbeat to re-calculate staleness banners
    const heartbeatId = setInterval(() => {
        setTick(t => t + 1);
    }, 5 * 60 * 1000);

    // Subscribe to global state changes
    const handleUpdate = () => {
        setRivers(globalRiversCache || []);
        setLoading(globalLoading);
        setError(globalError);
        setDataGeneratedAt(globalDataGeneratedAt);
        setLastFetchTime(globalLastFetchTime);
    };
    fetchSubscribers.add(handleUpdate);

    const fetchRivers = async (force = false) => {
      // If we already have fresh data (less than 15 mins old), or are already fetching, skip
      const isFresh = globalLastFetchTime && (Date.now() - globalLastFetchTime < 15 * 60 * 1000);
      if (!force && isFresh && (globalRiversCache || globalLoading)) {
          return;
      }
      
      globalLoading = true;
      notifySubscribers();

      // Safety timeout to prevent permanently stuck loading state
      const timeoutId = setTimeout(() => {
          if (globalLoading && (!globalRiversCache || force)) {
              globalLoading = false;
              globalError = "Request timed out. Please try again or check your connection.";
              notifySubscribers();
          }
      }, 15000);

      try {
        const [data, flowData] = await Promise.all([
          fetchAPI("/rivers"),
          fetchFlowData()
        ]);
        
        let processedData = data;
        let genTime: number | null = null;

        // Enrich the rivers with flow data
        if (flowData) {
          genTime = flowData.generatedAt || Date.now();
          processedData = data.map((river: any, index: number) => enrichRiver(river, index, flowData, settings));

          // Create standalone gauges for any gauge present in flow data
          const standaloneGauges: RiverData[] = [];

          for (const [gaugeId, gaugeData] of Object.entries(flowData)) {
              if (gaugeId === "generatedAt") continue;
              const standaloneGauge = buildStandaloneGauge(gaugeId, gaugeData, settings);
              if (standaloneGauge) {
                 standaloneGauges.push(standaloneGauge);
              }
          }
          
          processedData = [...processedData, ...standaloneGauges];
        }

        globalRiversCache = processedData;
        globalDataGeneratedAt = genTime;
        globalLastFetchTime = Date.now();
        globalLoading = false;

        // Persist to local storage for future bootstrap
        try {
            // Strip heavy fields, descriptions to keep boot storage ultralight
            // We now KEEP standalone gauges but ensure they are minimal skeleton records
            const strippedRivers = processedData
                .map((r: any) => {
                    const skeletonValues = { ...r };
                    delete (skeletonValues as any).gaugeData;
                    delete (skeletonValues as any).writeup;
                    delete (skeletonValues as any).aw;
                    return skeletonValues;
                });
            localStorage.setItem(BOOTSTRAP_KEY, JSON.stringify({ rivers: strippedRivers, ts: genTime }));
        } catch (error) {
            console.warn("Storage quota exceeded or error caching bootstrap data", error);
        }

        clearTimeout(timeoutId);
        notifySubscribers();

      } catch (err: unknown) {
        clearTimeout(timeoutId);
        globalError = err instanceof Error ? err.message : "An error occurred";
        globalLoading = false;
        notifySubscribers();
      }
    };

    // Service Worker Broadcast Listener
    // Triggered when StaleWhileRevalidate finds fresh data in the background
    const updateChannel = new BroadcastChannel('flow-data-updates');
    updateChannel.onmessage = (_event) => {
        console.log("Service Worker broadcast: Fresh flow data available. Refreshing UI...");
        // Re-fetch with force=true to pull fresh data from the updated cache
        // We add a tiny delay to ensure the SW has finished writing to cache
        setTimeout(() => fetchRivers(true), 100);
    };

    // Auto-fetch on refocus/visibility if data is > 15 mins old
    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            fetchRivers();
        }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    fetchRivers();

    return () => {
        fetchSubscribers.delete(handleUpdate);
        clearInterval(heartbeatId);
        document.removeEventListener('visibilitychange', handleVisibility);
        updateChannel.close();
    };
  }, []);

  const refresh = async () => {
      globalLoading = false;
      globalError = null;
      globalRiversCache = null;
      // We don't use the inner fetchRivers because of useEffect closure, but navigation or mount will trigger it.
      // Or we can manually trigger it here if we expose it.
      window.location.reload(); // Simplest "Update" button implementation for now
  };

  return { rivers, loading, error, isGlobalStale, dataGeneratedAt, lastFetchTime, refresh };
};
