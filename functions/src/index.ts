import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

const gmailPassword = defineSecret("GMAIL_PASSWORD");

import { loadSitesFromUSGS } from "./services/usgs";
import { loadCanadianProvince, CanadianProvinceData } from "./services/canada";
import { processNotifications } from "./services/notifications";
import { syncRiverDataToStorage } from "./services/riverdata";
import { compileGaugeRegistryToStorage } from "./services/gaugeRegistry";
import * as zlib from "zlib";

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
    await executeGaugeSync();
});

/**
 * DEVELOPMENT UTILITY: manualSyncRivers
 * Bypasses scheduling restrictions to sync riverdata manually.
 */
export const manualSyncRivers = onCall({
    timeoutSeconds: 300,
    memory: "256MiB"
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to trigger this function.");
    }
    const userDoc = await db.collection("user").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.isAdmin !== true) {
        throw new HttpsError("permission-denied", "You must be an admin to trigger this function.");
    }

    try {
        await syncRiverDataToStorage(db, bucket);
        return { success: true, message: "River database natively synchronized.", timestamp: Date.now() };
    } catch (e: unknown) {
        console.error("Crucial manual synchronization explicit pipeline crashed:", e instanceof Error ? e.message : e);
        throw new HttpsError("internal", "Sync fundamentally failed.");
    }
});

async function executeGaugeSync() {
    console.log("Starting gauge sync protocol...");

    // 1. Sync riverdata.json using the exact Delta scheme to avoid unnecesssary reads!
    const activeRivers = await syncRiverDataToStorage(db, bucket);
    
    // 2. Fetch all unique gauges natively from the explicitly merged baseline memory 
    const usgsSet = new Set<string>();
    const canadaProvincesSet = new Set<string>();

    activeRivers.forEach(river => {
        if (river.gauges && Array.isArray(river.gauges)) {
            river.gauges.forEach((g: any) => {
                const id = g.id || "";
                if (id.startsWith("USGS:")) usgsSet.add(id.replace("USGS:", ""));
                else if (id.startsWith("canada:")) canadaProvincesSet.add(id.replace("canada:", ""));
            });
        }
    });

    let gaugeRegistry: Record<string, {name: string, lat: number, lon: number}> = {};
    try {
        const file = bucket.file("public/gaugeRegistry.json");
        let buffer: Buffer;

        try {
            [buffer] = await file.download();
        } catch (downloadErr: unknown) {
            const err = downloadErr as any; // Cast temporarily for legacy google API properties
            const statusCode = err.code || err.status || (err.response && err.response.status);
            
            if (statusCode === 404 || (err.message && err.message.includes("No such object"))) {
                console.warn("No gaugeRegistry.json discovered in Storage; skipping compilation to protect the 15-minute sync layer. Admin must manually compile.");
                buffer = Buffer.from("{}");
            } else {
                throw err; // Rethrow native network/IAM errors
            }
        }

        try {
            const decomp = zlib.brotliDecompressSync(buffer);
            gaugeRegistry = JSON.parse(decomp.toString('utf-8'));
        } catch {
            gaugeRegistry = JSON.parse(buffer.toString('utf-8'));
        }
        
        Object.keys(gaugeRegistry).forEach(id => {
            if (id.startsWith("USGS:")) usgsSet.add(id.replace("USGS:", ""));
            else if (id.startsWith("canada:")) canadaProvincesSet.add(id.replace("canada:", ""));
        });
        console.log(`Successfully merged ${Object.keys(gaugeRegistry).length} static gauge registry natively from Firebase Storage!`);
    } catch (e: unknown) {
        console.error("Non-fatal: Could not pull virtual Gauges json from Storage natively.", e instanceof Error ? e.message : e);
    }

    const activeUsgsGauges = Array.from(usgsSet);
    const activeCanadaGauges = Array.from(canadaProvincesSet);

    console.log(`Discovered ${activeUsgsGauges.length} active USGS gauges and ${activeCanadaGauges.length} Canada targets.`);

    // 2. Extrapolate provinces from Canadian gauges
    // Canadian gauge codes are often the Province prefix (ex: BC_something). We strip the province physically.
    const provinces = new Set<string>();
    const validProvinces = new Set(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]);
    activeCanadaGauges.forEach(code => {
        if (code.length > 2) {
             const prov = code.substring(0, 2).toUpperCase(); // e.g. "BC", "ON"
             if (validProvinces.has(prov)) {
                 provinces.add(prov);
             }
        }
    });

    // 3. Kick off async network pulls concurrently
    console.log("Initiating highly concurrent network fetch...");
    const flowData: Record<string, any> = {};

    const [usgsData, ...canadaProvinceData] = await Promise.all([
        loadSitesFromUSGS(activeUsgsGauges, 1000 * 60 * 60 * 3), // Exact 3 hour bound matching legacy!
        ...Array.from(provinces).map(prov => loadCanadianProvince(prov))
    ]);

    // 4. Merge results deeply
    // Append the legacy prefix universally to map correctly on frontend again!
    for (const [key, value] of Object.entries(usgsData)) {
        const fullId = "USGS:" + key;
        const v = value as any;
        if (gaugeRegistry[fullId]) {
            v.lat = gaugeRegistry[fullId].lat;
            v.lon = gaugeRegistry[fullId].lon;
            if (!v.name) v.name = gaugeRegistry[fullId].name; // USGS API name usually present, but just in case
        }
        flowData[fullId] = v;
    }

    canadaProvinceData.forEach((provData: CanadianProvinceData) => {
        // Appends any raw gauge IDs discovered in the CSV that match our active list
        for (const [key, value] of Object.entries(provData)) {
            if (canadaProvincesSet.has(key)) {
                const fullId = "canada:" + key;
                const v = value as any;
                if (gaugeRegistry[fullId]) {
                    v.lat = gaugeRegistry[fullId].lat;
                    v.lon = gaugeRegistry[fullId].lon;
                    if (!v.name) v.name = gaugeRegistry[fullId].name;
                }
                flowData[fullId] = v;
            }
        }
    });

    flowData.generatedAt = Date.now();
    console.log(`Assembly complete. Total Gauges Synchronized: ${Object.keys(flowData).length - 1}`);

    // 5. Build minified JSON payload and natively Brotli compress it
    const jsonStr = JSON.stringify(flowData);
    const zippedBuffer = zlib.brotliCompressSync(Buffer.from(jsonStr), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    
    // 6. Push buffer stream to Firebase Storage
    console.log(`Writing payload to Firebase Storage public/gauges.json (Uncompressed: ${(jsonStr.length / 1024).toFixed(2)} KB, Brotli: ${(zippedBuffer.length / 1024).toFixed(2)} KB)`);
    const file = bucket.file("public/gauges.json");

    await file.save(zippedBuffer, {
        metadata: {
            contentType: "application/json",
            contentEncoding: "br",
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
    } catch (e: unknown) {
        console.error("Non-fatal evaluation crash inside notification dispatcher", e instanceof Error ? e.message : e);
    }

    console.log("Gauge synchronization successfully terminated.");
}

export const notifyAdminsOnReviewQueue = onDocumentCreated("reviewQueue/{docId}", async (event) => {
    const queueData = event.data?.data();
    if (!queueData) return;

    console.log(`Intercepted natively new Review Queue submission: ${queueData.name}`);

    const db = getFirestore();
    const adminQuery = await db.collection("user")
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
    } catch (e: unknown) {
        console.error("Non-fatal: Failed mapping queue alerts dynamically", e instanceof Error ? e.message : e);
    }
});

export const manualSyncGaugeRegistry = onCall({
    timeoutSeconds: 540,
    memory: "512MiB"
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to trigger this function.");
    }
    const userDoc = await db.collection("user").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.isAdmin !== true) {
        throw new HttpsError("permission-denied", "You must be an admin to trigger this function.");
    }

    console.log("Starting manual USGS/Canada static gauge compilation...");
    const bucket = getStorage().bucket();
    await compileGaugeRegistryToStorage(bucket);
    console.log("Manual compilation completed securely.");
    return { success: true };
});

