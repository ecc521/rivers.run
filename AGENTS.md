# Rivers.run

Rivers.run is an offline-first PWA for whitewater paddlers (kayakers, rafters). It
consolidates user-curated river descriptions and access points with live streamgage
data (USGS, Environment Canada, UK, Ireland/OPW, NWS). **Offline access is a core
requirement** — assume users may load the app before losing cell service deep in a
river gorge, so caching and graceful offline behavior matter. Do not assume users
have technical knowledge.

## Repository Layout

This is an npm workspaces monorepo. The three TypeScript services share the root
toolchain and are linted/tested together:

- **`src/`** — Vite + React (TypeScript) frontend SPA. Wrapped into native iOS/Android
  shells via Capacitor and served as a PWA with service-worker caching.
  - `components/`, `pages/`, `hooks/` (e.g. `useRivers.ts`, `useDynamicFlow.ts`),
    `context/`, `services/`, `locales/` (i18next), `firebase.ts`.
- **`api/`** — `rivers-run-api` Cloudflare Worker (Hono). Core CRUD, user lists, admin
  review. Backed by Cloudflare D1 (SQLite) + Firebase Auth. See [api/CLAUDE.md](api/CLAUDE.md).
- **`api-flow/`** — `api-flow` Cloudflare Worker. Isolated gauge-telemetry scraping and
  CORS proxying; no auth layer. Its digest/unsubscribe email pipeline is the one exception
  that reads/writes `users` in D1 directly. See [api-flow/CLAUDE.md](api-flow/CLAUDE.md).
- **`applewatch/`** — standalone native watchOS (Swift) project with its own git repo.
  See [applewatch/CLAUDE.md](applewatch/CLAUDE.md).

Processed gauge data is persisted to Cloudflare R2 (`flowdata` bucket); river/list data
lives in D1 (`rivers-db`). Firebase is the identity provider, verified offline at the
edge with Web Crypto (no `firebase-admin`).

Required Cloudflare Worker secrets per service are documented in each service's
AGENTS.md (`api/AGENTS.md`, `api-flow/AGENTS.md`) — the root `wrangler.jsonc` (frontend
static site) needs none. Always pass `--config <path-to-wrangler.toml>` explicitly on
`wrangler secret`/`deploy` commands — this repo has three separate Wrangler configs, and
`wrangler` does not reliably resolve to the one matching your current directory.

## Commands

Run from the **repository root** (npm workspaces):

```bash
npm run dev      # Vite frontend dev server
npm run build    # tsc -b && vite build (+ OTA bundle postbuild)
npm run lint     # tsc -b && eslint . && jscpd duplication check
npm test         # vitest run (covers web, api, api-flow)
```

## Preflight Checks

Agents MUST verify their work before ending a session. Always run `npm run lint` and
`npm test` from the **root directory** so regressions or quality warnings in any
sub-service (web, api, api-flow) are caught. The watchOS project is verified separately
— see [applewatch/CLAUDE.md](applewatch/CLAUDE.md).
