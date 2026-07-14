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

## 3. Caching & Return Signatures

- Endpoints return statically shaped `{ [gaugeId]: { readings: [...] } }` payloads that
  mirror the legacy Firebase Storage JSON keys, so the frontend `useRivers.ts` hook
  needs no adaptation. Preserve this shape when editing flow payloads in `src/index.ts`.
- Responses set `Cache-Control` (e.g. `max-age=300`, stale-while-revalidate) and support
  conditional 304 responses. Processed data is persisted to the R2 `flowdata` bucket.
- The sync includes a resiliency pass: if a gauge fails to fetch (e.g. USGS partial
  outage), previous readings are recovered from the existing `sitedata.json` so the
  payload never regresses to empty.

## 4. Required Secrets

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
