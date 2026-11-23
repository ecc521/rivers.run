import React, { useEffect, useMemo, useRef, useState } from "react";
import { FLOW_API_URL } from "../services/api";
import type { GaugeReading } from "../types/River";
import { fetchModelForecasts, formatModelFlow, type ModelForecast } from "../utils/modelForecast";

export interface ExampleGauge {
    id: string;
    label: string;
}

interface Point { t: number; v: number }
type ScrubPoint = Point & { forecast: boolean; low?: number; high?: number };

interface ExampleData {
    observed: Point[];
    forecast?: ModelForecast;
}

type ExampleHistory = Record<string, { readings?: GaugeReading[] }>;

const H = 240;
const PAD = { l: 52, r: 12, t: 16, b: 28 };
const DAY_MS = 86_400_000;
const scrubTime = new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

async function loadExample(g: ExampleGauge): Promise<ExampleData> {
    const [history, forecasts] = await Promise.all([
        fetch(`${FLOW_API_URL}/history?gauges=${encodeURIComponent(g.id)}&days=3`)
            .then((r): Promise<ExampleHistory> => (r.ok ? r.json() : Promise.resolve({})))
            .catch((): ExampleHistory => ({})),
        fetchModelForecasts(FLOW_API_URL, [g.id]),
    ]);
    const readings = history?.[g.id]?.readings ?? [];
    const observed = readings.flatMap(r => !r.isForecast && typeof r.cfs === "number"
        ? [{ t: r.dateTime, v: r.cfs }]
        : []).sort((a, b) => a.t - b.t);
    return { observed, forecast: forecasts[g.id] };
}

function linePath(points: Point[], x: (t: number) => number, y: (v: number) => number): string {
    return points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
}

