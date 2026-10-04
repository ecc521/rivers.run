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
`src/services/` (USGS, Canada, UK, Ireland, NWS, USACE, FIMAN).

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

`wrangler.toml` declares four cron triggers, dispatched by `event.cron` in the
`scheduled` handler:

- `*/15 * * * *` — gauge-state polling every 15 minutes.
- `0 0 * * *` — daily maintenance.
- `0 0 * * 5` — weekly full registry recompilation (Friday; `0 0 * * 0` Sunday is used
  in tests).
- `10 * * * *`: the hourly forecast model run (see "Forecast model" below). It does
  nothing else and is skipped when `FLOW_MODEL` is unbound.

Note: there is **no** `usage_model = "unbound"` in `wrangler.toml`. Cloudflare Workers
Standard Pricing now applies extended limits to cron fetch loops automatically, so do
not re-add it.

## 3. Flow History Store (`FLOW_DB`)

Up to 30 days of observations accumulated through routine ingest live in `flow-db`, a D1 database kept separate
from `rivers-db` so ingest never contends with user CRUD. The binding is optional in
code: unbound, the worker uses the old stateless path (`performDataSync`). Schema:
`migrations/2026-08-01_flow_history_store.sql`, applied to the production database on
2026-09-24. To recreate it from scratch, create the database, put its id in
`wrangler.toml`, then apply the migration:

```bash
npx wrangler d1 create flow-db
npx wrangler d1 execute flow-db --remote --config api-flow/wrangler.toml --file api-flow/migrations/2026-08-01_flow_history_store.sql
```

**Hourly ring buffer.** `gauge_reading_hours` has one row per (gauge, hour),
with `slot = floor(ts / 1h) mod 768` (32 days). Each nullable `q0`–`q3` JSON
array retains one 15-minute reading as `[off, cfs, ft, cms, m, temp_f, precip_in]`.
A new hour lap clears the previous lap's quarters, so retention needs no DELETEs.
Within a quarter, the closest reading wins and missing parameters are filled as before.
`gauge_reading_slots` expands the quarters for readers, retaining the original slot
start and source offset. Queries constrain its physical `hour_slot` so SQLite seeks
the hourly primary key before expanding readings. Served timestamps remain
`ts + off` rounded to 5 minutes. All reads filter to the 30-day horizon.

Before deploying this Worker, use `tools/hourly-migration.mjs` to apply
`migrations/2026-10-02_hourly_flow_history.sql` in bounded batches.
It seeds only the most recent eight days of old readings into hourly rows and retains the original
`gauge_readings` table untouched for rollback. Reapplying it cannot overwrite
new hourly data. The old table is an archive after cutover, not a live read path;
removing it is a separate maintenance decision. The `hourly_seed_from` metadata
key freezes the eight-day copy boundary; coverage and repair markers are clamped to
that boundary so older requests use the provider. Pause ingest and drain in-flight
cycles before copying and switching the Worker. Cron changes can take 15 minutes
to propagate; wait for propagation and completion of the last active cycle.

The migration runner copies 20 gauges per query through the legacy primary key,
verifies every retained quarter and numeric field with symmetric `EXCEPT`, and
checkpoints `hourly_copy_through` after each verified batch. API calls are paced
350 ms apart, with bounded retries honoring `Retry-After` on rate limits or server
errors. It verifies all batches
again before changing coverage, then writes `hourly_migration_complete`. A failed
run resumes without rewriting verified hours. The `--report` path saves original
sync state for rollback; keep it outside the checkout. Do not run the migration
again after new hourly ingest begins: old readings become stale.

```bash
node api-flow/tools/hourly-migration.mjs --remote --paused \
  --account <account-id> --database <flow-db-id> \
  --oauth-config <wrangler-oauth-config> --report <artifact-path>
```

Use `--local-file <sqlite-path>` instead of remote credentials to rehearse. Only
push `main` after the production copy and coverage verification pass. The existing
GitHub workflow deploys the Worker and restores the configured cron triggers.
If deployment fails before the Flow Worker switches, restore saved coverage and
cron triggers before returning to old ingest. After new ingest begins, rollback
must reconcile new hourly observations into the old table before reverting.

