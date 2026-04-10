# Rivers.run Backend Architecture & Sync Protocol

## Current Implementation vs. Intended Structure

The backend structure uses a highly optimized "Delta Sync" architecture to minimize Firestore read costs and ensure rapid client load times. 

Here is how the system currently aligns with your intended structure:

### Every 24 Hours
*   ✅ **Sync user notification settings:** Handled implicitly. The 15-minute polling loop checks the `updatedAt` header on `private/alertdata.json` inside Firebase Storage. If it is older than 24 hours, it triggers a forced "Full Sync" that downloads all configured users from scratch to garbage-collect stale/deleted accounts.
*   ✅ **Sync `riverdata.json`:** Handled exactly the same way via `public/riverdata.json`. Every 24 hours, the 15-minute loop forces a full reset to gather all rivers and ensure any formally deleted rivers are purged from the cache.
*   ✅ **Back up the database:** Handled via the standalone `scheduledFirestoreExport` function that runs via cron `every day 02:00`.

### Every Week
*   ❌ **If it's Monday, sync the gauge list from USGS:** **Missing.** Currently, `virtualGauges.json` is a statically compiled JSON file bundled with your Cloud Functions at deploy time. There is no automated weekly function pulling from the master USGS site list.

### Every 15 Minutes (The `pullGaugeDataPeriodic` Loop)
*   ✅ **Fetch live flow data and create `flowdata3.json`:** Successfully implemented. The function pulls live flows concurrently via `loadSitesFromUSGS` and `loadCanadianProvince`, injects the `virtualGauges.json` metadata, compresses the payload natively with GZIP, and saves it.
*   ✅ **Patch notification settings based on update:** Successfully implemented. If the storage file is younger than 24 hours, it performs a strict targeted delta sync: `db.collection("users").where("updatedAt", ">", lastCompileMs)`. It then splices only the recently touched users directly into the running cache.
*   ✅ **Patch `riverdata.json` based on updates:** Successfully implemented. It queries `db.collection("rivers").where("updatedAt", ">", lastCompileMs)` to selectively override patched rivers in the JSON cache.
