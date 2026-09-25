import React, { useState, useMemo, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Brush,
} from "recharts";
import type { RiverData, GaugeReading } from "../types/River";
import { useSettings } from "../context/SettingsContext";
import { formatModelValue, forecastRowsAsForecast } from "../utils/modelForecast";

const MODEL_UNITS = ["cfs", "cms", "ft", "m"] as const;
type ModelUnit = typeof MODEL_UNITS[number];
type ChartRow = GaugeReading & Partial<Record<`${ModelUnit}ModelRange`, [number, number]>>;
const MODEL_FIELDS = MODEL_UNITS.flatMap((u) => [`${u}Model`, `${u}ModelLow`, `${u}ModelHigh`] as const);

interface Props {
  river: RiverData;
  dataGeneratedAt?: number | null;
  onScrub?: (reading: any | null) => void;
}

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")} ${d.getMonth() + 1}/${d.getDate()}`;
};

const getUnit = (dataKey: string) => {
  if (dataKey === "cfs") return "cfs";
  if (dataKey === "cms") return "cms";
  if (dataKey === "feet" || dataKey === "ft") return "ft";
  if (dataKey === "m" || dataKey === "meters") return "m";
  if (dataKey === "temp_f") return "°F";
  if (dataKey === "temp_c") return "°C";
  if (dataKey === "precip_mm") return "mm";
  return "in";
};