`upsertSlots` groups all quarters of a gauge-hour before splitting bounded JSON
batches. Four new observations or four revisions in one batch cost one row write;
separate provider pages or later cycles may still update that hour again. This
preserves bounded ingest memory and every 15-minute value, without downsampling.

**Guarded writes.** D1 bills rows written, so every upsert (`flowStore.ts`) has a
`WHERE` that makes an unchanged row a no-op. Replaying a batch must write 0 rows;
tests assert this. `gauge_sync_state` and `sync_meta` are also only written on change.
Bulk writes pass one JSON parameter through `json_each` (D1 allows 100 bound
parameters). Reads use `CROSS JOIN` plus an hour-slot range so they seek the primary key.

**Ingest** (`flowSync.ts`, `usgsIngest.ts`), on the `*/15` trigger only (the daily
and weekly crons also fire at 00:00 and must not start a second ingest):

- USGS, all registry gauges, 200 sites per request: a `datetime=<now-2h>/..` window
  sweep every cycle; an hourly revision sweep (`last_modified` since a global cursor,
  bounded by `datetime=<now-8d>/..`, cursor advanced only if every batch completed);
  and backfill (failed windows first, then eight days of prediction history) chunked to 100 site-days
  per request. Pages are upserted as they arrive. Backfill and revisions stop when
  `X-RateLimit-Remaining` falls below 300; a revision sweep also stops at 120 pages,
  and a cursor more than a day old becomes datetime repair. A failing backfill group
  is split; a lone failing site backs off (`fail_count`, `retry_at`). No automatic
  history fill or revision repair extends beyond eight days (192 hours, shared with
  the model snapshot). When an unresolved gap ages out, coverage moves forward past
  that gap before repair is bounded. Continuous older history remains usable and
  grows naturally up to 30 days; history requests outside coverage fetch live from
  the provider and do not persist an on-demand backfill.
  `FLOW_BACKFILL_MAX_REQUESTS` caps backfill requests per cycle (default 100).
- EC, NWS: the whole province file or gauge series, one unit at a time
  (`getBulkHistories`); EC parses only readings from 3h before its last success
  (6h on a first run; `bulkSince`), since whole province files blow the 128 MB limit. A failed unit marks its gauges for repair; coverage is set per
  gauge from its earliest reading and restarts after a gap longer than the unit
  holds. NWS forecast rows go to `sitedata.json`, never the store. NWS gauges that no
  river links are the exception: latest only, never stored (`UNLINKED_LATEST_ONLY_PROVIDERS`;
  see "NWS map listing").
- UK, IE: latest-only bulk calls; river-linked gauges also fetch 3h of history.
  UK is fetched every cycle but stored only on the hourly cycle (`isHourlyCycle`),
  one reading per gauge per hour, to save D1 writes. `sitedata.json` takes UK
  readings from the fetch, falling back to the store.
- USACE, FIMAN: latest-only like UK, but never stored (`FETCH_ONLY_PROVIDERS`). See
  "USACE dams" and "FIMAN" below.

`/history` and `/gauge` serve from the store only when `gauge_sync_state` says it
covers the whole request with no pending repair (USGS after backfill, EC/NWS from
first sight, never UK/IE) and the provider ingested within 45 minutes. Otherwise
they fetch live. With `forecast=true`, stored gauges fetch only forecasts live.
`sitedata.json` is written before the hourly model snapshot is built.

Known gaps, not yet handled:

- A value USGS deletes stays stored: upserts never null a column, and a missing
  record is indistinguishable from an unchanged one.
- The legacy `approved` column remains only in the archived `gauge_readings` table.
  Hourly storage has no approval field; ingest neither requests nor stores approval status.

### USACE dams (`services/usace.ts`)

