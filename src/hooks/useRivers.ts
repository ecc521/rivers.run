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

const enrichRiver = (river: any, _index: number, flowData: any) => {
  const activeGaugeId = river.gauges?.[0]?.id;

  const gaugeRecord = activeGaugeId ? flowData[activeGaugeId] : null;

  river.gaugeData = {};

  if (river.gauges && Array.isArray(river.gauges)) {
      river.gauges.forEach((g: any) => {
          if (flowData[g.id]) {
              if (flowData[g.id].name) g.name = flowData[g.id].name;
              if (flowData[g.id].section) g.section = flowData[g.id].section;
              if (flowData[g.id].readings) {
                  river.gaugeData![g.id] = flowData[g.id].readings;
              }
          }
      });
  }

  if (gaugeRecord && gaugeRecord.readings && gaugeRecord.readings.length > 0) {
    const latest = gaugeRecord.readings[gaugeRecord.readings.length - 1];
    river.cfs = latest.cfs;
    river.ft = latest.ft || latest.feet; // Bridge during transition if needed, though plan says drop

    river.m = latest.m;
    river.cms = latest.cms;

    river.running = calculateRelativeFlow(river) ?? undefined;

    const mValue = latest.m;
    const cmsValue = latest.cms;
    const ftValue = latest.ft || latest.feet;
    const cfsValue = latest.cfs;

    if (cmsValue !== undefined && mValue !== undefined)
      river.flowInfo = `${Math.round(cmsValue)} cms ${Math.round(mValue * 100) / 100} m`;
    else if (cmsValue !== undefined) river.flowInfo = `${Math.round(cmsValue)} cms`;
    else if (mValue !== undefined) river.flowInfo = `${Math.round(mValue * 100) / 100} m`;
    else if (cfsValue !== undefined && ftValue !== undefined)
      river.flowInfo = `${Math.round(cfsValue)} cfs ${Math.round(ftValue * 100) / 100} ft`;
    else if (cfsValue !== undefined) river.flowInfo = `${Math.round(cfsValue)} cfs`;
    else if (ftValue !== undefined)
      river.flowInfo = `${Math.round(ftValue * 100) / 100} ft`;
  }
  return river;
};

const buildStandaloneGauge = (gaugeId: string, gaugeData: any): RiverData | null => {
   const gData: any = gaugeData;
   if (!gData.readings || gData.readings.length === 0) return null;

   const latest = gData.readings[gData.readings.length - 1];
   const mValue = latest.m;
   const cmsValue = latest.cms;
   const ftValue = latest.ft || latest.feet;
   const cfsValue = latest.cfs;

   let flowStr = "";
   if (cmsValue !== undefined && mValue !== undefined) flowStr = `${Math.round(cmsValue)} cms ${Math.round(mValue * 100) / 100} m`;
   else if (cmsValue !== undefined) flowStr = `${Math.round(cmsValue)} cms`;
   else if (mValue !== undefined) flowStr = `${Math.round(mValue * 100) / 100} m`;
   else if (cfsValue !== undefined && ftValue !== undefined) flowStr = `${Math.round(cfsValue)} cfs ${Math.round(ftValue * 100) / 100} ft`;
   else if (cfsValue !== undefined) flowStr = `${Math.round(cfsValue)} cfs`;
   else if (ftValue !== undefined) flowStr = `${Math.round(ftValue * 100) / 100} ft`;

   return {
       id: gaugeId,
       name: gData.name || gaugeId,
       section: gData.section || "",
       gauges: [{ id: gaugeId, isPrimary: true, name: gData.name || gaugeId, section: gData.section || "" }],
       isGauge: true,
       cfs: cfsValue,
       ft: ftValue,
       cms: cmsValue,
       m: mValue,
       gaugeData: { [gaugeId]: gData.readings },
       flowInfo: flowStr,
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

      // Safety timeout to prevent permanently stuck loading state
      const timeoutId = setTimeout(() => {
          if (globalLoading && !globalRiversCache) {
              globalLoading = false;
              globalError = "Request timed out. Please try again or check your connection.";
              notifySubscribers();
          }
      }, 15000);

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
          data = data.map((river: any, index: number) => enrichRiver(river, index, flowData));

          // Create standalone gauges for any gauge present in gauges.json
          const standaloneGauges: RiverData[] = [];

          for (const [gaugeId, gaugeData] of Object.entries(flowData)) {
              const standaloneGauge = buildStandaloneGauge(gaugeId, gaugeData);
              if (standaloneGauge) {
                 standaloneGauges.push(standaloneGauge);
              }
          }
          
          data = [...data, ...standaloneGauges];
        }

        globalRiversCache = data;
        globalLoading = false;
        clearTimeout(timeoutId);
        notifySubscribers();

      } catch (err: unknown) {
        clearTimeout(timeoutId);
        globalError = err instanceof Error ? err.message : "An error occurred";
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
