import { useState, useEffect, useMemo } from "react";
import type { RiverData } from "../types/River";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";
import { fetchAPI, fetchFlowData } from "../services/api";
import { useSettings } from "../context/SettingsContext";
import { applyUnitSettings, applyUnitSettingsToReadings } from "../utils/unitConversions";

import { deriveRegionMap, type CountryCode, getCountryFromPrefix } from "../utils/regions";

interface UseRiversResult {
  rivers: RiverData[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  isGlobalStale: boolean;
  dataGeneratedAt: number | null;
  lastFetchTime: number | null;
  stateToCountryMap: Map<string, Set<CountryCode>> | null;
  availableStates: string[];
  refresh: () => Promise<void>;
}

// Global cache to prevent re-fetching on navigation between Home and Map
let globalRiversCache: RiverData[] | null = null;
let globalDataGeneratedAt: number | null = null;
let globalLastFetchTime: number | null = null;
let globalLoading = false;
let globalSyncing = false;
let globalError: string | null = null;
let globalStateToCountryMap: Map<string, Set<CountryCode>> | null = null;
let globalAvailableStates: string[] = [];
const fetchSubscribers: Set<() => void> = new Set();

const notifySubscribers = () => {
    fetchSubscribers.forEach(fn => fn());
};

const enrichRiver = (river: any, _index: number, flowData: any, settings: any) => {
  const primaryGauge = river.gauges?.find((g: any) => g.isPrimary) || river.gauges?.[0];
  const activeGaugeId = primaryGauge?.id;
  const gaugeRecord = activeGaugeId ? flowData[activeGaugeId] : null;

  const { flowUnits } = settings;

  river.gaugeData = {};

  if (river.gauges && Array.isArray(river.gauges)) {
      river.gauges.forEach((g: any) => {
          if (flowData[g.id]) {
              const flowName = String(flowData[g.id].name || '');
              if (flowName && !g.name) g.name = flowName;
              if (flowData[g.id].section && !g.section) g.section = String(flowData[g.id].section);
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

    // Fallback geographic data for gauges that might be missing it in the DB
    if (river.isGauge && activeGaugeId && flowData[activeGaugeId]) {
      if (!river.states && flowData[activeGaugeId].state) {
        river.states = flowData[activeGaugeId].state;
      }
      if (!river.countries) {
        river.countries = getCountryFromPrefix(activeGaugeId) || undefined;
      }
    }

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

   const lat = Array.isArray(gData.lat) ? gData.lat[0] : gData.lat;
   const lon = Array.isArray(gData.lon) ? gData.lon[0] : gData.lon;
   const finalLat = typeof lat === 'string' ? parseFloat(lat) : lat;
   const finalLon = typeof lon === 'string' ? parseFloat(lon) : lon;

   return {
       id: gaugeId,
       name: String(gData.name || gaugeId),
       section: String(gData.section || ""),
       states: gData.state || "",
       countries: getCountryFromPrefix(gaugeId) || undefined,
       gauges: [{ id: gaugeId, isPrimary: true, name: String(gData.name || gaugeId), section: String(gData.section || "") }],
       isGauge: true,
       isReadingStale: isStale,
       cfs: latest.cfs,
       ft: latest.ft,
       cms: latest.cms,
       m: latest.m,
       gaugeData: { [gaugeId]: gData.readings },
       flowInfo: flowStr,
       accessPoints: !isNaN(finalLat) && !isNaN(finalLon) ? [{lat: finalLat, lon: finalLon, name: "Gauge Marker", type: "other"}] : undefined,
       skill: "?" // Standalone gauges have no rated skill
   } as unknown as RiverData;
};

const BOOTSTRAP_KEY = "rivers_bootstrap_v1";

export const useRivers = (): UseRiversResult => {
  const [rivers, setRivers] = useState<RiverData[]>(globalRiversCache || []);
  const [loading, setLoading] = useState(globalRiversCache === null ? true : globalLoading);
  const [syncing, setSyncing] = useState(globalSyncing);
  const [error, setError] = useState<string | null>(globalError);
  const [dataGeneratedAt, setDataGeneratedAt] = useState<number | null>(globalDataGeneratedAt);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(globalLastFetchTime);
  const [availableStates, setAvailableStates] = useState<string[]>(globalAvailableStates);
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
                    
                    // Re-calculate derived region data on bootstrap
                    globalStateToCountryMap = deriveRegionMap(globalRiversCache!);
                    globalAvailableStates = Array.from(new Set(globalRiversCache!.flatMap(r => (r.states || "").split(/[ ,]+/).filter(Boolean).map(s => s.toUpperCase())))).sort((a, b) => a.localeCompare(b));

                    setRivers(globalRiversCache!);
                    setDataGeneratedAt(globalDataGeneratedAt);
                    setAvailableStates(globalAvailableStates);
                    setLoading(false);
                }
            } catch {
                console.warn("Failed to parse cached bootstrap data. Falling back to live fetch.");
            }
        }
    }

    // 5-minute heartbeat: re-calculate staleness banners and proactively refresh if the tab is
    // visible and data is > 15 min old. Skips when backgrounded — the visibility handler covers re-focus.
    const heartbeatId = setInterval(() => {
        setTick(t => t + 1);
        const isStale = globalDataGeneratedAt && (Date.now() - globalDataGeneratedAt > 15 * 60 * 1000);
        if (isStale && document.visibilityState === 'visible') fetchRivers(false);
    }, 5 * 60 * 1000);

    // Subscribe to global state changes
    const handleUpdate = () => {
        setRivers(globalRiversCache || []);
        setLoading(globalLoading);
        setSyncing(globalSyncing);
        setError(globalError);
        setDataGeneratedAt(globalDataGeneratedAt);
        setLastFetchTime(globalLastFetchTime);
        setAvailableStates(globalAvailableStates);
    };
    fetchSubscribers.add(handleUpdate);

    const fetchRivers = async (force = false) => {
      // Guard: Never fetch concurrently
      if (globalLoading || globalSyncing) return;

      const fetchIsRecent = globalLastFetchTime && (Date.now() - globalLastFetchTime < 15 * 60 * 1000);
      const serverDataFresh = !globalDataGeneratedAt || (Date.now() - globalDataGeneratedAt < 15 * 60 * 1000);
      if (!force && fetchIsRecent && serverDataFresh && globalRiversCache) {
          return;
      }
      
      if (globalRiversCache && globalRiversCache.length > 0) {
          globalSyncing = true;
      } else {
          globalLoading = true;
      }
      notifySubscribers();

      // Safety timeout to prevent permanently stuck loading state
      const timeoutId = setTimeout(() => {
          if (globalLoading && (!globalRiversCache || force)) {
              globalLoading = false;
              globalError = "Request timed out. Please try again or check your connection.";
              notifySubscribers();
          }
          if (globalSyncing) {
              globalSyncing = false;
              notifySubscribers();
          }
      }, 15000);

      try {
        const [data, flowData] = await Promise.all([
          fetchAPI("/rivers"),
          fetchFlowData().catch(e => {
            console.warn("Failed to fetch flow data, continuing with offline/placeholder state:", e);
            return null;
          })
        ]);
        
        let processedData = data;
        let genTime: number | null = null;

        // Enrichment
        if (flowData) {
          genTime = flowData.generatedAt || Date.now();
          processedData = data.map((river: any, index: number) => enrichRiver(river, index, flowData, settings));

          // Standalone gauges
          const standaloneGauges: RiverData[] = [];
          for (const [gaugeId, gaugeData] of Object.entries(flowData)) {
              if (gaugeId === "generatedAt") continue;
              const standaloneGauge = buildStandaloneGauge(gaugeId, gaugeData, settings);
              if (standaloneGauge) standaloneGauges.push(standaloneGauge);
          }
          processedData = [...processedData, ...standaloneGauges];
        }

        globalRiversCache = processedData;
        globalDataGeneratedAt = genTime;
        globalLastFetchTime = Date.now();
        
        // Re-calculate derived region data
        globalStateToCountryMap = deriveRegionMap(processedData);
        globalAvailableStates = (Array.from(new Set(processedData.flatMap((r: any) => (r.states || "").split(/[ ,]+/).filter(Boolean).map((s: string) => s.toUpperCase())))) as string[]).sort((a, b) => a.localeCompare(b));

        globalLoading = false;
        globalSyncing = false;

        // Persist to local storage for future bootstrap
        try {
            // Exclude standalone gauges from the bootstrap cache to stay under localStorage limits.
            // These aren't needed for the Home list and will be re-fetched/merged during the regular update flow.
            const strippedRivers = processedData
                .filter((r: any) => !r.isGauge) // Focus on rivers for Home screen performance; gauges load later
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
        globalSyncing = false;
        notifySubscribers();
      }
    };

    // Service Worker message listener (Workbox 7 uses client.postMessage, not BroadcastChannel)
    const handleSWMessage = (event: MessageEvent) => {
        if (event.data?.type === 'CACHE_UPDATED' &&
            event.data?.meta === 'workbox-broadcast-update' &&
            event.data?.payload?.cacheName === 'flow-data-cache-v2') {
            console.log("Service Worker broadcast: Fresh flow data available. Refreshing UI...");
            setTimeout(() => fetchRivers(true), 100);
        }
    };
    // eslint-disable-next-line compat/compat
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            const isStale = !globalRiversCache || (globalDataGeneratedAt && (Date.now() - globalDataGeneratedAt > 15 * 60 * 1000));
            if (isStale) {
                fetchRivers(false);
            }
        }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Also fetch when globalLastFetchTime is null: bootstrap data has writeup/aw stripped for size,
    // so a real API fetch is always needed to hydrate those fields even if the cached ts looks fresh.
    const isStaleOnMount = !globalRiversCache || !globalLastFetchTime || (globalDataGeneratedAt && (Date.now() - globalDataGeneratedAt > 15 * 60 * 1000));
    if (isStaleOnMount) {
        fetchRivers(false);
    }

    return () => {
        fetchSubscribers.delete(handleUpdate);
        clearInterval(heartbeatId);
        document.removeEventListener('visibilitychange', handleVisibility);
        // eslint-disable-next-line compat/compat
        navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  const refresh = async () => {
      globalLoading = false;
      globalError = null;
      globalRiversCache = null;
      window.location.reload();
  };

  return {
    rivers,
    loading,
    syncing,
    error,
    isGlobalStale,
    dataGeneratedAt,
    lastFetchTime,
    stateToCountryMap: globalStateToCountryMap,
    availableStates,
    refresh
  };
};
