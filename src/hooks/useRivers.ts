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
        const riverDataUrl = getStorageUrl("public/riverdata.json");
        const flowDataUrl = getStorageUrl("public/flowdata3.json");

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

          data = data.map((river: any, index: number) => {
            river.index = index; // Inject index to be able to map to legacy IDs if needed
            river.access = river.access || river.accessPoints; // Support updated Community Lists schema
            
            let activeGaugeId = river.gauge;
            if (!activeGaugeId && river.gauges && Array.isArray(river.gauges) && river.gauges.length > 0) {
              const primary = river.gauges.find((g: any) => g.isPrimary);
              activeGaugeId = primary ? primary.id : river.gauges[0].id;
            }

            if (activeGaugeId) {
                usedGauges.add(activeGaugeId);
            }

            const gaugeRecord = activeGaugeId ? flowData[activeGaugeId] : null;
            if (
              gaugeRecord &&
              gaugeRecord.readings &&
              gaugeRecord.readings.length > 0
            ) {
              const latest =
                gaugeRecord.readings[gaugeRecord.readings.length - 1];
              river.cfs = latest.cfs;
              river.feet = latest.feet;
              river.flowData = gaugeRecord.readings;

              river.running = calculateRelativeFlow(river) ?? undefined;

              if (river.cfs && river.feet)
                river.flow = `${Math.round(river.cfs)} cfs ${Math.round(river.feet * 100) / 100} ft`;
              else if (river.cfs) river.flow = `${Math.round(river.cfs)} cfs`;
              else if (river.feet)
                river.flow = `${Math.round(river.feet * 100) / 100} ft`;
            }
            return river;
          });

          // Create virtual rivers for any gauge present in flowdata3 that isn't mapped to a river
          const virtualGauges: RiverData[] = [];
          let virtualIndex = data.length;

          for (const [gaugeId, gaugeData] of Object.entries(flowData)) {
              if (!usedGauges.has(gaugeId)) {
                  const gData: any = gaugeData;
                  if (gData.readings && gData.readings.length > 0) {
                      const latest = gData.readings[gData.readings.length - 1];
                      let flowStr = "";
                      if (latest.cfs && latest.feet) flowStr = `${Math.round(latest.cfs)} cfs ${Math.round(latest.feet * 100) / 100} ft`;
                      else if (latest.cfs) flowStr = `${Math.round(latest.cfs)} cfs`;
                      else if (latest.feet) flowStr = `${Math.round(latest.feet * 100) / 100} ft`;

                      virtualGauges.push({
                          id: gaugeId,
                          name: gData.name || gaugeId,
                          gauge: gaugeId,
                          isGauge: true,
                          index: virtualIndex++,
                          cfs: latest.cfs,
                          feet: latest.feet,
                          flowData: gData.readings,
                          flow: flowStr,
                          accessPoints: gData.lat && gData.lon ? [{lat: gData.lat, lon: gData.lon, name: "Gauge Marker", type: "other"}] : undefined
                      } as unknown as RiverData);
                  }
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