Two gauges per dam. `USACE:<district>.<code>` (e.g. `USACE:LRH.Summersville`,
"Summersville Lake (Outflow)") has release as `cfs`, the river stage just below the
dam ("Stage Tailwater", about 140 dams) as `ft`, and the district's projected releases
as forecast rows (`forecastSource: "USACE"`). `USACE:<district>.<code>.Lake` ("... (Lake
Level)") has pool elevation as `ft`; the frontend labels it "Lake Level" and gives it
no map marker, since it sits on the outflow gauge.

- Latest values for every dam come from one request to the Access2Water reporting
  API (`water.usace.army.mil/cda/reporting/providers/projects?fmt=geojson`), the
  undocumented API behind the public USACE site. That is the whole per-cycle cost.
- `/history` fetches release and elevation history (capped at 7 days) from the same
  API, and projected releases from the CWMS Data API. Both go through the Cloudflare
  cache for 10 minutes (`edgeCachedJson`): windows are rounded to the quarter hour so
  viewers of a dam share one entry, and a clean copy is stored because the reporting
  API's session cookie keeps Cloudflare from caching the subrequest itself.
- The daily cron (or any cron when it is missing) rebuilds `usace/sites.json` in R2:
  each dam's series ids, plus its projected-release series where one exists (about
  120 of 590 dams; many districts publish none). Forecast names differ by district,
  so candidates come from each office's catalog and must show data past now. The
  catalog's own `last-update`/`latest-time` extents are not maintained reliably and
  are never used, and `/timeseries/recent` returns a database error for some series,
  so a failed batch is checked per series.
- A registry without any `USACE:` entries gets them on the next cron instead of
  waiting for the weekly recompile.

### NWS map listing (`services/nws.ts`)

Besides the gauges rivers link, the registry lists NWS gauges as standalone map markers
for NC (`MAP_BOXES`, `MAP_STATES`; add a box and state to cover another region).

- NWPS has no usable unbounded gauge list (it times out), but `GET /gauges?bbox...`
  returns every gauge in a box with its latest observation: stage, flow (kcfs, on
  about a quarter of them), time, flood category. About 1 MB per box; it is shared
  through the Cloudflare cache. That one request per cycle is all unlinked NWS gauges
  cost. `getLatest` answers from it, and nothing is stored or predicted for them:
  graphs fetch the gauge's own series (20 to 30 days, 0.5 to 1 MB) when opened.
- The listing (`refreshNwsListing`, `gaugeRegistry.ts`) keeps gauges observed in the
  last 3 days, drops tidal ones (named by water body or "in MLLW") and lake or dam
  elevations (`isRiverStageFt`), then drops any within 300 m of a USGS registry entry
  or whose USGS site (`usgsId`) is in the registry. The bulk list lacks `usgsId`, so it
  is looked up per gauge once and kept on the registry entry (`null`: none; a failed
  lookup stays unset and is retried). Gauges that rivers link are added regardless.
- Rebuilt with the weekly recompile and daily. A registry that already holds linked
  NWS gauges gets the listing at the next daily cron, not at once. FIMAN is listed
  after NWS and drops gauges within 300 m of an NWS entry.

### FIMAN (`services/fiman.ts`)

NC Flood Inundation Mapping and Alert Network (`fiman.nc.gov`): NCEM, NCDOT, county and
town stage gauges, `FIMAN:<siteId>` (ids are strings such as `1850`, `1835B`, `CHAN7`).
Stage only, in `ft`; flow exists only on USGS-owned sites, which the USGS provider serves.
Registered gauges become standalone map markers like any other provider's, so the
registry holds two groups: the map listing and any gauges rivers link.

- **Map listing** (`refreshFimanListing`, `gaugeRegistry.ts`): `isMapEligible` keeps
  in-service, inland gauges not owned by USGS or by the Town of Cary (urban storm drains) with a stage of -10 to 40 ft (above that
  is a lake or dam elevation) and a reading in the last 7 days. Then `dropCoveredSites`
  drops any within 300 m of a USGS or NWS registry entry (the USGS listing is active
  sites only; NWS is listed first, see "NWS map listing"). 300 m was chosen by comparing stage series: true twins correlate at 0.98 or
  more, and nothing between 300 m and 1 km did. The listing is rebuilt with the weekly
  recompile, daily, and whenever the registry has no FIMAN entries.