export const deleteLiveRiver = onCall({
    timeoutSeconds: 60,
    memory: "256MiB"
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to trigger this function.");
    }
    const userDoc = await db.collection("user").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.isAdmin !== true) {
        throw new HttpsError("permission-denied", "You must be an admin to trigger this function.");
    }

    const { riverId } = request.data;
    if (!riverId || typeof riverId !== "string") {
        throw new HttpsError("invalid-argument", "Valid River ID strictly required.");
    }

    const riverRef = db.collection("rivers").doc(riverId);
    const riverDoc = await riverRef.get();
    
    if (!riverDoc.exists) {
        throw new HttpsError("not-found", "River currently does not exist natively in the database.");
    }

    const riverData = riverDoc.data();
    const adminEmail = request.auth.token?.email || "Unknown Admin";

    try {
        await db.collection("mail").add({
            to: [adminEmail, "email.rivers.run@gmail.com"],
            message: {
                subject: `DELETION ALERT: River Component Removed - ${riverData?.name || riverId}`,
                text: `This river was deleted. The info prior to deletion is attached:\n\n${JSON.stringify(riverData, null, 2)}`
            }
        });
    } catch (e: unknown) {
        console.error("Non-fatal: Failed to log native river deletion email natively:", e instanceof Error ? e.message : e);
    }

    await riverRef.delete();
    console.log(`Explicitly deleted river natively: ${riverId} by admin ${adminEmail}`);

    return { success: true, message: "River permanently destroyed." };
});
