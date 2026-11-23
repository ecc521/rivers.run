import React, { useState } from "react";
import { useSEO } from "../hooks/useSEO";
import { ForecastExample, type ExampleGauge } from "../components/ForecastExample";
import {
    BAND_COVERAGE, CAVEATS, FORECAST_MODEL, NWS_COVERAGE, VS_NWS, type ErrorRow,
} from "../data/forecastMetrics";

const EXAMPLE_GAUGES: ExampleGauge[] = [
    { id: "USGS:03451500", label: "French Broad (NC)" },
    { id: "USGS:01646500", label: "Potomac (MD)" },
    { id: "USGS:03069500", label: "Cheat (WV)" },
    { id: "USGS:02177000", label: "Chattooga (GA/SC)" },
];

type Slice = keyof typeof VS_NWS.slices;

const nwpsErrorScale = Math.max(...Object.values(VS_NWS.slices).flatMap(s => s.rows.map(r => r.theirs)));

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="forecasts-section">
        <h2>{title}</h2>
        {children}
    </section>
);

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <div className="forecasts-stat">
        <div className="forecasts-stat-value">{value}</div>
        <div className="forecasts-stat-label">{label}</div>
    </div>
);

/** Typical miss for rivers.run and another forecast, as paired bars sharing one scale. */
const ErrorTable: React.FC<{ rows: ErrorRow[]; theirs: string; closerLabel: string }> = ({ rows, theirs, closerLabel }) => {
    const w = (v: number) => `${(v / nwpsErrorScale) * 100}%`;
    return (
        <div className="forecasts-table-wrap">
            <table className="forecasts-table">
                <thead>
                    <tr>
                        <th>How far ahead</th>
                        <th>Typical miss</th>
                        <th className="forecasts-num">{closerLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.lead}>
                            <td>{r.lead}</td>
                            <td className="forecasts-bars">
                                <div><span className="ours" style={{ width: w(r.ours) }} /><em>{r.ours}%</em></div>
                                <div><span className="theirs" style={{ width: w(r.theirs) }} /><em>{r.theirs}%</em></div>
                            </td>
                            <td className="forecasts-num"><strong>{Math.round(r.closerPct)}%</strong></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="forecasts-key">
                <span><i className="ours" />rivers.run</span>
                <span><i className="theirs" />{theirs}</span>
            </div>
        </div>
    );
};

const CoverageChart: React.FC = () => (
    <figure className="forecasts-coverage">
        <figcaption className="forecasts-key">
            <span><i className="ours" />All flows</span>
            <span><i className="theirs" />Rising or falling</span>
        </figcaption>
        <ul aria-label="Share of readings inside the forecast range by lead time">
            {BAND_COVERAGE.map(({ lead, all, changing }) => (
                <li key={lead}>
                    <span>{lead}</span>
                    <div className="forecasts-coverage-bars">
                        {([["All flows", all, "ours"], ["Rising or falling", changing, "theirs"]] as const).map(([label, value, color]) => (
                            <div key={label} className="forecasts-coverage-series">
                                <div className="forecasts-coverage-track" role="meter" aria-label={label}
                                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)}%`}>
                                    <span className={color} style={{ width: `${value}%` }} />
                                </div>
                                <span aria-hidden="true">{Math.round(value)}%</span>
                            </div>
                        ))}
                    </div>
                </li>
            ))}
        </ul>
    </figure>
);

const Forecasts: React.FC = () => {
    useSEO({
        title: "River Flow Forecasts",
        description: "See live river flow forecasts for about 6,800 US gauges. Check seven days of expected flows and forecast ranges, updated every hour.",
    });
    const [slice, setSlice] = useState<Slice>("all");
    const m = FORECAST_MODEL;
    const nws = VS_NWS.slices[slice];
    const compared = VS_NWS.gauges.toLocaleString();
    const errorReduction = Math.round(VS_NWS.medianErrorReductionPct);
    const coverageMultiple = Math.floor(m.gaugesServed / NWS_COVERAGE.pointsOnUsgsGauges);
    const [, , , allAtThreeDays] = VS_NWS.slices.all.rows;
    const [, , , changingAtThreeDays] = VS_NWS.slices.changing.rows;

    return (
        <div className="page-content forecasts-page">
            <h1>River forecasts, a week ahead</h1>
            <p className="forecasts-lede">See how the flow could change before your next paddle. Pick a river to explore its live forecast.</p>
            <ForecastExample gauges={EXAMPLE_GAUGES} />

            <div className="forecasts-stats">
                <Stat value={`${m.horizonDays} Days Ahead`} label="Weeklong forecasts updated every hour" />
                <Stat value={`${m.gaugesServed.toLocaleString()}+ Gauges`} label={`Over ${coverageMultiple}× as many USGS gauges as NWPS`} />
                <Stat value={`${errorReduction}% lower error`} label={`Compared with NWPS forecasts across ${compared} matched gauges`} />
            </div>

            <Section title="How the forecasts compare">
                <p>
                    At 2–3 days, the typical miss was <strong>{allAtThreeDays.ours}%</strong> for rivers.run and {allAtThreeDays.theirs}% for NWPS.
                    When flow was rising or falling, the typical miss was <strong>{changingAtThreeDays.ours}%</strong> for rivers.run and {changingAtThreeDays.theirs}% for NWPS.
                </p>
                <div className="forecasts-tabs" role="tablist">
                    {(Object.keys(VS_NWS.slices) as Slice[]).map(k => (
                        <button key={k} type="button" role="tab" aria-selected={k === slice} className={k === slice ? "active" : ""} onClick={() => setSlice(k)}>
                            {VS_NWS.slices[k].label}
                        </button>
                    ))}
                </div>
                <ErrorTable rows={nws.rows} theirs="NWPS official forecast" closerLabel="How often ours was closer" />
                <details className="forecasts-details">
                    <summary>How we tested</summary>
                    <p className="forecasts-muted">
                        We scored forecasts from {m.evalPeriod} against observed flow at {compared} gauges.
                        Rivers.run forecasts were issued at least two hours before the matching National Water Prediction Service (NWPS) forecasts.
                        The coverage comparison uses {NWS_COVERAGE.pointsOnUsgsGauges.toLocaleString()} USGS gauges in our NWPS archive.
                    </p>
                    <p className="forecasts-muted">
                        Typical miss is median absolute log-flow error expressed as a percent. {VS_NWS.slices.changing.note}
                        {" "}{VS_NWS.slices.high.note}
                    </p>
                </details>
            </Section>

            <Section title="How accurate is the range?">
                <p>
                    The shaded range aims to capture 8 in 10 readings. In our January to July 2026 test, it held close to that
                    overall. It covered about 7 in 10 readings when flow was rising or falling, with the biggest gap in the first 12 hours.
                </p>
                <CoverageChart />
            </Section>

            <Section title="How it works">
                <p>
                    We blend two models trained on years of gauge and weather data. Each hour they use the latest information
                    about the river and its watershed:
                </p>
                <ul className="forecasts-list">
                    {m.inputs.map(i => <li key={i}>{i}</li>)}
                </ul>
            </Section>

            <Section title="Where to be careful">
                <ul className="forecasts-list">
                    {CAVEATS.map(c => <li key={c}>{c}</li>)}
                    <li>A forecast is for planning, not a safety guarantee. Always check the gauge before you put on.</li>
                </ul>
                <p className="forecasts-muted">
                    These are our own replay results. The forecast blend went live in {m.shipped}.
                </p>
            </Section>
        </div>
    );
};

export default Forecasts;
