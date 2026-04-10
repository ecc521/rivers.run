import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  if (dataKey === "feet") return "ft";
  if (dataKey === "m" || dataKey === "meters") return "m";
  if (dataKey === "temp") return "°F";
  return "in";
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          color: "var(--surface)",
          padding: "10px",
          borderRadius: "4px",
          border: "1px solid #475569",
        }}
      >
        <p style={{ margin: "0 0 5px 0", fontSize: "1.35em", color: "var(--text-secondary)" }}>
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
  const data = river.flowData || [];
  const { isDarkMode, isColorBlindMode } = useSettings();

  // Detect available datasets
  const hasFlow = data.some((d) => d.cfs != null || d.feet != null || d.cms != null || d.m != null);
  const hasTemp = data.some((d) => d.temp != null);
  const hasPrecip = data.some((d) => d.precip != null);

  const flowKey = data.some((d) => d.cfs != null) ? "cfs" : "cms";
  const stageKey = data.some((d) => d.feet != null) ? "feet" : "m";

  let defaultTab: "flow" | "temp" | "precip" = "precip";
  if (hasFlow) defaultTab = "flow";
  else if (hasTemp) defaultTab = "temp";

  const [activeTab, setActiveTab] = useState<"flow" | "temp" | "precip">(defaultTab);

  if (!data || data.length === 0 || (!hasFlow && !hasTemp && !hasPrecip)) {
    return (
      <div style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "10px 0" }}>
        No historical graph data available for this gauge.
      </div>
    );
  }

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

  // Calculate precip summary text identical to legacy
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

  return (
    <div className="usgs-graphs-container" style={{ marginTop: "20px" }}>
      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
        {hasFlow && (
          <button
            onClick={() => {
              setActiveTab("flow");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #94a3b8",
              backgroundColor: activeTab === "flow" ? "var(--primary)" : "transparent",
              color: activeTab === "flow" ? "white" : "inherit",
              cursor: "pointer",
            }}
          >
            Flow Info
          </button>
        )}
        {hasTemp && (
          <button
            onClick={() => {
              setActiveTab("temp");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #94a3b8",
              backgroundColor: activeTab === "temp" ? "var(--primary)" : "transparent",
              color: activeTab === "temp" ? "white" : "inherit",
              cursor: "pointer",
            }}
          >
            Temperature
          </button>
        )}
        {hasPrecip && (
          <button
            onClick={() => {
              setActiveTab("precip");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #94a3b8",
              backgroundColor:
                activeTab === "precip" ? "var(--primary)" : "transparent",
              color: activeTab === "precip" ? "white" : "inherit",
              cursor: "pointer",
            }}
          >
            Precipitation
          </button>
        )}
      </div>

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
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
            <Tooltip content={<CustomTooltip />} />

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
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={stageKey}
                  name={stageKey === "feet" ? "Stage (ft)" : "Stage (m)"}
                  stroke={stageColor}
                  dot={false}
                  strokeWidth={4}
                />
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
    </div>
  );
};