const CustomTooltip = ({ active, payload, label, isDarkMode, activeTab, flowKey, stageKey, tempKey, precipKey, volumeColor, stageColor, tempColor, precipColor, forecastSource, showModel, modelKey }: any) => {
  if (active && payload && payload.length) {
    const rowData = payload[0].payload;
    const items: { name: string, value: any, color: string, dataKey: string }[] = [];
    // Hours with a real reading show only the reading; the forecast is for hours without one.
    const hasReading = rowData[flowKey] != null || rowData[stageKey] != null;
    const modelVal = showModel && !hasReading ? rowData[`${modelKey}Model`] : null;
    let forecast: { color: string; value: string; range: string | null }[] = [];
    const hasOtherFlow = rowData[flowKey] != null || rowData[`${flowKey}Forecast`] != null
      || rowData[stageKey] != null || rowData[`${stageKey}Forecast`] != null;

    if (activeTab === "flow" && (hasOtherFlow || modelVal == null)) {
      const isForecastFlow = rowData[flowKey] == null && rowData[`${flowKey}Forecast`] != null;
      const isForecastStage = rowData[stageKey] == null && rowData[`${stageKey}Forecast`] != null;
      
      const flowVal = rowData[flowKey] ?? rowData[`${flowKey}Forecast`];
      const stageVal = rowData[stageKey] ?? rowData[`${stageKey}Forecast`];

      const flowLabel = isForecastFlow 
        ? (forecastSource === "NWS" ? "NWS Forecast" : "Forecasted Flow")
        : "Flow";
      const stageLabel = isForecastStage 
        ? (forecastSource === "NWS" ? "NWS Forecast" : "Forecasted Stage")
        : "Stage";

      items.push({ 
        name: flowLabel, 
        value: flowVal, 
        color: volumeColor, 
        dataKey: flowKey 
      });
      items.push({ 
        name: stageLabel, 
        value: stageVal, 
        color: stageColor, 
        dataKey: stageKey 
      });
    }
    if (activeTab === "flow" && modelVal != null) {
      // The river's own unit first, then the other of flow and stage when the forecast has both.
      const keys = [modelKey, modelKey === flowKey ? stageKey : flowKey].filter((k) => rowData[k + "Model"] != null);
      forecast = keys.map((k) => {
        const low = rowData[k + "ModelLow"];
        const high = rowData[k + "ModelHigh"];
        return {
          color: k === flowKey ? volumeColor : stageColor,
          value: `${formatModelValue(rowData[k + "Model"], k)} ${getUnit(k)}`,
          range: low != null && high != null ? `(${formatModelValue(low, k)}–${formatModelValue(high, k)})` : null,
        };
      });
    }
    if (activeTab === "temp") {
      items.push({
        name: "Temperature",
        value: rowData[tempKey],
        color: tempColor,
        dataKey: tempKey
      });
    } else if (activeTab === "precip") {
      items.push({
        name: "Precipitation",
        value: rowData[precipKey],
        color: precipColor,
        dataKey: precipKey
      });
    }

    const mutedColor = isDarkMode ? "#94a3b8" : "#475569";
    return (
      <div
        style={{
          backgroundColor: isDarkMode ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.9)",
          color: isDarkMode ? "#f8fafc" : "#0f172a",
          padding: "10px",
          borderRadius: "4px",
          border: isDarkMode ? "1px solid #475569" : "1px solid #cbd5e1",
        }}
      >
        <p style={{ margin: "0 0 5px 0", fontSize: "1.35em", color: mutedColor }}>
          {formatDate(label)}
        </p>
        {items.map((entry: any, index: number) => (
          <p
            key={`item-${index}`}
            style={{ 
                margin: 0, 
                color: entry.value != null ? entry.color : "var(--text-muted)", 
                fontWeight: "bold", 
                fontSize: "1.35em",
                opacity: entry.value != null ? 1 : 0.6
            }}
          >
            {entry.name}: {entry.value != null ? `${entry.value} ${getUnit(entry.dataKey)}` : <span style={{ fontStyle: "italic", fontWeight: "normal" }}>(No Reading)</span>}
          </p>
        ))}
        {forecast.length > 0 && (
          <div style={{ marginTop: items.length > 0 ? "6px" : 0 }}>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "1.35em" }}>Rivers.run forecast</p>
            {forecast.map((f) => (
              <p key={f.value} style={{ margin: 0, fontWeight: "bold", fontSize: "1.35em", color: f.color }}>
                {f.value}
                {f.range && <span style={{ fontWeight: "normal", color: mutedColor }}> {f.range}</span>}
              </p>
            ))}
            <p style={{ margin: "2px 0 0", fontSize: "0.95em", color: mutedColor }}>Forecasts can be incorrect</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const USGSGraphs: React.FC<Props> = ({ river, dataGeneratedAt, onScrub }) => {
  const [activeGaugeId, setActiveGaugeId] = useState<string | undefined>(
    river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id
  );

  // Synchronize active gauge when the river changes (e.g., via navigation)
  useEffect(() => {
    setActiveGaugeId(river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id);
  }, [river.id]);
  const gaugeReadings = activeGaugeId && river.gaugeData ? river.gaugeData[activeGaugeId] : undefined;
  const rawData = useMemo(() => forecastRowsAsForecast(gaugeReadings || []), [gaugeReadings]);

  const isGraphStale = useMemo(() => {
     if (rawData.length === 0) return false;
     let latestActualReading = null;
     for (let i = rawData.length - 1; i >= 0; i--) {
         const d = rawData[i];
         if (d.cfs != null || d.ft != null || d.cms != null || d.m != null) {
             latestActualReading = d;
             break;
         }
     }
     if (!latestActualReading) return false;
     
     // 2-hour relative staleness rule: Reading must be within 2 hours of the sync generation
     const syncTime = dataGeneratedAt || Date.now();
     return (syncTime - latestActualReading.dateTime) > 2 * 60 * 60 * 1000;
  }, [rawData, dataGeneratedAt]);

  const hasForecastData = useMemo(() => {
    return rawData.some((d: any) => d.cfsForecast != null || d.ftForecast != null || d.forecast === true);
  }, [rawData]);

  const forecastSource = useMemo(() => {
    return rawData.find((d: any) => d.forecastSource)?.forecastSource;
  }, [rawData]);

  const hasModelForecast = useMemo(() => rawData.some((d) => d.cfsModel != null), [rawData]);

  const [showForecast, setShowForecast] = useState<boolean>(true);

  const [timeRange, setTimeRange] = useState<number>(7);
  const { rows: data, anchorTime } = useMemo(() => {
     if (rawData.length === 0) return { rows: [] as ChartRow[], anchorTime: 0 };

     // Find the latest actual reading to use as our "present time" anchor.
     // This prevents future forecasted points from shifting the historical window forward.
     let anchorTime = rawData[rawData.length - 1].dateTime;
     for (let i = rawData.length - 1; i >= 0; i--) {
       const d = rawData[i];
       if (d.cfs != null || d.ft != null || d.cms != null || d.m != null || d.temp_f != null || d.temp_c != null || d.precip_in != null || d.precip_mm != null) {
         anchorTime = d.dateTime;
         break;
       }
     }

     const rangeMs = timeRange * 24 * 60 * 60 * 1000;
     const minTime = anchorTime - rangeMs;
     // Show as much forecast ahead as history behind, so neither squeezes the other.
     const maxTime = showForecast ? anchorTime + rangeMs : anchorTime;
     const rows: ChartRow[] = rawData.filter(d => d.dateTime >= minTime && d.dateTime <= maxTime);
     // Range areas take a [low, high] pair per row.
     return {
       anchorTime,
       rows: rows.map((d) => {
         if (d.cfsModel == null && d.ftModel == null) return d;
         const row: ChartRow = { ...d };
         // Forecast hours the gauge has already reported start at the latest reading instead.
         if (d.dateTime < anchorTime) {
           for (const f of MODEL_FIELDS) delete row[f];
           return row;
         }
         for (const u of MODEL_UNITS) {
           const low = d[`${u}ModelLow`];
           const high = d[`${u}ModelHigh`];
           if (low != null && high != null) row[`${u}ModelRange`] = [low, high];
         }
         return row;
       }),
     };
  }, [rawData, timeRange, showForecast]);

  const { isDarkMode, isColorBlindMode } = useSettings();

  // Detect available datasets
  const hasFlow = data.some((d) => d.cfs != null || d.ft != null || d.cms != null || d.m != null || d.cfsForecast != null || d.ftForecast != null);
  const hasTemp = data.some((d) => d.temp_f != null || d.temp_c != null);
  const hasPrecip = data.some((d) => d.precip_in != null || d.precip_mm != null);

  const flowKey = data.some((d) => d.cfs != null || d.cfsForecast != null) ? "cfs" : "cms";
  const stageKey = data.some((d) => d.ft != null || d.ftForecast != null) ? "ft" : "m";
  const isStageThreshold = river.flow?.unit === "ft" || river.flow?.unit === "m";
  // Flow and stage forecasts each continue their own line with its likely range. The legend
  // and tooltip lead with the unit the river's levels are in.
  const showFlowModel = showForecast && data.some((d) => d[`${flowKey}Model`] != null);
  const showStageModel = showForecast && data.some((d) => d[`${stageKey}Model`] != null);
  const modelOnStage = isStageThreshold && showStageModel;
  const modelKey = modelOnStage ? stageKey : flowKey;
  const showModel = modelOnStage || showFlowModel;
  const tempKey = data.some((d) => d.temp_f != null) ? "temp_f" : "temp_c";
  const precipKey = data.some((d) => d.precip_in != null) ? "precip_in" : "precip_mm";

  type TabType = "flow" | "temp" | "precip";
  let defaultTab: TabType = "precip";
  if (hasFlow) defaultTab = "flow";
  else if (hasTemp) defaultTab = "temp";

  const [userTab, setUserTab] = useState<TabType | "auto">("auto");
  const activeTab = userTab === "auto" ? defaultTab : userTab;
  // Only the flow tab has forecasts; the others end at the latest reading instead of
  // leaving the forecast half of the axis empty.
  const tabHasForecast = activeTab === "flow" && showForecast && (hasForecastData || showModel);
  const chartData = useMemo(
    () => (tabHasForecast ? data : data.filter((d) => d.dateTime <= anchorTime)),
    [data, tabHasForecast, anchorTime]
  );

  const precipSummary = useMemo(() => {
    if (!hasPrecip || data.length === 0) return null;
    const startTime = data[data.length - 1].dateTime;
    let halfDay,
      fullDay,
      sum = 0;

    for (let i = data.length - 1; i >= 0; i--) {
      const pt = data[i];
      const currentTime = pt.dateTime;
      const val = pt[precipKey];
      if (val) sum += val;

      if (
        halfDay === undefined &&
        startTime - currentTime >= 1000 * 60 * 60 * 12
      )
        halfDay = Math.round(sum * 1000) / 1000;
      if (
        fullDay === undefined &&
        startTime - currentTime >= 1000 * 60 * 60 * 24
      )
        fullDay = Math.round(sum * 1000) / 1000;
    }
    const finalSum = Math.round(sum * 1000) / 1000;
    const unit = precipKey === "precip_mm" ? "mm" : `"`;
    const fmt = (v: number) => precipKey === "precip_mm" ? `${v} ${unit}` : `${v}${unit}`;
    if (fullDay !== undefined)
      return `Last 24 hours: ${fmt(fullDay)}   Last 12 hours: ${fmt(halfDay!)}`;
    if (halfDay !== undefined)
      return `Last 12 hours: ${fmt(halfDay)}   Total: ${fmt(finalSum)}`;
    return `Total Precipitation: ${fmt(finalSum)}`;
  }, [data, hasPrecip, precipKey]);

  const hasNoData = !data || data.length === 0 || (!hasFlow && !hasTemp && !hasPrecip);

  // Theme styling
  const volumeColor = isColorBlindMode ? "#ff8800" : "#00CCFF";
  let stageColor = "blue";
  if (isColorBlindMode) {
      stageColor = isDarkMode ? "#00CCFF" : "#7175ff";
  } else if (isDarkMode) {
      stageColor = "#7175ff";
  }
  
  const tempColor = isDarkMode ? "#00AAFF" : "red";
  const tempGradientTop = "#FF0000";
  const tempGradientBottom = "#0000FF";
  const precipColor = "#0099FF";
  const modelDash = "2 6";
  const nwsDash = "10 6";
  const axisColor = "var(--text-secondary)";

  // YAxis width defaults to fitting ~4-digit values; widen it for larger readings
  // (e.g. flood-stage CFS in the tens of thousands) so the leading digit isn't clipped.
  const getAxisWidth = (values: (number | null | undefined)[]) => {
    let maxAbs = 0;
    for (const v of values) {
      if (v != null && !isNaN(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    const digits = maxAbs > 0 ? Math.floor(Math.log10(maxAbs)) + 1 : 1;
    return digits <= 4 ? 45 : 45 + (digits - 4) * 9;
  };

  const thresholds = [river.flow?.min, river.flow?.low, river.flow?.mid, river.flow?.high, river.flow?.max];
  const flowAxisWidth = useMemo(
    () => getAxisWidth([...data.map((d) => d[flowKey]), ...data.map((d) => d[`${flowKey}ModelHigh`] ?? d[`${flowKey}Model`]), ...(isStageThreshold ? [] : thresholds)]),
    [data, flowKey, isStageThreshold, river.flow]
  );
  const stageAxisWidth = useMemo(
    () => getAxisWidth([...data.map((d) => d[stageKey]), ...data.map((d) => d[`${stageKey}ModelHigh`] ?? d[`${stageKey}Model`]), ...(isStageThreshold ? thresholds : [])]),
    [data, stageKey, isStageThreshold, river.flow]
  );
  const tempAxisWidth = useMemo(() => getAxisWidth(data.map((d) => d[tempKey])), [data, tempKey]);
  const precipAxisWidth = useMemo(() => getAxisWidth(data.map((d) => d[precipKey])), [data, precipKey]);

  const metricOptionsCount = (hasFlow ? 1 : 0) + (hasTemp ? 1 : 0) + (hasPrecip ? 1 : 0);

  const titleElement = (() => {
      const activeGauge = river.gauges?.find((g: any) => g.id === activeGaugeId);
      const name = activeGauge?.name || activeGaugeId;
      const section = activeGauge?.section;

      let link = undefined;
      if (activeGaugeId) {
        const parts = activeGaugeId.split(':');
        if (parts.length >= 2) {
            const type = parts[0].toLowerCase();
            const id = parts[1];
            if (type === 'usgs') link = `https://waterdata.usgs.gov/monitoring-location/${id}/#parameterCode=00060,00065,00010,00011,00045&period=P7D`;
            else if (type === 'canada' || type === 'ec') link = `https://wateroffice.ec.gc.ca/report/real_time_e.html?stn=${id}`;
            else if (type === 'nws') link = `https://water.noaa.gov/gauges/${id}`;
        }
      }

      const label = <>
        {name}
        {section && <span style={{ fontWeight: "normal", color: "var(--text-muted)", fontSize: "0.85em" }}> · {section}</span>}
      </>;

      if (link) {
        return <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: "bold", color: "var(--text)", textDecoration: "none" }}>{label} <span style={{ fontSize: "1em", color: "var(--primary)" }}>↗</span></a>;
      }
      return <span style={{ fontWeight: "bold", color: "var(--text)" }}>{label}</span>;
  })();

  return (
    <div className="usgs-graphs-container" style={{ marginTop: "20px" }}>
      {/* Title (Centered on top if multiple gauges exist) */}
      {(!river.gauges || river.gauges.length > 1) && (
        <div style={{ textAlign: "center", marginBottom: "15px", fontSize: "1.25em" }}>
          {titleElement}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "15px", alignItems: "center" }}>
        {/* Gauge Dropdown (if multiple gauges exist), else inline Title */}
        {river.gauges && river.gauges.length > 1 ? (
          <select
            value={activeGaugeId}
            onChange={(e) => setActiveGaugeId(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: "bold",
              flexShrink: 1,
              maxWidth: "40vw",
              textOverflow: "ellipsis"
            }}
          >
            {river.gauges.map((g) => {
              const label = (() => {
                const base = g.name || g.id;
                return g.section ? `${base} · ${g.section}` : base;
              })();
              return (
                <option key={g.id} value={g.id}>
                  {label} {g.isPrimary ? "(Primary)" : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <div style={{ fontSize: "1.15em", flexShrink: 1, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
             {titleElement}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", flex: "1 1 auto", justifyContent: river.gauges && river.gauges.length > 1 ? "flex-end" : "space-between" }}>
            {/* Metric Switch */}
            {!hasNoData && metricOptionsCount > 1 && (
                <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)" }}>
                    {hasFlow && (
                        <button 
                            onClick={() => setUserTab("flow")}
                            style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: activeTab === "flow" ? "var(--primary)" : "transparent", color: activeTab === "flow" ? "#fff" : "var(--text)" }}
                        >Flow</button>
                    )}
                    {hasTemp && (
                        <button
                            onClick={() => setUserTab("temp")}
                            style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: activeTab === "temp" ? "var(--primary)" : "transparent", color: activeTab === "temp" ? "#fff" : "var(--text)" }}
                        >Temp</button>
                    )}
                    {hasPrecip && (
                        <button 
                            onClick={() => setUserTab("precip")}
                            style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: activeTab === "precip" ? "var(--primary)" : "transparent", color: activeTab === "precip" ? "#fff" : "var(--text)" }}
                        >Precip</button>
                    )}
                </div>
            )}

            {/* Forecast Switch */}
            {!hasNoData && (hasForecastData || hasModelForecast) && (
                <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", marginLeft: "auto" }}>
                    <button 
                        onClick={() => setShowForecast(!showForecast)}
                        style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: showForecast ? "var(--primary)" : "transparent", color: showForecast ? "#fff" : "var(--text)" }}
                    >Forecast: {showForecast ? "ON" : "OFF"}</button>
                </div>
            )}

            {/* Time Range Switch */}
            {!hasNoData && (
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(Number(e.target.value))}
                    style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface)",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontWeight: "bold",
                        marginLeft: (!hasNoData && (hasForecastData || hasModelForecast)) ? "0" : "auto"
                    }}
                >
                    <option value={1}>1 Day</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                </select>
            )}
        </div>
      </div>

      {hasNoData ? (
        <div style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "10px 0" }}>
          No historical graph data available for this gauge.
        </div>
      ) : (
        <>
          {isGraphStale && (
            <div style={{ 
              backgroundColor: "var(--warning-bg)", 
              color: "var(--warning-text)", 
              padding: "10px", 
              borderRadius: "8px", 
              marginBottom: "10px", 
              fontSize: "0.9em",
              textAlign: "center",
              border: "1px solid var(--warning)",
              fontWeight: "bold"
            }}>
              ⚠️ Data is more than 2 hours old. This gauge may be reporting intermittently or is currently offline.
            </div>
          )}
          <div
            style={{
              width: "100%",
              height: "380px",
              backgroundColor: "var(--surface-hover)",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              overflow: "hidden"
            }}
          >
            <ResponsiveContainer width="100%" height={380} minWidth={1} debounce={100}>
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                onMouseMove={(e: any) => {
                  if (onScrub && e && e.activePayload && e.activePayload.length) {
                    onScrub(e.activePayload[0].payload);
                  }
                }}
                onMouseLeave={() => {
                  if (onScrub) onScrub(null);
                }}
              >
                <defs>
                  <linearGradient id="tempLineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tempGradientTop} />
                    <stop offset="100%" stopColor={tempGradientBottom} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="dateTime"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatDate}
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 18 }}
                  minTickGap={30}
                />
                <Tooltip content={
                    <CustomTooltip 
                        isDarkMode={isDarkMode} 
                        activeTab={activeTab} 
                        flowKey={flowKey}
                        stageKey={stageKey}
                        tempKey={tempKey}
                        precipKey={precipKey}
                        volumeColor={volumeColor}
                        stageColor={stageColor}
                        tempColor={tempColor}
                        precipColor={precipColor}
                        forecastSource={forecastSource}
                        showModel={showModel}
                        modelKey={modelKey}
                    />
                } />
                <Legend wrapperStyle={{ paddingTop: "20px" }} verticalAlign="bottom" />

                {activeTab === "flow" && (
                  <>
                    <YAxis
                      yAxisId="left"
                      stroke={volumeColor}
                      tick={{ fill: volumeColor, fontSize: 18 }}
                      offset={10}
                      width={flowAxisWidth}
                      domain={["auto", "auto"]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={stageColor}
                      tick={{ fill: stageColor, fontSize: 18 }}
                      offset={10}
                      width={stageAxisWidth}
                      domain={["auto", "auto"]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey={flowKey}
                      name={flowKey === "cfs" ? "Flow (cfs)" : "Flow (cms)"}
                      stroke={volumeColor}
                      dot={false}
                      strokeWidth={4}
                      animationDuration={200}
                      connectNulls={true}
                    />
                    {showFlowModel && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey={`${flowKey}ModelRange`}
                        stroke="none"
                        fill={volumeColor}
                        fillOpacity={isDarkMode ? 0.16 : 0.14}
                        isAnimationActive={false}
                        connectNulls={true}
                        activeDot={false}
                        legendType="none"
                      />
                    )}
                    {showStageModel && (
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey={`${stageKey}ModelRange`}
                        stroke="none"
                        fill={stageColor}
                        fillOpacity={isDarkMode ? 0.16 : 0.12}
                        isAnimationActive={false}
                        connectNulls={true}
                        activeDot={false}
                        legendType="none"
                      />
                    )}
                    {showFlowModel && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey={`${flowKey}Model`}
                        name="Rivers.run forecast"
                        stroke={volumeColor}
                        strokeDasharray={modelDash}
                        strokeLinecap="round"
                        dot={false}
                        strokeWidth={3}
                        animationDuration={200}
                        connectNulls={true}
                        legendType={modelOnStage ? "none" : "plainline"}
                      />
                    )}
                    {showStageModel && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={`${stageKey}Model`}
                        name="Rivers.run forecast"
                        stroke={stageColor}
                        strokeDasharray={modelDash}
                        strokeLinecap="round"
                        dot={false}
                        strokeWidth={3}
                        animationDuration={200}
                        connectNulls={true}
                        legendType={modelOnStage ? "plainline" : "none"}
                      />
                    )}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey={`${flowKey}Forecast`}
                      name={forecastSource === "NWS" ? "NWS forecast" : "Forecast"}
                      stroke={volumeColor}
                      strokeDasharray={nwsDash}
                      dot={false}
                      strokeWidth={3}
                      animationDuration={200}
                      connectNulls={true}
                      activeDot={false}
                      legendType={hasForecastData && showForecast ? "plainline" : "none"}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey={stageKey}
                      name={stageKey === "ft" ? "Stage (ft)" : "Stage (m)"}
                      stroke={stageColor}
                      dot={false}
                      strokeWidth={4}
                      animationDuration={200}
                      connectNulls={true}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey={`${stageKey}Forecast`}
                      stroke={stageColor}
                      strokeDasharray={nwsDash}
                      dot={false}
                      strokeWidth={3}
                      animationDuration={200}
                      connectNulls={true}
                      activeDot={false}
                      legendType="none"
                    />
                    
                    {tabHasForecast && (
                      <ReferenceLine
                        yAxisId="left"
                        x={anchorTime}
                        stroke={axisColor}
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                        label={{ value: "Forecast", position: "insideTopLeft", dx: 8, dy: 16, fill: axisColor, fontSize: 13 }}
                      />
                    )}

                    {/* Threshold Lines */}
                    {(['min', 'low', 'mid', 'high', 'max'] as const).map((key, i) => {
                      const val = river.flow?.[key];
                      if (val == null || isNaN(val)) return null;

                      const isStageUnit = river.flow.unit === "ft" || river.flow.unit === "m";
                      const yAxisId = isStageUnit ? "right" : "left";
                      
                      // Match the HSL logic from calculateColor in flowInfoCalculations.ts
                      // min=0, low=1, mid=2, high=3, max=4
                      let lightness = isDarkMode ? 35 : 50;
                      if (!isDarkMode && i === 1) lightness = 40; // Specifically darken yellow for contrast
                      const strokeColor = `hsl(${i * 60}, 100%, ${lightness}%)`;

                      return (
                        <ReferenceLine
                          key={key}
                          yAxisId={yAxisId}
                          y={val}
                          stroke={strokeColor}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{
                            position: 'insideLeft',
                            value: `${key.charAt(0).toUpperCase() + key.slice(1)} (${val})`,
                            fill: isDarkMode ? "#cbd5e1" : "#475569",
                            fontSize: 14,
                            fontWeight: 'bold',
                            dy: -10
                          }}
                        />
                      );
                    })}
                  </>
                )}

                {activeTab === "temp" && (
                  <>
                    <YAxis
                      stroke={tempColor}
                      tick={{ fill: tempColor, fontSize: 18 }}
                      width={tempAxisWidth}
                      domain={["auto", "auto"]}
                    />
                    <Line
                      type="monotone"
                      dataKey={tempKey}
                      name={tempKey === "temp_f" ? "Temperature (°F)" : "Temperature (°C)"}
                      stroke="url(#tempLineGradient)"
                      dot={false}
                      strokeWidth={4}
                      animationDuration={200}
                      connectNulls={true}
                    />
                  </>
                )}

                {activeTab === "precip" && (
                  <>
                    <YAxis
                      stroke={precipColor}
                      tick={{ fill: precipColor, fontSize: 18 }}
                      width={precipAxisWidth}
                      domain={[0, "auto"]}
                    />
                    <Line
                      type="monotone"
                      dataKey={precipKey}
                      name={precipKey === "precip_in" ? "Precipitation (in)" : "Precipitation (mm)"}
                      stroke={precipColor}
                      dot={false}
                      strokeWidth={4}
                      animationDuration={200}
                      connectNulls={true}
                    />
                  </>
                )}
                <Brush
                  dataKey="dateTime"
                  height={30}
                  tickFormatter={formatDate}
                  stroke="var(--border)"
                  fill="var(--surface-hover)"
                  travellerWidth={8}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {activeTab === "precip" && precipSummary && (
            <p
              style={{
                textAlign: "center",
                color: precipColor,
                marginTop: "10px",
                fontSize: "0.9em",
                fontWeight: "bold",
              }}
            >
              {precipSummary}
            </p>
          )}

        </>
      )}
    </div>
  );
};

