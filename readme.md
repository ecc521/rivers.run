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
- **Firebase Firestore:** Synchronizes the 464+ natively curated river descriptions seamlessly. Security rules guarantee pristine datasets protected from unauthorized overrides.
- **Firebase Functions (Gen 2):** Pure TypeScript Edge-Cached polling structures perfectly throttle memory. Utilizing a strict 15-minute PubSub Chron scheduler mapped tightly to 128MiB containers, Rivers.run streams, chunks, and serializes massive CSV/JSON API blobs from the USGS and Canada entirely async in the background. 
- **Google Cloud Storage (CDN):** The parsed gauge telemetry (`flowdata3.json`) is deposited to an exposed Cloud CDN edge bucket, fully divorcing the Frontend's load times from external API limits or legacy Express Node restrictions. Computation cost drops essentially to $0.00.

## Development

To spin up a local development environment:

```bash
# Install frontend dependencies
npm install

# Start the Vite local development pipeline
npm run dev
```

To run and debug the serverless pipeline (Cloud Functions) locally:
```bash
# Install backend dependencies
cd functions
npm install

# Build Typescript functions
npm run build
```

## Community Administration
User submissions, edits, and gauge curation updates are directed to a `reviewQueue` in Firestore. 
Registered Admins can authenticate and access the `Admin Tools` navigation portal securely natively within the SPA to seamlessly merge/reject incoming community topological datasets.

**Note:** _All legacy Node Express `server/` cron scripts and Google Drive filesystem parsing routines have been strictly permanently completely retired._
