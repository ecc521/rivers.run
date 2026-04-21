# Rivers.run

**Rivers.run** is a highly resilient, offline-first Progressive Web App (PWA) designed specifically for whitewater kayakers, rafters, and paddlers. It natively consolidates user-curated river descriptions, rapid characteristics, and access points alongside heavily optimized live streamgage data from the USGS (United States Geological Survey) and the Meteorological Service of Canada.

## Why it Exists
When you're paddling deep in a river gorge or traversing a remote forested access road, cell service is historically non-existent. Rivers.run is fundamentally architected to overcome this: it aggressively caches river bounds, topographical map tiles, flow graphs, and user favorites directly to local device storage. If you load the app up before you leave internet service, the entire application remains fully functional and instantly accessible even offline in the wilderness.

## Architecture

The project has recently undergone a massive migration to a modern, fully serverless architecture designed for extreme cost efficiency and zero-latency CDN payload delivery.

### Frontend (SPA)
- **Vite + React (TypeScript):** Blazing fast interactive map interfaces and optimized builds.
- **Capacitor:** Seamless cross-compilation into native Android/iOS shells.
- **PWA Service Workers:** Robust resource caching for offline gorge accessibility.

### Backend (Serverless)
- **Cloudflare D1 (SQLite):** Harmonizes the 464+ natively curated river descriptions and user-generated lists with SQL-backed integrity and edge-optimized latency.
- **Cloudflare Workers (Hono):** High-performance TypeScript API services built on Hono.
    - **`rivers-run-api`**: Handles core CRUD operations, user lists, and administrative data review.
    - **`api-flow`**: An isolated, unbound worker that polls and cleanses global gauge telemetry from agency APIs (USGS, Canada, UK, OPW) on a 15-minute `CronTrigger`.
- **Cloudflare R2 (Storage):** Processed gauge telemetry and historical datasets are persisted to R2 buckets, serving as a highly-available, low-cost origin for the global CDN.
- **Firebase Auth:** Persisted as the primary identity provider. Authentication tokens are verified purely offline at the edge using Web Crypto within the Cloudflare Workers.

## Development

### Local Frontend Server
To spin up a local development environment for the web app:

```bash
# Install frontend dependencies
npm install

# Start the Vite local development pipeline
npm run dev
```

### Native Mobile Apps (iOS / Android)
The mobile apps wrap the compiled web assets using Capacitor. To build and test them locally:

```bash
# 1. Build the frontend web assets
npm run build

# 2. Sync the compiled assets and update native dependencies
npx cap sync

# 3. Open the native project IDE (or use 'npx cap run ios' to bypass the IDE entirely)
npx cap open ios
# OR npx cap open android
```

### Local Serverless Backend
To run and debug the serverless API workers locally:
```bash
# Core API (D1 + Auth)
cd api
npm install
npm run dev

# Flow/Gauge Polling API
cd api-flow
npm install
npm run dev
```

> [!TIP]
> Use `npx wrangler d1 execute rivers-run-db --local --file=./schema.sql` within the `api` directory to initialize a local SQLite instance for development.

## Deployment & CI/CD

## Deployment & CI/CD

The entire application stack is automatically deployed via GitHub Actions to Cloudflare:

### Cloudflare Pages (Frontend)
The frontend web application is automatically built and deployed as a Cloudflare Pages project (using static assets) on every push to the `main` branch. 
- **Main Branch**: Merges to `main` trigger a full production build (`npm run build`) and deployment to the primary `rivers.run` domain.

### Cloudflare Workers (API)
The serverless backend services are also automatically deployed via the same CI/CD pipeline:
- **`rivers-run-api`**: The core API service located in the `/api` directory.
- **`api-flow`**: The gauge data polling and processing service located in the `/api-flow` directory.

Deployments are managed via Wrangler and the `cloudflare/wrangler-action` in GitHub Actions.

## Community Administration
User submissions, edits, and gauge curation updates are directed to a `reviewQueue` within the Cloudflare D1 database. 
Registered Admins can authenticate via Firebase and access the `Admin Tools` navigation portal securely within the SPA to seamlessly merge or reject incoming community datasets via the `rivers-run-api`.