- **Linked gauges** are added to the listing without those filters, so a river's gauge
  is never dropped.
- Unlinked gauges get their latest value from one request to `/api/gaugefeatures` per
  cycle; linked gauges fetch 3 hours of history each, through the cache. History
  is `/api/gauges/<siteId>` (about 30 days), as elevation above sea level; the provider
  subtracts the offset implied by the gauge's own current elevation and stage. Both go
  through the Cloudflare cache (`utils/edgeCache.ts`).
- All times are Eastern local time with no zone, including `hydroAllDate`, which is
  labeled `Z` but is when FIMAN polled the gauge. The reading time is `lastUpdate`
  ("Oct  4 2026  2:31PM"); `easternToUtcMs` converts and treats the repeated November
  hour as EDT.
- The site's Cloudflare rules return 403 to curl's default user agent. Requests carry
  `DEFAULT_HEADERS` (the Flow Bot user agent); from a laptop that only worked over
  HTTP/1.1. If the Worker starts seeing 403s, check that first. Some sensors report only
  every 2 to 4 hours, so they show as stale between readings.

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
in log space). A full snapshot is about 30 MB of JSON, 8 to 10 MB gzipped. The hourly store
retains one reading per 15-minute quarter, so a full hour has 4. The last hour is the
current one and is partial. Sentinels (`<= -999999`) are excluded. Every registry USGS
gauge is listed, even with no data. In Python:
`np.array(snap["discharge_cfs"], dtype=float)` turns `null` into `nan`.

### Forecast model (`FLOW_MODEL` container, `services/flowModel.ts`)

The model runs in a Cloudflare Container, one instance, started by the `10 * * * *`
cron (after the `:00` cycle has written the snapshot). Its image is built in the
flow_predictions repo (`serving/`) and pushed to Cloudflare's registry, so a deploy
(including CI) needs no Docker. To ship a new model image, from flow_predictions:

```bash
docker build --platform linux/amd64 -f serving/Dockerfile -t flow-serving:<commit> .
npx wrangler containers push flow-serving:<commit>
```

then set `image` in `wrangler.toml` to the pushed `registry.cloudflare.com/...` reference.
A pass takes about 1 to 3 minutes and writes to R2 under `model/`. The Worker explicitly
destroys the container after consuming the run response (also on request failure), so
the instance does not accrue memory and disk charges between hourly runs. Destruction
uses SIGKILL because the image's Python server is PID 1 and does not handle SIGTERM. Its
one-minute idle timeout uses the same destruction path as a fallback.

The container has no R2 credentials. It does plain HTTP to `http://flow.r2/<key>`,
answered by the class's outbound handler from `FLOW_STORAGE`: reads anywhere under
`model/`, writes only under `model/weather/`, `model/ratings/` and `model/forecasts/`. This needs
`ContainerProxy` exported from `index.ts`.

Outputs, overwritten each pass: `model/forecasts/latest.json.gz` (every gauge),
`summary.json`, and 256 shards `shards/<xx>.json.gz`. A site's shard is FNV-1a 32 of its
site number mod 256 (`shardOf`, identical to `serving/run.py`). `GET /forecast?gauges=`
reads the shards (up to 20 ids, forecasts older than 24 h omitted); entries carry
`ft10/ft50/ft90` stage where the gauge has a USGS rating. Format in flow_predictions
`serving/README.md`. An `NWS:` id gets the forecast of the USGS gauge it sits on (entry
adds `usgsSite`), from `model/nws_usgs.json`: river-linked NWS gauges to their NWPS
`usgsId`, rebuilt from the registry and linked gauges by the daily cron (or any cron when missing). A
request never calls NWPS or writes R2.