/** A small live chart: the last 3 days of a gauge plus its current rivers.run forecast. */
export const ForecastExample: React.FC<{ gauges: ExampleGauge[] }> = ({ gauges }) => {
    const [gauge, setGauge] = useState(gauges[0]);
    const [scrubbedAt, setScrubbedAt] = useState<number | null>(null);
    const [data, setData] = useState<ExampleData | null>(null);
    const [failed, setFailed] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const [W, setW] = useState(640);

    useEffect(() => {
        const measure = () => {
            const el = boxRef.current;
            if (el) setW(Math.max(280, el.clientWidth - 24));
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    useEffect(() => {
        let live = true;
        setData(null);
        setFailed(false);
        loadExample(gauge)
            .then(d => { if (live) setData(d); })
            .catch(() => { if (live) setFailed(true); });
        return () => { live = false; };
    }, [gauge]);

    const chart = useMemo(() => {
        if (!data?.forecast || data.observed.length === 0) return null;
        const f = data.forecast;
        const at = (j: number) => f.start + j * f.stepMs;
        const mid = f.q50.map((v, j) => ({ t: at(j), v }));
        const low = (f.q10 ?? []).map((v, j) => ({ t: at(j), v }));
        const high = (f.q90 ?? []).map((v, j) => ({ t: at(j), v }));
        const all = [...data.observed, ...mid, ...low, ...high];
        const t0 = Math.min(...all.map(p => p.t));
        const t1 = Math.max(...all.map(p => p.t));
        const vMax = Math.max(...all.map(p => p.v)) * 1.08;
        const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
        const y = (v: number) => H - PAD.b - (v / (vMax || 1)) * (H - PAD.t - PAD.b);
        const band = low.length && high.length
            ? linePath([...high, ...[...low].reverse()], x, y) + "Z"
            : null;
        const days: number[] = [];
        const d = new Date(t0);
        d.setHours(24, 0, 0, 0);
        const tickStep = W < 480 ? 2 * DAY_MS : DAY_MS;
        for (let t = d.getTime(); t < t1; t += tickStep) {
            if (x(t) <= W - PAD.r - 14) days.push(t);
        }
        const ticks = [0, 0.5, 1].map(f => f * vMax / 1.08);
        const historyPoints = data.observed.filter(p => p.t < f.start);
        const scrubPoints: ScrubPoint[] = [
            ...historyPoints.map(p => ({ ...p, forecast: false })),
            ...mid.map((p, j) => ({ ...p, forecast: true, low: f.q10?.[j], high: f.q90?.[j] })),
        ];
        return {
            scrubPoints, t0, t1, forecastStart: f.start,
            observed: linePath(data.observed, x, y), mid: linePath(mid, x, y), band,
            forecastX: x(f.start), days, ticks, x, y,
        };
    }, [data, W]);
    const selectedTime = scrubbedAt ?? chart?.forecastStart ?? 0;
    const selected = chart?.scrubPoints.reduce((nearest, point) =>
        Math.abs(point.t - selectedTime) < Math.abs(nearest.t - selectedTime) ? point : nearest);
    const selectionLabel = selected
        ? `${scrubTime.format(selected.t)} · ${selected.forecast ? "Forecast" : "Measured"} ${formatModelFlow(selected.v)} cfs`
        : "";
    const rangeLabel = selected?.low != null && selected.high != null
        ? ` · Range ${formatModelFlow(selected.low)}–${formatModelFlow(selected.high)} cfs`
        : "";

    return (
        <div className="forecast-example" ref={boxRef}>
            <div className="forecast-example-controls">
                {gauges.map(g => (
                    <button
                        key={g.id}
                        type="button"
                        className={g.id === gauge.id ? "active" : ""}
                        aria-pressed={g.id === gauge.id}
                        onClick={() => {
                            setGauge(g);
                            setScrubbedAt(null);
                        }}
                    >
                        {g.label}
                    </button>
                ))}
            </div>
            {chart && selected ? (
                <>
                    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Measured flow and rivers.run forecast" width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
                        {chart.ticks.map(v => (
                            <g key={v}>
                                <line x1={PAD.l} x2={W - PAD.r} y1={chart.y(v)} y2={chart.y(v)} stroke="var(--border)" />
                                <text x={PAD.l - 6} y={chart.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{formatModelFlow(v)}</text>
                            </g>
                        ))}
                        {chart.days.map(t => (
                            <text key={t} x={chart.x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                                {new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </text>
                        ))}
                        {chart.band && <path d={chart.band} fill="var(--primary)" opacity="0.18" />}
                        <line x1={chart.forecastX} x2={chart.forecastX} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-muted)" strokeDasharray="2 3" />
                        <text x={chart.forecastX + 4} y={PAD.t - 4} fontSize="11" fill="var(--text-muted)">Forecast starts</text>
                        <path d={chart.observed} fill="none" stroke="var(--text)" strokeWidth="2" />
                        <path d={chart.mid} fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="6 4" />
                        {scrubbedAt !== null && (
                            <line x1={chart.x(selected.t)} x2={chart.x(selected.t)} y1={PAD.t} y2={H - PAD.b}
                                stroke="var(--text-muted)" />
                        )}
                        <circle cx={chart.x(selected.t)} cy={chart.y(selected.v)} r="4"
                            fill={selected.forecast ? "var(--primary)" : "var(--text)"} stroke="var(--surface)" />
                    </svg>
                    <label className="forecast-example-scrub">
                        <span className="forecast-example-scrub-readout">{selectionLabel}{rangeLabel}</span>
                        <input type="range" min={chart.t0} max={chart.t1} step="any" value={selectedTime}
                            aria-label="Explore flow by time" aria-valuetext={selectionLabel + rangeLabel}
                            onChange={e => setScrubbedAt(e.currentTarget.valueAsNumber)} />
                    </label>
                </>
            ) : (
                <div className="forecast-example-empty">
                    {failed || (data && !chart) ? "No live forecast for this river right now. Try another, or check back when you're online." : "Loading the latest forecast…"}
                </div>
            )}
            <div className="forecast-example-legend">
                <span><i style={{ background: "var(--text)" }} />Measured flow (cfs)</span>
                <span><i style={{ background: "var(--primary)" }} />rivers.run forecast</span>
                <span><i style={{ background: "var(--primary)", opacity: 0.25, height: 10 }} />Likely range</span>
            </div>
        </div>
    );
};
