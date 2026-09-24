# Design: First-Party Flow History Store

**Status:** implemented (behind the `FLOW_DB` binding; unbound = legacy path)
**Owner:** api-flow
**Goals:** (1) on-server flow history as the substrate for prediction *inference*,
(2) stop re-fetching data we already have, (3) one source of truth whose latency
and availability we control.

**Retention:** 30 days, **all gauges** — linked and registry alike.

---

## 1. Where we are today

`api-flow` is a stateless proxy with one derived artifact:

| Path | Behavior today |
| --- | --- |
| `scheduled` (`*/15`) | `performDataSync` fetches **3 h** of history for *linked* gauges and **latest-only** for *registry* gauges, merges into `sitedata.json`, writes to R2. |
| `GET /flowdata` | Streams `sitedata.json` from R2. Bulk bootstrap + offline cache. |
| `GET /history?days=28` | **Live provider fetch on every call.** `useDynamicFlow` hits this on every river-detail view. |
| `GET /gauge/{prefix}/{id}` | Live provider fetch, 6 h window. |

Nothing historical is retained. A 28-day window is re-pulled from USGS every time
a user opens a river page. The 15-minute sync discards everything older than 3
hours. The "resiliency pass" in `api-flow/src/index.ts:341` — recovering readings
from the previous `sitedata.json` — exists precisely because there is no durable
store to fall back on.

### Measured scale (production `/flowdata`, 2026-08-01)

```
sitedata.json                    3.4 MB
total gauges                     15,861
  USGS  8,947   UK  3,816   EC  2,627   IE  459   NWS  9
gauges with >= 1 reading         14,646
mean readings per gauge           1.15      <-- essentially latest-only

rivers in D1                        481
distinct linked gauge ids           230   (215 USGS, 8 NWS, 1 EC)
```

Sampled USGS reporting cadence: **~90 observations/gauge/day** for `00060`
(i.e. genuine 15-minute reporting; one sampled site was hourly).

---

## 2. Empirical findings that shape the design

All measured live against `api.waterdata.usgs.gov/ogcapi/v0`, 2026-08-01.

### 2.1 USGS revision detection works — `last_modified` on `/continuous`

