import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { RiverData } from "../types/River";
import { useSettings } from "../context/SettingsContext";

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
  if (dataKey === "temp") return "°F";
  return "in";
};

const CustomTooltip = ({ active, payload, label, isDarkMode, activeTab, flowKey, stageKey, volumeColor, stageColor, tempColor, precipColor }: any) => {
  if (active && payload && payload.length) {
    const rowData = payload[0].payload;
    const items: { name: string, value: any, color: string, dataKey: string }[] = [];

    if (activeTab === "flow") {
      const isForecastFlow = rowData[flowKey] == null && rowData[`${flowKey}Forecast`] != null;
      const isForecastStage = rowData[stageKey] == null && rowData[`${stageKey}Forecast`] != null;
      
      const flowVal = rowData[flowKey] ?? rowData[`${flowKey}Forecast`];
      const stageVal = rowData[stageKey] ?? rowData[`${stageKey}Forecast`];

      items.push({ 
        name: isForecastFlow ? "Forecasted Flow" : "Flow", 
        value: flowVal, 
        color: volumeColor, 
        dataKey: flowKey 
      });
      items.push({ 
        name: isForecastStage ? "Forecasted Stage" : "Stage", 
        value: stageVal, 
        color: stageColor, 
        dataKey: stageKey 
      });
    } else if (activeTab === "temp") {
      items.push({ 
        name: "Temperature", 
        value: rowData.temp, 
        color: tempColor, 
        dataKey: "temp" 
      });
    } else if (activeTab === "precip") {
      items.push({ 
        name: "Precipitation", 
        value: rowData.precip, 
        color: precipColor, 
        dataKey: "precip" 
      });
    }

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
        <p style={{ margin: "0 0 5px 0", fontSize: "1.35em", color: isDarkMode ? "#94a3b8" : "#475569" }}>
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
            {entry.name}: {entry.value != null ? `${entry.value} ${getUnit(entry.dataKey)}` : "(No Reading)"}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const USGSGraphs: React.FC<Props> = ({ river, dataGeneratedAt, onScrub }) => {
  const [activeGaugeId, setActiveGaugeId] = useState<string | undefined>(
    river.gauges?.find((g: any) => g.isPrimary)?.id || river.gauges?.[0]?.id
  );
  const rawData = activeGaugeId && river.gaugeData ? river.gaugeData[activeGaugeId] || [] : [];

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

  const [showForecast, setShowForecast] = useState<boolean>(true);

  const [timeRange, setTimeRange] = useState<number>(3);
  const data = useMemo(() => {
     if (rawData.length === 0) return [];

     // Find the latest actual reading to use as our "present time" anchor.
     // This prevents future forecasted points from shifting the historical window forward.
     let anchorTime = rawData[rawData.length - 1].dateTime;
     for (let i = rawData.length - 1; i >= 0; i--) {
       const d = rawData[i];
       if (d.cfs != null || d.ft != null || d.cms != null || d.m != null || d.temp != null || d.precip != null) {
         anchorTime = d.dateTime;
         break;
       }
     }

     const minTime = anchorTime - (timeRange * 24 * 60 * 60 * 1000);
     return rawData.filter(d => d.dateTime >= minTime && (showForecast || d.dateTime <= anchorTime));
  }, [rawData, timeRange, showForecast]);

  const { isDarkMode, isColorBlindMode } = useSettings();

  // Detect available datasets
  const hasFlow = data.some((d) => d.cfs != null || d.ft != null || d.cms != null || d.m != null || d.cfsForecast != null || d.ftForecast != null);
  const hasTemp = data.some((d) => d.temp != null);
  const hasPrecip = data.some((d) => d.precip != null);

  const flowKey = data.some((d) => d.cfs != null || d.cfsForecast != null) ? "cfs" : "cms";
  const stageKey = data.some((d) => d.ft != null || d.ftForecast != null) ? "ft" : "m";

  type TabType = "flow" | "temp" | "precip";
  let defaultTab: TabType = "precip";
  if (hasFlow) defaultTab = "flow";
  else if (hasTemp) defaultTab = "temp";

  const [userTab, setUserTab] = useState<TabType | "auto">("auto");
  const activeTab = userTab === "auto" ? defaultTab : userTab;

  const precipSummary = useMemo(() => {
    if (!hasPrecip || data.length === 0) return null;
    const startTime = data[data.length - 1].dateTime;
    let halfDay,
      fullDay,
      sum = 0;

    for (let i = data.length - 1; i >= 0; i--) {
      const pt = data[i];
      const currentTime = pt.dateTime;
      if (pt.precip) sum += pt.precip;

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
    if (fullDay !== undefined)
      return `Last 24 hours: ${fullDay}"   Last 12 hours: ${halfDay}"`;
    if (halfDay !== undefined)
      return `Last 12 hours: ${halfDay}"   Total: ${finalSum}"`;
    return `Total Precipitation: ${finalSum}"`;
  }, [data, hasPrecip]);

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
  const precipColor = "#0099FF";
  const axisColor = "var(--text-secondary)";

  const metricOptionsCount = (hasFlow ? 1 : 0) + (hasTemp ? 1 : 0) + (hasPrecip ? 1 : 0);

  const titleElement = (() => {
      const activeGauge = river.gauges?.find((g: any) => g.id === activeGaugeId);
      const name = activeGauge?.name || activeGaugeId;
      
      let link = undefined;
      if (activeGaugeId) {
        const parts = activeGaugeId.split(':');
        if (parts.length >= 2) {
            const type = parts[0].toLowerCase();
            const id = parts[1];
            if (type === 'usgs') link = `https://waterdata.usgs.gov/monitoring-location/${id}/#parameterCode=00060,00065,00010,00011,00045&period=P7D`;
            else if (type === 'canada') link = `https://wateroffice.ec.gc.ca/report/real_time_e.html?stn=${id}`;
            else if (type === 'nws') link = `https://water.noaa.gov/gauges/${id}`;
        }
      }

      if (link) {
        return <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: "bold", color: "var(--text)", textDecoration: "none" }}>{name} <span style={{ fontSize: "0.8em" }}>↗</span></a>;
      }
      return <span style={{ fontWeight: "bold", color: "var(--text)" }}>{name}</span>;
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
                if (g.section) return g.section;
                if (g.name) return g.name;
                return g.id;
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
            {!hasNoData && hasForecastData && (
                <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", marginLeft: "auto" }}>
                    <button 
                        onClick={() => setShowForecast(!showForecast)}
                        style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: showForecast ? "var(--primary)" : "transparent", color: showForecast ? "#fff" : "var(--text)" }}
                    >Forecast: {showForecast ? "ON" : "OFF"}</button>
                </div>
            )}

            {/* Time Range Switch */}
            {!hasNoData && (
                <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", marginLeft: (!hasNoData && hasForecastData) ? "0" : "auto" }}>
                    <button 
                        onClick={() => setTimeRange(1)}
                        style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: timeRange === 1 ? "var(--primary)" : "transparent", color: timeRange === 1 ? "#fff" : "var(--text)" }}
                    >1D</button>
                    <button 
                        onClick={() => setTimeRange(3)}
                        style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: timeRange === 3 ? "var(--primary)" : "transparent", color: timeRange === 3 ? "#fff" : "var(--text)" }}
                    >3D</button>
                    <button 
                        onClick={() => setTimeRange(7)}
                        style={{ padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: timeRange === 7 ? "var(--primary)" : "transparent", color: timeRange === 7 ? "#fff" : "var(--text)" }}
                    >7D</button>
                </div>
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
              height: "330px",
              backgroundColor: "var(--surface-hover)",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              overflow: "hidden"
            }}
          >
            <ResponsiveContainer width="100%" height={330} minWidth={1} debounce={100}>
              <LineChart
                data={data}
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
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="dateTime"
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
                        volumeColor={volumeColor}
                        stageColor={stageColor}
                        tempColor={tempColor}
                        precipColor={precipColor}
                    />
                } />
                <Legend wrapperStyle={{ paddingTop: "20px" }} verticalAlign="bottom" height={36} />

                {activeTab === "flow" && (
                  <>
                    <YAxis
                      yAxisId="left"
                      stroke={volumeColor}
                      tick={{ fill: volumeColor, fontSize: 18 }}
                      offset={10}
                      width={45}
                      domain={["auto", "auto"]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={stageColor}
                      tick={{ fill: stageColor, fontSize: 18 }}
                      offset={10}
                      width={45}
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
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey={`${flowKey}Forecast`}
                      stroke={volumeColor}
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={3}
                      animationDuration={200}
                      connectNulls={true}
                      activeDot={false}
                      legendType="none"
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
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={3}
                      animationDuration={200}
                      connectNulls={true}
                      activeDot={false}
                      legendType="none"
                    />
                    
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
                      width={45}
                      domain={["auto", "auto"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="Temperature"
                      stroke={tempColor}
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
                      width={45}
                      domain={[0, "auto"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="precip"
                      name="Precipitation"
                      stroke={precipColor}
                      dot={false}
                      strokeWidth={4}
                      animationDuration={200}
                      connectNulls={true}
                    />
                  </>
                )}
              </LineChart>
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