Local: `wrangler dev` cannot start the container on OrbStack (its egress proxy sidecar
exits with `setsockoptint: protocol not available`). Run api-flow with
`npx wrangler dev -c api-flow/wrangler.toml --enable-containers=false --local-upstream localhost:8787`
and the container with `docker run`, pointing `SERVING_STORAGE` at
`http://host.docker.internal:8787/__model-storage/model` (a local-only route over
the same handler; it and `/seed-local-r2` need `LOCAL_DEV_ROUTES=1` in `.dev.vars`) and `SERVING_SNAPSHOT` at `.../model/usgs_hourly.json.gz`; then
`curl -X POST localhost:8080/run`.

### Memory budget

A Worker isolate has 128 MB. The registry (about 17k gauges) and the cycle's own state
leave roughly 50 MB for everything else that is alive at once, and the hourly model
snapshot (about 30 MB of JSON) is the largest single consumer. A bulk provider is a
response body held as text and again as a parsed object, so it costs up to twice its size.

Measured with `tools/heap-probe.mjs` (parsed objects retained):

| Payload | Size | Retained |
|---|---|---|
| FIMAN feed, all 882 gauges | 1.7 MB | 1.4 MB |
| NWS bounding box (NC, about 1,070 gauges) | 1.0 MB | 0.9 MB |
| One FIMAN gauge history | 0.1 MB | about 0.2 MB |
| The registry as an object | | about 5 MB |

Rules for providers:

- Keep only the fields you use (`fetchFeed`, `fetchMapGauges`) and drop the response.
- Bound fan-out with `forEachLimited` (`utils/concurrency.ts`) so memory held at once
  tracks the limit, not the gauge count. A FIMAN gauge's response holds 30 days of
  history, but ingest keeps 3 hours, so hold the filtered readings and drop the rest
  before starting the next gauge.
- Request counts, not memory, are what grow with linked gauges: each linked FIMAN gauge
  is one cached request per cycle. A river can link at most 10 gauges
  (`MAX_GAUGES_PER_RIVER`), matching the 10 per `/history` request.
- A new bulk source should be measured before it ships:

```bash
node --expose-gc api-flow/tools/heap-probe.mjs                       # fetches live (FIMAN may need saved files, see the script header)
node --expose-gc api-flow/tools/heap-probe.mjs --fiman feed.json --gauge gauge.json --nws box.json --histories 100
```

  Nationwide NWS (an estimated 15 to 20 MB per cycle across 15 to 25 box requests) is
  the case to measure first; process boxes one at a time and keep only needed fields.

## 4. Caching & Return Signatures

- Endpoints return statically shaped `{ [gaugeId]: { readings: [...] } }` payloads that
  mirror the legacy Firebase Storage JSON keys, so the frontend `useRivers.ts` hook
  needs no adaptation. Preserve this shape when editing flow payloads in `src/index.ts`.
- Responses set `Cache-Control` (e.g. `max-age=300`, stale-while-revalidate) and support
  conditional 304 responses. Processed data is persisted to the R2 `flowdata` bucket.
- The sync includes a resiliency pass: a gauge with no recent reading keeps its
  readings from the existing `sitedata.json`, so the payload never regresses to empty.

## 5. Email (Cloudflare Email Sending)

Digest email goes out through the `EMAIL` `send_email` binding as
`notifications@rivers.run` (`src/email.ts`); `api/` has its own binding for admin
notices. Setup that lives outside the repo: onboard `rivers.run` under Email Sending in
the dashboard, and create the `email-events` queue (`npx wrangler queues create email-events`)
before deploying, since `wrangler.toml` declares this worker as its consumer. Subscribe
the queue to the sending domain's events in the dashboard.

- Sends run 10 at a time. A failed send retries an hour later instead of skipping the
  user's day; a suppressed recipient (`E_RECIPIENT_SUPPRESSED`) is not retried.
- `services/emailEvents.ts` consumes bounce and complaint events and sets
  `users.notifications_enabled = 0` for hard bounces and complaints only. Soft bounces
  (full mailbox, throttling) never disable anyone.

## 6. Required Secrets

Cloudflare Worker secrets are never listed in `wrangler.toml` (that file only holds
bindings/config) - so if this worker is ever redeployed from scratch, these need to be
set explicitly, since there's nothing else in the repo that will tell you they're missing
(code guards them and fails silently rather than crashing):

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