The `continuous` collection exposes a queryable **`last_modified`** ("the last
time a record was refreshed in our database"). It is a true incremental cursor,
and it **caught a real revision during testing**. Over a 24 h `last_modified`
window across 10 sample gauges:

| Gauge | Records | Interpretation |
| --- | --- | --- |
| 8 of 10 | ~192 each | Exactly the new 24 h (96 × 2 params) |
| USGS-01578310, -01646500 | 576 each | ~3 days re-touched |
| **USGS-03451500** | **6,999** | **Records back to 2026-05-21 rewritten** |

A plain `datetime` window would have missed that 70-day rewrite entirely.

USGS warns `last_modified` also changes on routine refreshes, so it is a
**superset** of real revisions — the safe direction. We re-upsert and diff to log
which changes were substantive.

### 2.2 …but `last_modified` does NOT scale past a couple dozen sites

This is the constraint that determines the whole tiering. Same 20-minute
`last_modified` window, varying batch size:

| Sites per request | Latency | Result |
| --- | --- | --- |
| 10 | 2.6 s – 13 s | 20 records |
| 25 | 48 s | 59 records |
| 50 | 50 s | 155 records |
| 100 | — | server-cancelled |
| 200 | 60 s+ | `InvalidQuery: Long running query has been cancelled` |
| *global, no site filter* | 60 s+ | 0 records — does not work |

Latency is driven by site count, not payload size, and is highly variable
(the same 10-site query measured 2.6 s and 13 s minutes apart). Compare a plain
`datetime` query at the same batch size: **0.7 s**.

**Conclusion:** `last_modified` is viable for ~230 linked gauges (23 batches of
10), and completely unviable for 15,861. It needs a timeout and a `datetime`
fallback even at tier A.

### 2.3 The registry fetch is already bulk — history is nearly free

The decisive finding. Every provider's `getLatest` is already a bulk call, and
**we already make all of these requests every 15 minutes**:

| Provider | Gauges | Mechanism | Requests/cycle |
| --- | --- | --- | --- |
| USGS | 8,947 | `latest-continuous`, 200 ids/batch, **0.95 s** each | ~45 |
| UK | 3,816 | **one** URL — `/flood-monitoring/data/readings?latest=true` | 1 |
| EC | 2,627 | one **hourly CSV per province** | ~13 |
| IE | 459 | one bulk station fetch | 1 |
| | | | **~60 total** |

Storing 30 days for all 15,861 gauges therefore costs **zero additional
fetching**. The only new cost is D1 writes and storage.

Better still: **Environment Canada's province CSVs are `*_hourly_hydrometric.csv`
and already contain ~6+ hours of readings per station** — `getLatest` parses that
whole window and throws away everything but the last row
(`api-flow/src/services/canada.ts:181`). Simply keeping what we already download
gives Canada gap-proof history for free.

### 2.4 Secondary USGS signals

- **`time-series-revisions`** — formal post-approval revisions with
  `revision_note`, `begin`, `end`. No queryable for *publication* date, so new
  ones are detected by tracking seen `id`s. Most are historical (1979, 2017–2024)
  and fall outside 30 days, making this a cheap daily cross-check and audit
  trail rather than the primary mechanism.
- **`approval_status`** — `"Provisional"` / `"Approved"` on every observation.
  Worth persisting: it tells inference how much to trust a point, and the
  Provisional→Approved transition is itself a revision signal.

---

## 3. Architecture

```
                    ┌──────────── every 15 min ─────────────┐
  TIER A (230 linked)                                       │
  USGS /continuous + last_modified cursor ──┐               │
  EC/UK/IE/NWS trailing window ─────────────┤               │
                                            ├──► upsert ──► │  D1: flow-db
  TIER B (15,631 registry)                  │               │  gauge_readings
  ~60 bulk getLatest calls ─────────────────┘               │  gauges (dimension)
  (already happening today — keep every                     │  gauge_sync_state
   reading returned, not just the newest)                   │  usgs_revisions_seen
                    └───────────────────┬───────────────────┘
                                        │
                   ┌────────────────────┴──────────────────┐
                   ▼                                       ▼
      project latest → R2 sitedata.json           GET /history reads D1
      (unchanged shape: /flowdata, offline        (was: live provider fetch)
       bootstrap, notifications untouched)
```

### 3.1 Both tiers get 30 days; they differ only in *how* they are kept fresh

| | Tier A — linked (230) | Tier B — registry (15,631) |
| --- | --- | --- |
| Fetch | `/continuous` + `last_modified`, 10/batch | existing bulk `getLatest`, ~60 requests |
| Gap-free? | **Yes** — cursor re-reads anything missed | USGS/UK/IE: no. EC: yes (hourly CSV) |
| Revisions? | **Yes** | No |
| Backfill | Yes, on rollout | No — accumulates organically over 30 days |
| Extra fetch cost | ~23 requests/cycle | **zero** |

Tier B needs no backfill. It starts empty and reaches full depth in 30 days,
which is fine: these gauges have *no* history today, so any accumulation is
strictly an improvement. Tier A gets a real backfill because inference depends
on it (§3.6).

### 3.2 Use a **separate** D1 database

Add `flow-db`, bound as `FLOW_DB` in `api-flow/wrangler.toml` only. Keep the
existing `DB` → `rivers-db` binding for the gauge list and the
digest/unsubscribe pipeline.

- **A D1 database is single-threaded.** A ~15k-row write burst every 15 minutes
  against `rivers-db` would contend directly with live user CRUD from `api/`.
- Preserves the isolation `api-flow/AGENTS.md` calls out as a design value.
- Independent size and growth budget — this is the only unboundedly-growing data
  we have.
- We never need to `JOIN` rivers to readings; the sync already reads the gauge
  list from `rivers-db` in application code.

### 3.3 Schema — surrogate integer gauge key matters at this scale

At ~40M rows, storing `'USGS:03451500'` as TEXT on every row costs ~500 MB in
the key alone. A dimension table cuts row width roughly in half.

```sql
-- Dimension: one row per known gauge. Also defines tier.
CREATE TABLE IF NOT EXISTS gauges (
    gauge_key    INTEGER PRIMARY KEY AUTOINCREMENT,
    gauge_id     TEXT NOT NULL UNIQUE,   -- normalized, 'USGS:03451500'
    provider     TEXT NOT NULL,
    tier         TEXT NOT NULL DEFAULT 'registry',  -- 'linked' | 'registry'
    name TEXT, section TEXT, state TEXT, country TEXT,
    lat REAL, lon REAL, nwm_reach_id TEXT,
    updated_at   INTEGER
);

-- Fact table. WITHOUT ROWID clusters physically by (gauge_key, ts), so
-- "30 days for one gauge" is a single sequential range scan.
CREATE TABLE IF NOT EXISTS gauge_readings (
    gauge_key    INTEGER NOT NULL,
    ts           INTEGER NOT NULL,   -- ms epoch, snapped to 5-min buckets
    cfs REAL, ft REAL, cms REAL, m REAL, temp_f REAL, precip_in REAL,
    approved     INTEGER NOT NULL DEFAULT 0,  -- 0 provisional, 1 approved
    src_modified INTEGER,            -- provider last_modified, ms
    PRIMARY KEY (gauge_key, ts)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS gauge_sync_state (
    gauge_key       INTEGER PRIMARY KEY,
    cursor_modified INTEGER,          -- last_modified watermark (tier A USGS)
    last_obs_ts     INTEGER,          -- newest reading stored
    coverage_start  INTEGER,          -- oldest reading (backfill progress)
    obs_count_24h   INTEGER,          -- for gap detection (§3.5)
    last_success_at INTEGER,
    fail_count      INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT
);

CREATE TABLE IF NOT EXISTS usgs_revisions_seen (
    revision_id TEXT PRIMARY KEY,
    gauge_id TEXT, begin_ts INTEGER, end_ts INTEGER,
    note TEXT, first_seen_at INTEGER, applied_at INTEGER
);
```

No secondary index on `ts`: pruning runs per gauge and rides the primary key
(§3.5). Follow the `api/migrations/` convention — one dated, idempotent `.sql`
file, all statements `IF NOT EXISTS`.

### 3.4 Sizing — it fits inside D1's included quotas

14,646 active gauges × ~90 obs/day × 30 days ≈ **39.5 M rows**.

| Axis | Estimate | D1 Paid plan | Verdict |
| --- | --- | --- | --- |
| Rows stored | ~40 M | — | |
| Storage | **~1.6 GB** (≈40 B/row) | 5 GB included, then $0.75/GB-mo | ✅ ~32% |
| Rows written/mo | 14.6k × 96 × 30 ≈ **42 M** | **50 M included**, then $1.00/M | ⚠️ ~85% |
| Rows read/mo | 28.8k per `/history` call | 25 **billion** included | ✅ trivial |
| DB size limit | 1.6 GB | 10 GB max | ✅ 16% |

**Both storage and writes land inside the included quotas — this is effectively
free.** The one number to watch is rows written: at 85% of the 50 M allowance
there is little headroom for registry growth. Overage is mild ($1/M — 60 M would
cost ~$10/mo), and the pressure-release valve is downsampling tier B to 30-minute
or hourly resolution, which buys 2–4× instantly. A 30-day chart cannot render
2,880 points meaningfully anyway. Recommend shipping at full resolution and
downsampling only if the quota is actually crossed.

### 3.5 Write path — the details that matter at 15k rows/cycle

**D1 caps a query at 100 bound parameters**, which makes naive multi-row inserts
useless (~10 rows/statement). Pass the batch as **one JSON parameter** and unpack
it in SQLite — `json_each` is available in D1 (verified against the production
database):

```sql
INSERT INTO gauge_readings
      (gauge_key, ts, cfs, ft, cms, m, temp_f, precip_in, approved, src_modified)
SELECT j.value->>'$.k', j.value->>'$.t',
       j.value->>'$.cfs', j.value->>'$.ft', j.value->>'$.cms', j.value->>'$.m',
       j.value->>'$.tf',  j.value->>'$.pi', j.value->>'$.a', j.value->>'$.lm'
  FROM json_each(?1) j
ON CONFLICT(gauge_key, ts) DO UPDATE SET
       cfs = excluded.cfs, ft = excluded.ft, cms = excluded.cms, m = excluded.m,
       temp_f = excluded.temp_f, precip_in = excluded.precip_in,
       approved = excluded.approved, src_modified = excluded.src_modified;
```

One bound parameter regardless of batch size. The bound value is not part of the
SQL text, so the 100 KB statement limit does not apply; chunk to ~500 KB of JSON
per statement (well under the 2 MB max value size) and combine with `DB.batch()`.

`ON CONFLICT DO UPDATE` is what makes this whole design work: ingest is fully
idempotent, re-polling costs nothing, and a revised reading simply overwrites the
old one.

**Sort each batch by `(gauge_key, ts)` before inserting.** The table is clustered
on that key, so a sorted batch walks the B-tree monotonically instead of
thrashing 15k scattered pages. This is the single most important performance
detail in the ingest path.

**Pruning: rotate, don't bulk-delete.** `DELETE WHERE ts < ?` would need a
secondary index on `ts` (which on a `WITHOUT ROWID` table duplicates the full PK,
costing ~30% more storage) and would still scan ~40 M rows against a 30-second
query limit. Instead, prune a rotating **1/96th slice of gauges each cycle**
(~155 gauges), using `DELETE FROM gauge_readings WHERE gauge_key = ? AND ts < ?`
— which rides the primary key. Every gauge gets pruned once per day, the work is
evenly spread, and no extra index is needed.

**Gap detection and selective repair.** Because `getLatest` returns each
observation's own timestamp, we always know exactly which samples we hold. Track
`obs_count_24h` per gauge; a daily job re-fetches a `datetime` window only for
gauges whose count is anomalously low. Since only a small fraction should ever
need repair, this stays cheap — and it turns tier B's gap-proneness from a
permanent defect into a self-healing one.

### 3.6 Ingest algorithm

**Tier A, USGS (215 gauges → 22 batches of 10), per cycle:**

1. Read `cursor_modified` per gauge; take the batch minimum.
2. Query `/continuous` with `last_modified={min_cursor − 5 min}/..`. The overlap
   absorbs clock skew and late writes.
3. Drop anything outside the 30-day horizon, then upsert (§3.5).
4. Advance each gauge's cursor to its `max(last_modified)` minus a 60 s safety lag.
5. Wrap in `withTimeout`; on timeout or a stale/null cursor, fall back to a plain
   `datetime` window covering the gap (4× faster, predictable result size).
6. **Cap records per gauge per cycle** — the 6,999-record backfill in §2.1 is
   real. If the cap trips, ingest what fits, log it, and leave the cursor
   un-advanced so the next cycle resumes from the same point.

**Tier B (15,631 gauges), per cycle:** run the existing bulk `getLatest` calls
unchanged, but **keep every reading returned rather than only the newest**. For
EC, widen the CSV parse window from 6 h to 24 h — same download, more data
retained. Upsert; the PK dedupes.

**Daily maintenance:** rotating prune slice; `obs_count_24h` gap repair; poll
`time-series-revisions` and, for any unseen revision whose `[begin, end]`
overlaps the retained window, force a `datetime` re-fetch of exactly that range.

### 3.7 Serving

`GET /history` becomes a store read with a live fallback:

1. Look up requested gauges in `gauges`. Stored → `SELECT ... WHERE gauge_key IN
   (...) AND ts >= ? ORDER BY gauge_key, ts`. The existing 10-gauge request cap
   keeps this inside the 100-parameter limit.
2. Unknown gauges → existing live provider path, unchanged.
3. **Response shape is byte-for-byte identical** — `{ [gaugeId]: { readings: [...] } }`
   with the same `toUnitSystemHistory` conversion. `useDynamicFlow.ts` needs no
   changes.

Additions:

- **`?since=<ms>`** — return only readings newer than a timestamp.
  `useDynamicFlow` already merges by `dateTime` into a `Map`, so the client can
  hold its 28-day window and pull ~15 minutes of delta on refresh.
- **ETag** from `max(ts)` + row count, so repeat views 304. Consistent with the
  existing `ETag`/`exposeHeaders` work on `/flowdata`.

`GET /flowdata` and `sitedata.json` **do not change** — the sync projects the
latest reading per gauge out of D1. PWA bootstrap, offline cache, service-worker
broadcast and notifications are untouched.

Once D1 is authoritative, the resiliency pass at `api-flow/src/index.ts:341-358`
can be deleted: a failed provider fetch no longer loses readings.

### 3.8 Backfill (tier A only)

30 days × 230 gauges. A 24 h `datetime` window for 10 sites is ~2.2 MB / 2,622
records, so 30 days per batch would be ~66 MB — too much for one invocation.

Chunk to 3 days × 10 gauges (~8 MB), ~10 chunks per batch, 23 batches ≈ 230
requests. Drive it from a resumable job with its cursor in
`gauge_sync_state.coverage_start`, a few batches per cron tick, so it survives
Worker CPU limits and is safe to re-run. Restrict to `00060,00065` to halve the
payload; temp/precip fill in going forward.

---

## 4. Cycle budget — is the loop fast?

Yes. Per 15-minute tick:

| Stage | Requests | Wall clock (concurrency 4) |
| --- | --- | --- |
| Tier B fetch (**unchanged from today**) | ~60 | ~20 s |
| Tier A fetch (`last_modified`) | 23 | ~15–75 s (variable) |
| D1 upsert ~15k sorted rows | — | ~5–15 s |
| Rotating prune (155 gauges) | — | < 1 s |
| **Total** | | **well inside one invocation** |

The fetch work is essentially what already runs today. The variable component is
tier A's `last_modified` batches (§2.2), bounded by `withTimeout` with a
`datetime` fallback.

Meanwhile the cost that *disappears* is the large one: today every river-detail
view triggers a live 28-day USGS fetch. That becomes a D1 range scan.

---

## 5. What this buys us

| Goal | Effect |
| --- | --- |
| **(1) Inference substrate** | 30 days of readings for **all 15,861 gauges**, with `approved` and `src_modified` provenance. |
| **(2) Less fetching** | River-detail view: 28-day USGS fetch → D1 range scan. Sync: "3 h × 230 gauges" → only what changed. With `?since=`, clients transfer ~15 min of delta instead of 28 days. |
| **(3) One controlled source** | `/history` latency is ours. Provider outages stop being user-visible — the store keeps serving and backfills on the next good cycle. |
| **Correctness** | USGS revisions detected and applied, which is not true today at all. |

---

## 6. What shipped

All of it, gated on the `FLOW_DB` binding — with it absent the worker runs the
original stateless path unchanged, so this is inert until the database exists.

| Area | Files |
| --- | --- |
| Schema | `api-flow/migrations/2026-08-01_flow_history_store.sql` |
| Store layer | `api-flow/src/services/flowStore.ts` |
| Tier A ingest | `api-flow/src/services/usgsIncremental.ts` |
| Orchestration + projection | `api-flow/src/services/flowSync.ts` |
| Revision ledger | `api-flow/src/services/usgsRevisions.ts` |
| Bulk-history hooks | `getLatestHistories` on `usgs.ts`, `canada.ts` |
| Serving | `/history`, `/gauge/{prefix}/{id}` in `api-flow/src/index.ts` |
| Client delta | `src/utils/flowDelta.ts`, `src/hooks/useDynamicFlow.ts` |
| Test harness | `api-flow/src/__tests__/helpers/d1Sqlite.ts` (real SQLite behind D1's interface) |

**Deployment is a two-step the repo cannot do for you** — `wrangler.toml` carries
a placeholder id:

```
npx wrangler d1 create flow-db
# paste the id into api-flow/wrangler.toml, then:
npx wrangler d1 execute flow-db --remote --config api-flow/wrangler.toml \
  --file api-flow/migrations/2026-08-01_flow_history_store.sql
```

No separate backfill job was needed. Cold gauges take the `datetime` path
automatically and `MAX_COLD_GAUGES_PER_CYCLE` drains them a few per cycle, so
the cursor mechanism *is* the resumable backfill.

### Corrections found by testing, not by design

Three things in the plan above were wrong and were caught before shipping:

1. **`readLatestAll` full-scanned the fact table.** The claim that a correlated
   `MAX(ts)` would seek was false — SQLite drove from `gauge_readings` and
   scanned it. Measured at 500k rows: 166ms scanning vs 2.5ms with a `CROSS
   JOIN` pinning the join order. The scan grows with total readings, so at ~40M
   rows it would have been ~11s every 15 minutes against a 30s query limit.
   There is now a test asserting the plan contains no `SCAN r`.
2. **Cold-start batching would have OOM'd the cron.** Batch size has to scale
   with the query window, not be constant: 10 never-synced gauges over 30 days
   is ~300 site-days (~78k features, ~66MB) in one request. Hence
   `MAX_SITE_DAYS` and `batchSizeForWindow`.
3. **The per-cycle record cap could stall a gauge forever.** Holding the cursor
   when the cap trips is right for a cursor sweep (it drains a rewrite) but
   fatal on a `datetime` cold start: the window is fixed, so the gauge would
   re-fetch 30 days every cycle, keep the newest N, and never go warm. Found
   live on USGS-01646500 — a 5-minute gauge (288 readings/day) whose 30-day
   backfill was silently truncated to 10 days by a 3,000 cap.

Forecasts stay on the live path throughout — they must be fresh, they are cheap,
and they have different semantics from observations. Persisting forecast
*issuances* (keyed by `issued_at`) so model skill can be scored against what was
actually forecast at the time is a genuinely useful follow-on, but not required.

---

## 7. Tests

**349 passing** from the repository root (`npm run lint` clean, `npm test`), up
from 181 before this work.

Store tests run the real SQL against an in-memory `node:sqlite` database rather
than a mock, because the design leans on non-obvious SQLite behavior —
`json_each` unpacking, `WITHOUT ROWID` clustering, `ON CONFLICT` with COALESCE
preservation, and `IN (subquery)` compiling to index seeks. The harness also
enforces D1's 100-bound-parameter limit, so a query that would fail in
production fails in tests.

- **Batching:** the `json_each` builder stays within the 100-parameter limit for
  a 15,000-reading batch; chunking splits at the size bound; batches are emitted
  sorted by `(gauge_key, ts)`.
- **Idempotency:** ingesting the same payload twice yields identical rows.
- **Revision:** a changed value for an existing `(gauge_key, ts)` overwrites and
  bumps `src_modified`.
- **Cursor:** advances to `max(last_modified) − lag`; does **not** advance when
  the per-cycle cap trips; falls back to `datetime` when stale or on timeout.
- **Tier B retention:** EC's 24 h CSV window yields multiple rows per station,
  not just the newest.
- **Prune:** the rotating slice covers every gauge exactly once per 96 cycles and
  deletes strictly beyond the horizon.
- **Gap repair:** a gauge with a depressed `obs_count_24h` is selected for
  repair; a healthy one is not.
- **Serving:** `/history` returns the identical payload shape for stored gauges,
  falls back to live for unknown ones, merges a mixed request correctly, and
  honors `?since=`.
- **Guardrail:** the observed 6,999-record single-gauge response is handled
  without blowing memory or the cap.

---

## 8. Resolved / remaining

**Resolved.**
- Retention: **30 days**, all gauges. This is inference, not training.
- Registry gauges: **included**, full 30 days. Fetch cost is zero (§2.3) and it
  fits D1's included quotas (§3.4).
- `streambeam:` — removed; drop on sight. `virtual:`/`VIRTUAL:` — gone, and
  future custom gauges will be model-derived rather than scraped. Neither gets a
  `gauges` row; filter both out during ingest. (Both still appear in the live
  `sitedata.json`, so the filter is load-bearing today.)

**Remaining.**
1. **Gauge-id casing.** `rivers.gauges` contains `usgs:`, `nws:`, `VIRTUAL:`
   alongside canonical uppercase. `normalizeGaugeId` handles it at read time, and
   `gauges.gauge_id` is `UNIQUE` on the normalized form — but a one-time cleanup
   of the source rows would remove a standing footgun.
2. **Tier B resolution.** Ship at full 15-minute resolution (85% of the write
   quota) or downsample to 30-minute up front (43%)? Recommend full resolution;
   downsampling is a one-line change if the quota is ever crossed.
