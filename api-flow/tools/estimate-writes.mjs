#!/usr/bin/env node
// Projects monthly D1 rows written for flow-db from the per-cycle counts that
// the scheduled handler logs ("Store ingest" rows in worker_logs).
//
// Usage, from the repo root, after a few local cycles 15 minutes apart:
//   node api-flow/tools/estimate-writes.mjs
// The first logged cycle is skipped: it loads the whole window, not one step.
// Cover whole hours: EC files update hourly and UK is stored only on the
// hourly cycle, so each lands in one cycle of four.

import { execFileSync } from "node:child_process";

const CYCLES_PER_MONTH = 30 * 96;
const HOURS_PER_MONTH = 30 * 24;

const sql = "SELECT timestamp, details FROM worker_logs WHERE message LIKE 'Store ingest%' ORDER BY id";
const out = execFileSync("npx", [
    "wrangler", "d1", "execute", "rivers-db", "--local",
    "--config", "api-flow/wrangler.toml", "--json", "--command", sql,
], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// Wrangler may print an update notice after the JSON; keep only the JSON array.
const json = out.slice(out.indexOf("["), out.lastIndexOf("\n]") + 2);
const rows = JSON.parse(json)[0].results
    .map(r => ({ at: r.timestamp, d: JSON.parse(r.details || "{}") }))
    .filter(r => r.d.written);

if (rows.length < 2) {
    console.error(`Need at least 2 logged cycles, found ${rows.length}.`);
    process.exit(1);
}

const recurring = w => w.dimensions + w.providers + w.state + w.usgsWindow;

console.log("cycle (UTC)          dims  providers  state  usgsWindow  usgsRevision  usgsBackfill  revision");
for (const { at, d } of rows) {
    const w = d.written;
    console.log([
        new Date(at * 1000).toISOString().slice(0, 16).padEnd(20),
        String(w.dimensions).padStart(5), String(w.providers).padStart(10), String(w.state).padStart(6),
        String(w.usgsWindow).padStart(11), String(w.usgsRevision).padStart(13), String(w.usgsBackfill).padStart(13),
        "  " + (d.usgs?.revision ?? "n/a"),
    ].join(" "));
}

// Normalize by elapsed time, so skipped cycles do not inflate the rate.
const steady = rows.slice(1);
const elapsedCycles = steady.reduce((a, r, i) => a + (r.d.cycleAt - rows[i].d.cycleAt) / 900_000, 0);
const perCycle = steady.reduce((a, r) => a + recurring(r.d.written), 0) / elapsedCycles;
if (Math.round(elapsedCycles) % 4 !== 0) console.error("Warning: the measured span is not whole hours; hourly writes are over or under counted.");
const revisions = rows.filter(r => r.d.usgs?.revision === "ran").map(r => r.d.written.usgsRevision);
const perRevision = revisions.length ? revisions.reduce((a, b) => a + b, 0) / revisions.length : 0;
const backfill = rows.reduce((a, r) => a + r.d.written.usgsBackfill, 0);

const monthly = perCycle * CYCLES_PER_MONTH + perRevision * HOURS_PER_MONTH;
console.log(`\nrecurring rows per 15 min (${steady.length} cycles over ${elapsedCycles.toFixed(1)} slots): ${perCycle.toFixed(0)}`);
console.log(`revision rows/sweep (${revisions.length} measured): ${perRevision.toFixed(0)}`);
console.log(`projected monthly rows written: ${(monthly / 1e6).toFixed(1)}M`);
console.log(`one-time backfill rows so far: ${backfill}`);
