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
} from "recharts";
import type { RiverData } from "../types/River";
import { useSettings } from "../context/SettingsContext";

interface Props {
  river: RiverData;
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

const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
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
        {payload.map((entry: any, index: number) => (
          <p
            key={`item-${index}`}
            style={{ margin: 0, color: entry.color, fontWeight: "bold", fontSize: "1.35em" }}
          >
            {`${entry.name}: ${entry.value} ${getUnit(entry.dataKey)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const USGSGraphs: React.FC<Props> = ({ river }) => {
  const [activeGaugeId, setActiveGaugeId] = useState<string | undefined>(river.gauges?.[0]?.id);
  const data = activeGaugeId && river.gaugeData ? river.gaugeData[activeGaugeId] || [] : [];
  const { isDarkMode, isColorBlindMode } = useSettings();

  // Detect available datasets
  const hasFlow = data.some((d) => d.cfs != null || d.ft != null || d.cms != null || d.m != null);
  const hasTemp = data.some((d) => d.temp != null);
  const hasPrecip = data.some((d) => d.precip != null);

  const flowKey = data.some((d) => d.cfs != null) ? "cfs" : "cms";
  const stageKey = data.some((d) => d.ft != null) ? "ft" : "m";

  type TabType = "flow" | "temp" | "precip";
  let defaultTab: TabType = "precip";
  if (hasFlow) defaultTab = "flow";
  else if (hasTemp) defaultTab = "temp";

  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

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

  return (
    <div className="usgs-graphs-container" style={{ marginTop: "20px" }}>
      {/* Tab Switcher */}
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "10px", marginBottom: "15px" }}>
        
        {/* Gauge Dropdown (if multiple gauges exist) */}
        {river.gauges && river.gauges.length > 1 ? (
          <select
            value={activeGaugeId}
            onChange={(e) => setActiveGaugeId(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: "bold",
              flex: "1 1 auto",
              maxWidth: "100%"
            }}
          >
            {river.gauges.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name ? `${g.name}` : g.id} {g.isPrimary ? "(Primary)" : ""}
              </option>
            ))}
          </select>
        ) : (
          river.gauges && river.gauges.length === 1 && (
            <select
              disabled
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--text)",
                fontWeight: "bold",
                flex: "1 1 auto",
                maxWidth: "100%",
                appearance: "none",
                MozAppearance: "none",
                WebkitAppearance: "none",
                opacity: 1 // prevent browser from dimming disabled selects
              }}
            >
              <option>
                {river.gauges[0].name ? `${river.gauges[0].name}` : river.gauges[0].id} {river.gauges[0].isPrimary ? "(Primary)" : ""}
              </option>
            </select>
          )
        )}

        {/* Metric Dropdown */}
        {!hasNoData && metricOptionsCount > 1 && (
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as "flow" | "temp" | "precip")}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            cursor: "pointer",
            fontWeight: "bold",
            flex: "1 1 auto",
            maxWidth: "100%"
          }}
        >
          {hasFlow && <option value="flow">Flow Info</option>}
          {hasTemp && <option value="temp">Temperature</option>}
          {hasPrecip && <option value="precip">Precipitation</option>}
        </select>
        )}
      </div>

      {hasNoData ? (
        <div style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "10px 0" }}>
          No historical graph data available for this gauge.
        </div>
      ) : (
        <>
          <div
            style={{
              width: "100%",
              height: "300px",
              backgroundColor: "var(--surface-hover)",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              overflow: "hidden"
            }}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <LineChart
                data={data}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
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
                <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />

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
                    />
                    
                    {/* Threshold Lines */}
                    {(['min', 'low', 'mid', 'high', 'max'] as const).map((key, i) => {
                      const val = river.flow?.[key];
                      if (val == null || isNaN(val)) return null;

                      const isStageUnit = river.flow.unit === "ft" || river.flow.unit === "m";
                      const yAxisId = isStageUnit ? "right" : "left";
                      
                      // Match the HSL logic from calculateColor in flowInfoCalculations.ts
                      // min=0, low=1, mid=2, high=3, max=4
                      const lightness = isDarkMode ? 35 : 60;
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

