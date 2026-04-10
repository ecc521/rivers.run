import { useState, useEffect } from "react";
import type { RiverData } from "../types/River";
import { getStorageUrl } from "../utils/storageUrls";
import { calculateRelativeFlow } from "../utils/flowInfoCalculations";

interface UseRiversResult {
  rivers: RiverData[];
  loading: boolean;
  error: string | null;
}

// Global cache to prevent re-fetching on navigation between Home and Map
let globalRiversCache: RiverData[] | null = null;
let globalLoading = false;
let globalError: string | null = null;
const fetchSubscribers: Set<() => void> = new Set();

const notifySubscribers = () => {
    fetchSubscribers.forEach(fn => fn());
};

const enrichRiver = (river: any, _index: number, flowData: any, usedGauges: Set<string>) => {
  const activeGaugeId = river.gauges?.[0]?.id;

  if (activeGaugeId) {
      usedGauges.add(activeGaugeId);
  }

  const gaugeRecord = activeGaugeId ? flowData[activeGaugeId] : null;
  if (gaugeRecord && gaugeRecord.readings && gaugeRecord.readings.length > 0) {
    const latest = gaugeRecord.readings[gaugeRecord.readings.length - 1];
    river.cfs = latest.cfs;
    river.ft = latest.ft || latest.feet; // Bridge during transition if needed, though plan says drop
    river.flowData = gaugeRecord.readings;

    river.running = calculateRelativeFlow(river) ?? undefined;

    if (river.cfs && river.ft)
      river.flow = `${Math.round(river.cfs)} cfs ${Math.round(river.ft * 100) / 100} ft`;
    else if (river.cfs) river.flow = `${Math.round(river.cfs)} cfs`;
    else if (river.ft)
      river.flow = `${Math.round(river.ft * 100) / 100} ft`;
  }
  return river;
};

const buildVirtualGauge = (gaugeId: string, gaugeData: any): RiverData | null => {
   const gData: any = gaugeData;
   if (!gData.readings || gData.readings.length === 0) return null;

   const latest = gData.readings[gData.readings.length - 1];
   const ftValue = latest.ft || latest.feet;
   let flowStr = "";
   if (latest.cfs && ftValue) flowStr = `${Math.round(latest.cfs)} cfs ${Math.round(ftValue * 100) / 100} ft`;
   else if (latest.cfs) flowStr = `${Math.round(latest.cfs)} cfs`;
   else if (ftValue) flowStr = `${Math.round(ftValue * 100) / 100} ft`;

   return {
       id: gaugeId,
       name: gData.name || gaugeId,
       gauges: [{ id: gaugeId, isPrimary: true }],
       isGauge: true,
       cfs: latest.cfs,
       ft: ftValue,
       flowData: gData.readings,
       flow: flowStr,
       accessPoints: gData.lat && gData.lon ? [{lat: gData.lat, lon: gData.lon, name: "Gauge Marker", type: "other"}] : undefined
   } as unknown as RiverData;
};

export const useRivers = (): UseRiversResult => {
  const [rivers, setRivers] = useState<RiverData[]>(globalRiversCache || []);
  const [loading, setLoading] = useState(globalRiversCache === null ? true : globalLoading);
  const [error, setError] = useState<string | null>(globalError);

  useEffect(() => {
    // Subscribe to global state changes
    const handleUpdate = () => {
        setRivers(globalRiversCache || []);
        setLoading(globalLoading);
        setError(globalError);
    };
    fetchSubscribers.add(handleUpdate);

    const fetchRivers = async () => {
      // If we already have data, or are already fetching, don't duplicate work
      if (globalRiversCache || globalLoading) {
          return;
      }
      
      globalLoading = true;
      notifySubscribers();

      try {
        const riverDataUrl = getStorageUrl("public/rivers.json");
        const flowDataUrl = getStorageUrl("public/gauges.json");

        const [riverRes, flowRes] = await Promise.all([
          fetch(riverDataUrl),
          fetch(flowDataUrl),
        ]);

        if (!riverRes.ok || !riverRes.headers.get("content-type")?.includes("json")) {
           throw new Error("Failed to fetch valid river data JSON");
        }
        let data: RiverData[] = await riverRes.json();

        // If flow data is ok, enrich the rivers
        if (flowRes.ok && flowRes.headers.get("content-type")?.includes("json")) {
          const flowData = await flowRes.json();
          const usedGauges = new Set<string>();

          data = data.map((river: any, index: number) => enrichRiver(river, index, flowData, usedGauges));

          // Create virtual rivers for any gauge present in gauges.json that isn't mapped to a river
          const virtualGauges: RiverData[] = [];

          for (const [gaugeId, gaugeData] of Object.entries(flowData)) {
              if (usedGauges.has(gaugeId)) continue;
              const virtualGauge = buildVirtualGauge(gaugeId, gaugeData);
              if (virtualGauge) {
                 virtualGauges.push(virtualGauge);
              }
          }
          
          data = [...data, ...virtualGauges];
        }

        globalRiversCache = data;
        globalLoading = false;
        notifySubscribers();

      } catch (err: any) {
        globalError = err.message || "An error occurred";
        globalLoading = false;
        notifySubscribers();
      }
    };

    fetchRivers();

    return () => {
        fetchSubscribers.delete(handleUpdate);
    };
  }, []);

  return { rivers, loading, error };
};
