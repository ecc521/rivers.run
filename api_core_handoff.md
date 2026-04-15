# API-Core Migration Handoff Document

Welcome! You are taking over the migration of the core platform APIs (`api-core`) and React UI wiring. 
The infrastructure has already been perfectly scaffolded and authenticated. 

## What is already done:
1. **The D1 Database is LIVE**: Cloudflare D1 `rivers-db` is physically provisioned and `api/wrangler.toml` is dynamically bound to it.
2. **Schema is active**: `api/schema.sql` was executed on the remote database. The strict tables (`rivers`, `river_gauges`, `river_audit_log`, `community_lists`) are ready for data.
3. **Decoupled Flow Data**: We explicitly isolated the 15-minute gauge scraping engine into its own separate worker (`api-flow`) to keep `api-core` extremely fast and strictly focused on database/user logic. 

## Your Tasks:

### 1. Scaffold the D1 Endpoint Router ( inside `api/` )
Use something incredibly lightweight like `hono` to scaffold the `src/index.ts` worker in the `api` directory.
- `GET /rivers`: Execute `SELECT * FROM rivers` (with JOINs to gauges and access points) and return the full JSON blob. Use extreme `Cache-Control` max-age headers so the CDN eats the bandwidth.

### 2. Implement Write Capabilities & Audit Logging
- `POST /rivers` or `PUT /rivers/:id`: 
  - **CRITICAL: Validate the payload against strict max limits.** Every field must be capped to prevent DB bloat:
    - **TOTAL PAYLOAD SIZE**: Reject any request body larger than **50kB** outright.
    - `name`, `section`: Max 100 characters.
    - `altname`: Max 150 characters.
    - `states`: Max 50 characters.
    - `class`: Max 20 characters.
    - `writeup`: Max 25,000 characters.
    - `tags`: Limit to 10 strings (Max 20 chars per string).
    - `gauges`: Limit to 10 objects. Each internal string/property (e.g., `gauge.id`) must be strictly capped at 50 chars.
    - `accessPoints`: Limit to 50 items (names max 100 chars, descriptions max 500).
    - Throw an explicit HTTP 400 error cleanly showing the user which field failed the validation.
  - Construct an `UPDATE` onto the `rivers` table.
  - Calculate the delta between the old DB state and the new payload instantly on the backend.
  - Explicitly `INSERT` the resulting `diff_patch` into the `river_audit_log` table to establish the Revision History.

### 3. Wire the Frontend
- Refactor the React application's `src/hooks/useRivers.ts`. Find the legacy Firebase Storage JSON URL, and replace it with your newly created `/rivers` endpoint.

### 4. Live Data Migration Script
- Create a temporary Node.js script located in `scripts/migrateFiretoD1.ts`.
- Attach the `firebase-admin` SDK to pull all 6,000 legacy rivers and community lists.
- Map the unstructured NoSQL payloads into the strict format dictated by `api/schema.sql`.
- Push them to D1 (you can use Cloudflare's HTTP API, or run raw SQL generation locally and use `npx wrangler d1 execute`).

Good luck!
