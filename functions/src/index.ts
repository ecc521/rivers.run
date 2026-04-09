import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

const gmailPassword = defineSecret("GMAIL_PASSWORD");

import { loadSitesFromUSGS } from "./services/usgs";
import { loadCanadianProvince } from "./services/canada";
import { processNotifications } from "./services/notifications";

// Initialize Firebase Admin seamlessly (uses default credentials inside the function environment)
initializeApp({
    storageBucket: "rivers-run.appspot.com" // Needs to match your actual bucket if different!
});

const db = getFirestore();
const bucket = getStorage().bucket();

export const pullGaugeDataPeriodic = onSchedule({
    schedule: "every 15 minutes",
    timeoutSeconds: 300,
    memory: "256MiB", // Reverted to 256MB to fix OOM
    secrets: [gmailPassword]
}, async () => {
    console.log("Starting gauge sync protocol...");

    // 1. Fetch all unique gauges from the active rivers in Firestore
    const snapshot = await db.collection("rivers").get();
    
    const usgsSet = new Set<string>();
    const canadaProvincesSet = new Set<string>();

    snapshot.forEach(doc => {
        const river = doc.data();
        if (river.gauges && Array.isArray(river.gauges)) {
            river.gauges.forEach((g: any) => {
                const id = g.id || "";
                if (id.startsWith("USGS:")) usgsSet.add(id.replace("USGS:", ""));
                else if (id.startsWith("canada:")) canadaProvincesSet.add(id.replace("canada:", "")); // In legacy canada handles gauge parsing dynamically from Province
            });
        }
    });

    const activeUsgsGauges = Array.from(usgsSet);
    const activeCanadaGauges = Array.from(canadaProvincesSet);

    console.log(`Discovered ${activeUsgsGauges.length} active USGS gauges and ${activeCanadaGauges.length} Canada targets.`);

    // 2. Extrapolate provinces from Canadian gauges
    // Canadian gauge codes are often the Province prefix (ex: BC_something). We strip the province physically.
    const provinces = new Set<string>();
    activeCanadaGauges.forEach(code => {
        if (code.length > 2) {
             const prov = code.substring(0, 2).toUpperCase(); // e.g. "BC", "ON"
             if (["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"].includes(prov)) {
                 provinces.add(prov);
             }
        }
    });

    // 3. Kick off async network pulls concurrently
    console.log("Initiating highly concurrent network fetch...");
    const flowData: any = {};

    const [usgsData, ...canadaProvinceData] = await Promise.all([
        loadSitesFromUSGS(activeUsgsGauges, 1000 * 60 * 60 * 3), // Exact 3 hour bound matching legacy!
        ...Array.from(provinces).map(prov => loadCanadianProvince(prov))
    ]);

    // 4. Merge results deeply
    // Append the legacy prefix universally to map correctly on frontend again!
    for (const [key, value] of Object.entries(usgsData)) {
        flowData["USGS:" + key] = value;
    }

    canadaProvinceData.forEach((provData: any) => {
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
    
    try {
        await file.makePublic();
    } catch {
        console.warn("Non-fatal: makePublic IAM assertion blipped, file is likely already publicly inheriting.");
    }

    // 7. Process legacy email notifications using the natively synthesized payload map
    console.log("Analyzing configured alerts exclusively against newly tracked limits...");
    try {
        await processNotifications(flowData);
    } catch (e) {
        console.error("Non-fatal evaluation crash inside notification dispatcher", e);
    }

    console.log("Gauge synchronization successfully terminated.");
});

export const notifyAdminsOnReviewQueue = onDocumentCreated("reviewQueue/{docId}", async (event) => {
    const queueData = event.data?.data();
    if (!queueData) return;

    console.log(`Intercepted natively new Review Queue submission: ${queueData.name}`);

    const db = getFirestore();
    const adminQuery = await db.collection("users")
        .where("isAdmin", "==", true)
        .where("notifications.reviewQueueAlerts", "==", true)
        .get();

    if (adminQuery.empty) return;

    const userIDs = adminQuery.docs.map(doc => ({ uid: doc.id }));
    const authResult = await getAuth().getUsers(userIDs);
    const emails = authResult.users.map(u => u.email).filter((e): e is string => !!e);

    if (emails.length === 0) return;

    try {
        await db.collection("mail").add({
            to: emails,
            message: {
                subject: `New rivers.run Edit Submission: ${queueData.name}`,
                text: `A paddler has structurally submitted an edit or creation mapping for: ${queueData.name}.\n\nYou can natively review, interactively explicitly toggle dual-pane diffs, and deploy the configuration natively here:\nhttps://rivers.run/admin`
            }
        });
        console.log(`Successfully dispatched Queue Alerts to ${emails.length} implicitly configured admins.`);
    } catch (e: any) {
        console.error("Non-fatal: Failed mapping queue alerts dynamically", e.message);
    }
});
