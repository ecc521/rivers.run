import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RiverData } from "../types/River";
import {
  calculateColor,
  calculateRelativeFlow,
} from "../utils/flowInfoCalculations";
import { RiverExpansion } from "../components/RiverExpansion";
import { useLocation } from "../hooks/useLocation";

const MapPage: React.FC = () => {
  const location = useLocation();
  const [rivers, setRivers] = useState<RiverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRiver, setSelectedRiver] = useState<RiverData | null>(null);

  useEffect(() => {
    const fetchRivers = async () => {
      try {
        const riverDataUrl = import.meta.env.DEV
          ? "https://rivers.run/riverdata.json"
          : "/riverdata.json";
        const flowDataUrl = import.meta.env.DEV
          ? "https://rivers.run/flowdata3.json"
          : "/flowdata3.json";

        const [riverRes, flowRes] = await Promise.all([
          fetch(riverDataUrl),
          fetch(flowDataUrl),
        ]);

        if (!riverRes.ok) throw new Error("Failed to fetch river data");
        let data: RiverData[] = await riverRes.json();

        if (flowRes.ok) {
          const flowData = await flowRes.json();
          data = data.map((river: any, index: number) => {
            river.index = index; // Inject index to be able to map to legacy IDs if needed
            const gaugeRecord = flowData[river.gauge];
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
        }

        setRivers(data);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRivers();
    
    // Automatically query for user location to place native tracker token
    location.requestLocation({ enableHighAccuracy: true });
  }, []);

  const markers = useMemo(() => {
    const points: any[] = [];
    rivers.forEach((river) => {
      if (!river.access || river.access.length === 0) return;

      const start = river.access[0];

      // Calculate geometric center or just use put-in for simplicity
      const lat = start.lat || start.latitude;
      const lon = start.lon || start.longitude || start.lng;

      if (!lat || !lon) return;

      points.push({ river, lat, lon });
    });
    return points;
  }, [rivers]);

  if (loading)
    return (
      <div className="page-content center">
        <h2>Loading Map Data...</h2>
      </div>
    );
  if (error)
    return (
      <div className="page-content center">
        <h2>Error loading map: {error}</h2>
      </div>
    );

  return (
    <div
      style={{
        height: "calc(100vh - 60px)",
        width: "100%",
        position: "relative",
      }}
    >
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((pt, i) => {
          const color = calculateColor(pt.river.running ?? null, false, false);
          return (
            <CircleMarker
              key={i}
              center={[pt.lat, pt.lon]}
              radius={pt.river.isGauge ? 4 : 8}
              fillColor={color || "#fff"}
              fillOpacity={0.9}
              color="#333"
              weight={1}
              eventHandlers={{
                click: () => {
                  setSelectedRiver(pt.river);
                },
              }}
            />
          );
        })}

        {/* Dedicated Local User Map Marker */}
        {location.latitude && location.longitude && (
            <CircleMarker
              center={[location.latitude, location.longitude]}
              radius={7}
              fillColor="#3b82f6" // Distinct Blue
              fillOpacity={1.0}
              color="#ffffff" // White boundary
              weight={2}
            />
        )}
      </MapContainer>

      {selectedRiver && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            maxWidth: "450px",
            backgroundColor: "#ffffff",
            zIndex: 2000,
            boxShadow: "-4px 0 15px rgba(0,0,0,0.2)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "20px",
              position: "sticky",
              top: 0,
              backgroundColor: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              zIndex: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, color: "#1e293b" }}>
              {selectedRiver.name}{" "}
              {selectedRiver.section ? `(${selectedRiver.section})` : ""}
            </h2>
            <button
              onClick={() => {
                setSelectedRiver(null);
              }}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "2em",
                cursor: "pointer",
                color: "#64748b",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
          <div style={{ padding: "0 20px 20px 20px", color: "#334155" }}>
            <RiverExpansion river={selectedRiver} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
