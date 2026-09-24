# api-flow

This isolated Cloudflare Worker handles gauge (hydro-data) scraping and proxying, and is
mostly a clean separation from `api/` — **no authentication layer, no general user-facing
database queries.** The one exception is the digest/unsubscribe email pipeline (see
`src/services/notifications.ts` and the `/unsubscribe` route in `src/index.ts`), which
reads and writes a narrow set of `users` columns (`email`, `notifications_*`) directly
against the same D1 database `api/` uses, bound independently in this worker's own
`wrangler.toml`. The `/unsubscribe` route is intentionally unauthenticated (it must work
with no login, per RFC 8058 one-click unsubscribe) and is instead gated by an HMAC-signed
token — see `src/utils/unsubscribeToken.ts`. Built on Hono (`OpenAPIHono`). Entry point:
`src/index.ts`. Deployed to `flow.rivers.run`. Provider integrations live in
`src/services/` (USGS, Canada, UK, Ireland, NWS).

## 1. CORS Proxying & Network Constraints

- The worker fetches from external agency endpoints (USGS, Environment Canada, etc.) and
  serves results back to the React UI, bypassing browser CORS restrictions. CORS is
  configured via `hono/cors` (`app.use("*", cors(...))`).
- **Clip history aggressively.** The `days` query parameter defaults to 7 and is
  rejected with HTTP 400 above **30 days** (see the flow route in `src/index.ts`).
  Never accept an unbounded historical range — large CSV/JSON fetches can crash the
  proxy. Requests are also capped at ~10 gauges.
- Do not add heavy parsing dependencies (e.g. `csv-parser`); use native string-splitting
  for speed.

## 2. Cron Operations (`scheduled` handler)

`wrangler.toml` declares three cron triggers, dispatched by `event.cron` in the
`scheduled` handler:

- `*/15 * * * *` — gauge-state polling every 15 minutes.
- `0 0 * * *` — daily maintenance.
- `0 0 * * 5` — weekly full registry recompilation (Friday; `0 0 * * 0` Sunday is used
  in tests).

Note: there is **no** `usage_model = "unbound"` in `wrangler.toml`. Cloudflare Workers
Standard Pricing now applies extended limits to cron fetch loops automatically, so do
not re-add it.

## 3. Flow History Store (`FLOW_DB`)

30 days of observations for every gauge live in `flow-db`, a D1 database kept separate
from `rivers-db` so ingest never contends with user CRUD. The binding is optional in
code: unbound, the worker uses the old stateless path (`performDataSync`). Schema:
`migrations/2026-08-01_flow_history_store.sql`. `wrangler.toml` ships a placeholder
`database_id`; create the database, paste its id, then apply the migration:

```bash
npx wrangler d1 create flow-db
npx wrangler d1 execute flow-db --remote --config api-flow/wrangler.toml --file api-flow/migrations/2026-08-01_flow_history_store.sql
```

**Ring buffer.** `gauge_readings` has one row per (gauge, 15-minute slot), with
`slot = floor(ts / 15 min) mod 3072` (32 days). A new reading overwrites the slot's
previous lap, so retention needs no DELETEs (D1 bills deleted rows as writes). Every
read must filter `ts >= now - 30d`. A slot keeps the reading closest to its start
(parameters it lacks are filled from other readings in the slot). `ts` is the slot
start; `off` is the source reading's offset in seconds. Served readings use
`ts + off` rounded to 5 minutes, the same convention as the live USGS and NWS parsers.

**Guarded writes.** D1 bills rows written, so every upsert (`flowStore.ts`) has a
`WHERE` that makes an unchanged row a no-op. Replaying a batch must write 0 rows;
tests assert this. `gauge_sync_state` and `sync_meta` are also only written on change.
Bulk writes pass one JSON parameter through `json_each` (D1 allows 100 bound
parameters). Reads use `CROSS JOIN` plus a slot range so they seek the primary key.

**Ingest** (`flowSync.ts`, `usgsIngest.ts`), on the `*/15` trigger only (the daily
and weekly crons also fire at 00:00 and must not start a second ingest):

- USGS, all registry gauges, 200 sites per request: a `datetime=<now-6h>/..` window
  sweep every cycle; an hourly revision sweep (`last_modified` since a global cursor,
  bounded by `datetime=<now-30d>/..`, cursor advanced only if every batch completed);
  and backfill (failed windows first, then 7 days, then 30) chunked to 100 site-days
  per request. Pages are upserted as they arrive. Backfill and revisions stop when
  `X-RateLimit-Remaining` falls below 300; a revision sweep also stops at 120 pages,
  and a cursor more than a day old becomes datetime repair. A failing backfill group
  is split; a lone failing site backs off (`fail_count`, `retry_at`).
  `FLOW_BACKFILL_MAX_REQUESTS` caps backfill requests per cycle (default 100).
