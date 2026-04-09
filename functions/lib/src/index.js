"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pullGaugeDataPeriodic = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const usgs_1 = require("./services/usgs");
const canada_1 = require("./services/canada");
// Initialize Firebase Admin seamlessly (uses default credentials inside the function environment)
(0, app_1.initializeApp)({
    storageBucket: "rivers-run-project.appspot.com" // Needs to match your actual bucket if different!
});
const db = (0, firestore_1.getFirestore)();
const bucket = (0, storage_1.getStorage)().bucket();
exports.pullGaugeDataPeriodic = (0, scheduler_1.onSchedule)({
    schedule: "every 15 minutes",
    timeoutSeconds: 300,
    memory: "128MiB" // Strictly enforced 128MB bound as requested
}, async (event) => {
    console.log("Starting gauge sync protocol...");
    // 1. Fetch all unique gauges from the active rivers in Firestore
    const snapshot = await db.collection("rivers").get();
    const usgsSet = new Set();
    const canadaProvincesSet = new Set();
    snapshot.forEach(doc => {
        const river = doc.data();
        if (river.gauges && Array.isArray(river.gauges)) {
            river.gauges.forEach((g) => {
                const id = g.id || "";
                if (id.startsWith("USGS:"))
                    usgsSet.add(id.replace("USGS:", ""));
                else if (id.startsWith("canada:"))
                    canadaProvincesSet.add(id.replace("canada:", "")); // In legacy canada handles gauge parsing dynamically from Province
            });
        }
    });
    const activeUsgsGauges = Array.from(usgsSet);
    const activeCanadaGauges = Array.from(canadaProvincesSet);
    console.log(`Discovered ${activeUsgsGauges.length} active USGS gauges and ${activeCanadaGauges.length} Canada targets.`);
    // 2. Extrapolate provinces from Canadian gauges
    // Canadian gauge codes are often the Province prefix (ex: BC_something). We strip the province physically.
    const provinces = new Set();
    activeCanadaGauges.forEach(code => {
        if (code.length > 2) {
            const prov = code.substring(0, 2).toUpperCase(); // e.g. "BC", "ON"
            if (["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].includes(prov)) {
                provinces.add(prov);
            }
        }
    });
    // 3. Kick off async network pulls concurrently
    console.log("Initiating highly concurrent network fetch...");
    const flowData = {};
    const [usgsData, ...canadaProvinceData] = await Promise.all([
        (0, usgs_1.loadSitesFromUSGS)(activeUsgsGauges, 1000 * 60 * 60 * 3), // Exact 3 hour bound matching legacy!
        ...Array.from(provinces).map(prov => (0, canada_1.loadCanadianProvince)(prov))
    ]);
    // 4. Merge results deeply
    // Append the legacy prefix universally to map correctly on frontend again!
    for (const [key, value] of Object.entries(usgsData)) {
        flowData["USGS:" + key] = value;
    }
    canadaProvinceData.forEach((provData) => {
        // Appends any raw gauge IDs discovered in the CSV that match our active list
        for (const [key, value] of Object.entries(provData)) {
            if (activeCanadaGauges.includes(key)) {
                flowData["canada:" + key] = value;
            }
        }
    });
    flowData.generatedAt = Date.now();
    console.log(`Assembly complete. Total Gauges Synchronized: ${Object.keys(flowData).length - 1}`);
    // 5. Build minified JSON payload
    const jsonStr = JSON.stringify(flowData);
    // 6. Push buffer stream to Firebase Storage
    console.log(`Writing payload to Firebase Storage public/flowdata3.json (${(jsonStr.length / 1024).toFixed(2)} KB)`);
    const file = bucket.file("public/flowdata3.json");
    await file.save(jsonStr, {
        metadata: {
            contentType: "application/json",
            // Extremely aggressive public CDN caching policy to prevent storage read spikes
            cacheControl: "public, max-age=900, s-maxage=900"
        }
    });
    // Make public so Vite SPA can hit it natively without Auth headers
    await file.makePublic();
    console.log("Gauge synchronization successfully terminated.");
});
//# sourceMappingURL=index.js.map