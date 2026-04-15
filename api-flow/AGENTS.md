# Flow Parsing Engine Guidelines (api-flow)

This isolated Worker boundary exclusively handles heavy hydro-data scraping. It physically does NOT contain authentication layers or database user queries. 

## 1. CORS Proxying & Network Constraints
*   Requests to `.csv` or external Agency structures (like Canada) are proxies served back to the React UI physically to bypass browser CORS origin bounds. 
*   **Constraint:** You must never accept a raw, unbounded historical data fetch parameter. E.g., heavily clip `days={range}` history to 30 days max to prevent the proxy from crashing into massive CSV datasets.

## 2. Cron Operations
*   The worker scrapes and synchronizes gauge states on a 15-minute `CronTrigger`.
*   This explicitly leverages Cloudflare's `usage_model = "unbound"` declaration inside `wrangler.toml`, granting the Cron task up to 15 physical wall-clock minutes.
*   Never install massive parsing dependencies (like `csv-parser`); use native string-splitting logic for execution speed.

## 3. Caching & Return Signatures
*   Endpoints generally return statically shaped `[gaugeId]: { readings: [] }` footprints strictly mapped to prevent the React `useRivers.ts` hook from needing adaptation. 
*   If updating `index.ts` flow payloads, natively mirror the legacy Firebase Storage JSON keys!