- EC, NWS: the whole province file or gauge series, one unit at a time
  (`getBulkHistories`). A failed unit marks its gauges for repair; coverage is set per
  gauge from its earliest reading and restarts after a gap longer than the unit
  holds. NWS forecast rows go to `sitedata.json`, never the store.
- UK, IE: latest-only bulk calls; river-linked gauges also fetch 3h of history.

`/history` and `/gauge` serve from the store only when `gauge_sync_state` says it
covers the whole request with no pending repair (USGS after backfill, EC/NWS from
first sight, never UK/IE) and the provider ingested within 45 minutes. Otherwise
they fetch live. With `forecast=true`, stored gauges fetch only forecasts live.
`sitedata.json` is written before the hourly model snapshot is built.

Known gaps, not yet handled:

- A value USGS deletes stays stored: upserts never null a column, and a missing
  record is indistinguishable from an unchanged one.
- `approved` is unreliable (a partial revision or duplicate series can set it from
  one parameter's record). Nothing reads it yet.

`node api-flow/tools/estimate-writes.mjs` projects monthly rows written from the
per-cycle counts logged in local `worker_logs`.

### Model snapshot (`model/usgs_hourly.json.gz` in R2)

Written by the cycle in the first quarter of each UTC hour (`modelSnapshot.ts`).
Gzipped JSON:

| key | meaning |
|---|---|
| `version` | `1` |
| `generated_at` | ms epoch |
| `start` | ms epoch label of hour index 0 |
| `hours`, `step_ms` | `192`, `3600000` |
| `sites` | USGS site numbers (no prefix), sorted; row `i` of every array below |
| `discharge_cfs`, `stage_ft` | `sites x hours` hourly means, `null` where no data |
| `discharge_n`, `stage_n` | `sites x hours` count of readings in each mean (0 to 4) |

Hour `H` (label `start + i * step_ms`) is the mean of the stored readings with
`H <= ts < H + 1h`, matching pandas `resample("h").mean()` with left labels. Means
are rounded to 5 significant figures (not fixed decimals, which distort small rivers
in log space). A full snapshot is about 30 MB of JSON, 8 to 10 MB gzipped. The store
keeps one reading per 15-minute slot, so a full hour has 4. The last hour is the
current one and is partial. Sentinels (`<= -999999`) are excluded. Every registry USGS
gauge is listed, even with no data. In Python:
`np.array(snap["discharge_cfs"], dtype=float)` turns `null` into `nan`.

## 4. Caching & Return Signatures

- Endpoints return statically shaped `{ [gaugeId]: { readings: [...] } }` payloads that
  mirror the legacy Firebase Storage JSON keys, so the frontend `useRivers.ts` hook
  needs no adaptation. Preserve this shape when editing flow payloads in `src/index.ts`.
- Responses set `Cache-Control` (e.g. `max-age=300`, stale-while-revalidate) and support
  conditional 304 responses. Processed data is persisted to the R2 `flowdata` bucket.
- The sync includes a resiliency pass: a gauge with no recent reading keeps its
  readings from the existing `sitedata.json`, so the payload never regresses to empty.

## 5. Required Secrets

Cloudflare Worker secrets are never listed in `wrangler.toml` (that file only holds
bindings/config) - so if this worker is ever redeployed from scratch, these need to be
set explicitly, since there's nothing else in the repo that will tell you they're missing
(code guards them and fails silently rather than crashing):

- `GMAIL_APP_PASSWORD` — Gmail app password for `email.rivers.run@gmail.com`, used by
  `src/email.ts` to send the digest email. `api/` sends its own separate emails and
  needs its own independently-set copy of this same secret.
- `UNSUBSCRIBE_SECRET` — HMAC signing key for one-click unsubscribe tokens
  (`src/utils/unsubscribeToken.ts`). Rotating or losing this invalidates every
  unsubscribe link already sent in past digest emails.
- `USGS_API_KEY` (optional) — raises USGS API rate limits; the worker falls back to
  unauthenticated USGS requests if unset.

Set with `wrangler secret put <NAME> --config api-flow/wrangler.toml`, always passing
`--config` explicitly. This repo has multiple `wrangler.toml`/`wrangler.jsonc` files
(this one, `api/wrangler.toml`, and the root `wrangler.jsonc` for the frontend static
site); `wrangler` does not reliably resolve to the one matching your current directory,
so an unqualified `wrangler secret put` can silently land on the wrong Worker.

## Commands

Lint and test from the repository root (`npm run lint`, `npm test`). Within this
workspace: `npm run dev` (wrangler dev, port 8787), `npm run deploy`.
