#!/usr/bin/env node
// Projects monthly D1 rows written for flow-db from the per-cycle counts that
// the scheduled handler logs ("Store ingest" rows in worker_logs).
//
// Usage, from the repo root, after a few local cycles 15 minutes apart:
//   node api-flow/tools/estimate-writes.mjs
// The first logged cycle is skipped: it loads the whole window, not one step.

import { execFileSync } from "node:child_process";

const CYCLES_PER_MONTH = 30 * 96;
const HOURS_PER_MONTH = 30 * 24;

const sql = "SELECT timestamp, details FROM worker_logs WHERE message LIKE 'Store ingest%' ORDER BY id";
const out = execFileSync("npx", [
    "wrangler", "d1", "execute", "rivers-db", "--local",
    "--config", "api-flow/wrangler.toml", "--json", "--command", sql,
], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

const rows = JSON.parse(out)[0].results
    .map(r => ({ at: r.timestamp, d: JSON.parse(r.details || "{}") }))
    .filter(r => r.d.written);

if (rows.length < 2) {
    console.error(`Need at least 2 logged cycles, found ${rows.length}.`);
    process.exit(1);
}

const recurring = w => w.dimensions + w.providers + w.state + w.usgsWindow;
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

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

const steady = rows.slice(1);
const perCycle = median(steady.map(r => recurring(r.d.written)));
const revisions = rows.filter(r => r.d.usgs?.revision === "ran").map(r => r.d.written.usgsRevision);
const perRevision = revisions.length ? revisions.reduce((a, b) => a + b, 0) / revisions.length : 0;
const backfill = rows.reduce((a, r) => a + r.d.written.usgsBackfill, 0);

const monthly = perCycle * CYCLES_PER_MONTH + perRevision * HOURS_PER_MONTH;
console.log(`\nrecurring rows/cycle (median of ${steady.length}): ${perCycle}`);
console.log(`revision rows/sweep (${revisions.length} measured): ${perRevision.toFixed(0)}`);
console.log(`projected monthly rows written: ${(monthly / 1e6).toFixed(1)}M`);
console.log(`one-time backfill rows so far: ${backfill}`);
