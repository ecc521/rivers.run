/**
 * Skill figures from the independent two-model replay (flow_predictions,
 * cache/replay/ens_live_rain). Errors are median absolute log-flow errors
 * expressed as percentages. The National Weather Service comparison uses
 * nwps_scorecard_off2h.json; the last-reading comparison uses persistence_metrics.json.
 */

export const FORECAST_MODEL = {
    shipped: "November 2026",
    horizonDays: 7,
    /** Approximate hourly count, which varies with gauge reporting. */
    gaugesServed: 6800,
    evalPeriod: "April 2025 to July 2026",
    evalGauges: 7132,
    inputs: [
        "The last week of readings at the gauge, and at up to two gauges upstream",
        "Recent rain across the watershed, from NOAA radar and rain gauges where coverage allows",
        "NOAA's forecast rain for the next 7 days",
        "NOAA weather forecasts: temperature, evaporation, soil moisture and snow",
        "What the watershed is like: its size, steepness, soils, land cover and dams",
    ],
};

export interface ErrorRow {
    lead: string;
    ours: number;
    theirs: number;
    /** Percent of gauges (or forecasts) where rivers.run was closer. */
    closerPct: number;
}

export const VS_PERSISTENCE: ErrorRow[] = [
    { lead: "1 day", ours: 3.7, theirs: 8.1, closerPct: 91.8 },
    { lead: "3 days", ours: 9, theirs: 19.2, closerPct: 92.8 },
    { lead: "5 days", ours: 13.9, theirs: 26.9, closerPct: 93.4 },
    { lead: "7 days", ours: 18.4, theirs: 32.1, closerPct: 92.3 },
];

export const VS_NWS = {
    gauges: 1347,
    gaugesOursCloserPct: 95.8,
    medianErrorReductionPct: 52.8,
    slices: {
        all: {
            label: "All flows",
            rows: [
                { lead: "0 to 12 hours", ours: 1.6, theirs: 6.6, closerPct: 77.2 },
                { lead: "12 to 24 hours", ours: 2.6, theirs: 8.7, closerPct: 74.8 },
                { lead: "1 to 2 days", ours: 3.9, theirs: 10.5, closerPct: 71.8 },
                { lead: "2 to 3 days", ours: 5.4, theirs: 12.3, closerPct: 69.1 },
                { lead: "3 to 5 days", ours: 7.0, theirs: 14.5, closerPct: 67.6 },
                { lead: "5 to 7 days", ours: 9.2, theirs: 16.1, closerPct: 65.2 },
            ],
        },
        changing: {
            label: "Rising or falling",
            note: "Rising or falling means flow rose about 25% or fell about 20% from the starting reading.",
            rows: [
                { lead: "0 to 12 hours", ours: 19.6, theirs: 29.5, closerPct: 62.6 },
                { lead: "12 to 24 hours", ours: 19.5, theirs: 30.2, closerPct: 63.7 },
                { lead: "1 to 2 days", ours: 18.1, theirs: 27.6, closerPct: 63.5 },
                { lead: "2 to 3 days", ours: 17.8, theirs: 26.5, closerPct: 63.0 },
                { lead: "3 to 5 days", ours: 19.5, theirs: 28.7, closerPct: 63.3 },
                { lead: "5 to 7 days", ours: 21.6, theirs: 29.6, closerPct: 62.0 },
            ],
        },
        high: {
            label: "High water",
            note: "High water is the top 10% of observed flows at each gauge.",
            rows: [
                { lead: "0 to 12 hours", ours: 2.5, theirs: 6.3, closerPct: 68.6 },
                { lead: "12 to 24 hours", ours: 5.5, theirs: 10.4, closerPct: 65.9 },
                { lead: "1 to 2 days", ours: 8.8, theirs: 14.1, closerPct: 62.2 },
                { lead: "2 to 3 days", ours: 12.5, theirs: 17.7, closerPct: 58.8 },
                { lead: "3 to 5 days", ours: 16.6, theirs: 21.8, closerPct: 57.6 },
                { lead: "5 to 7 days", ours: 17.4, theirs: 22.7, closerPct: 58.1 },
            ],
        },
    } satisfies Record<string, { label: string; note?: string; rows: ErrorRow[] }>,
};

/**
 * Official NWS forecasts at USGS gauges, from flow_predictions' HML archive over
 * the test period (1,525 forecast points linked to a USGS gauge) and its model
 * gauge list (1,363 of 8,458 gauges have an NWS forecast).
 */
export const NWS_COVERAGE = {
    pointsOnUsgsGauges: 1525,
    modelGauges: 8458,
    modelGaugesWithNws: 1363,
    /** Median new forecasts per point per day. */
    issuesPerDay: 1.09,
    /** Share of points whose typical forecast reaches 5 and 7 days. */
    reach5DaysPct: 40,
    reach7DaysPct: 35,
};

/** Share of readings inside the 80% range, Jan to Jul 2026 ensemble holdout. */
export const BAND_COVERAGE = [
    { lead: "0 to 12 hours", all: 79.8, changing: 62.6 },
    { lead: "12 to 24 hours", all: 79.9, changing: 68.4 },
    { lead: "1 to 2 days", all: 79.0, changing: 69.9 },
    { lead: "2 to 3 days", all: 79.1, changing: 70.6 },
    { lead: "3 to 5 days", all: 78.3, changing: 70.6 },
    { lead: "5 to 7 days", all: 77.7, changing: 70.2 },
];

export const CAVEATS: string[] = [
    "Forecasts can miss the size or timing of a fast rise, especially during heavy rain.",
    "Dam-controlled rivers follow release schedules the model can't see. Check posted releases first.",
    "Small, steep creeks and summer thunderstorms are harder to call than big rivers.",
];
