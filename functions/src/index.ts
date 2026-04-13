import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

const gmailPassword = defineSecret("GMAIL_PASSWORD");

import { loadSitesFromUSGS } from "./services/usgs";
import { loadSitesFromNWS } from "./services/nws";
import { loadCanadianProvince, CanadianProvinceData } from "./services/canada";
import { processNotifications } from "./services/notifications";
import { syncRiverDataToStorage } from "./services/riverdata";
import { compileGaugeRegistryToStorage } from "./services/gaugeRegistry";
import { syncListsToStorage } from "./services/lists";
import { generateSitemapToStorage } from "./services/sitemap";
import * as zlib from "zlib";
import * as nodemailer from "nodemailer";

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
 * Helper to verify Admin or SuperAdmin status from claims
 */
function verifyAdmin(auth: any) {
    if (!auth) throw new HttpsError("unauthenticated", "Auth required.");
    if (auth.token.banned === true) throw new HttpsError("permission-denied", "User is banned.");
    if (auth.token.admin !== true && auth.token.superAdmin !== true) {
        throw new HttpsError("permission-denied", "Admin or SuperAdmin role required.");
    }
}

/**
 * Helper to verify SuperAdmin status from claims
 */
function verifySuperAdmin(auth: any) {
    if (!auth) throw new HttpsError("unauthenticated", "Auth required.");
    if (auth.token.banned === true) throw new HttpsError("permission-denied", "User is banned.");
    if (auth.token.superAdmin !== true) {
        throw new HttpsError("permission-denied", "SuperAdmin role required.");
    }
}

async function logAdminAction(adminUid: string, adminEmail: string, action: string, targetUid: string, details?: any) {
    await db.collection("admin_logs").add({
        timestamp: Date.now(),
        adminUid,
        adminEmail,
        action,
        targetUid,
        details: details || {}
    });
}

/**
 * DEVELOPMENT UTILITY: manualSyncRivers
 * Bypasses scheduling restrictions to sync riverdata manually.
 */
export const manualSyncRivers = onCall({
    timeoutSeconds: 300,
    memory: "256MiB"
}, async (request) => {
    verifyAdmin(request.auth);

    try {
        const { activeRivers, runSitemap } = await syncRiverDataToStorage(db, bucket);
        if (runSitemap) await generateSitemapToStorage(activeRivers, bucket);
        await syncListsToStorage(db, bucket);
        await logAdminAction(request.auth!.uid, request.auth!.token.email || "unknown", "manualSyncRivers", "system");
        return { success: true, message: "Databases natively synchronized.", timestamp: Date.now() };
    } catch (e: unknown) {
        console.error("Crucial manual synchronization explicit pipeline crashed:", e instanceof Error ? e.message : e);
        throw new HttpsError("internal", "Sync fundamentally failed.");
    }
});

async function executeGaugeSync() {
    console.log("Starting gauge sync protocol...");

    // 1. Sync riverdata.json and lists.json using the exact Delta scheme to avoid unnecesssary reads!
    const { activeRivers, runSitemap } = await syncRiverDataToStorage(db, bucket);
    await syncListsToStorage(db, bucket);
    
    // 2. Fetch all unique gauges natively from the explicitly merged baseline memory 
    const usgsSet = new Set<string>();
    const canadaProvincesSet = new Set<string>();
    const nwsSet = new Set<string>();

    activeRivers.forEach(river => {
        if (river.gauges && Array.isArray(river.gauges)) {
            river.gauges.forEach((g: any) => {
                const id = g.id || "";
                if (id.startsWith("USGS:")) usgsSet.add(id.replace("USGS:", ""));
                else if (id.startsWith("canada:")) canadaProvincesSet.add(id.replace("canada:", ""));
                else if (id.startsWith("NWS:")) nwsSet.add(id.replace("NWS:", ""));
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
            else if (id.startsWith("NWS:")) nwsSet.add(id.replace("NWS:", ""));
        });
        console.log(`Successfully merged ${Object.keys(gaugeRegistry).length} static gauge registry natively from Firebase Storage!`);
    } catch (e: unknown) {
        console.error("Non-fatal: Could not pull virtual Gauges json from Storage natively.", e instanceof Error ? e.message : e);
    }

    const activeUsgsGauges = Array.from(usgsSet);
    const activeCanadaGauges = Array.from(canadaProvincesSet);
    const activeNwsGauges = Array.from(nwsSet);

    console.log(`Discovered ${activeUsgsGauges.length} active USGS gauges, ${activeNwsGauges.length} active NWS gauges, and ${activeCanadaGauges.length} Canada targets.`);

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

    const [usgsData, nwsData, ...canadaProvinceData] = await Promise.all([
        loadSitesFromUSGS(activeUsgsGauges, 1000 * 60 * 60 * 3), // Exact 3 hour bound matching legacy!
        loadSitesFromNWS(activeNwsGauges, 1000 * 60 * 60 * 3),
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

    for (const [key, value] of Object.entries(nwsData)) {
        const fullId = "NWS:" + key;
        const v = value as any;
        if (gaugeRegistry[fullId]) {
            v.lat = gaugeRegistry[fullId].lat;
            v.lon = gaugeRegistry[fullId].lon;
            if (!v.name) v.name = gaugeRegistry[fullId].name;
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
        await processNotifications(flowData, activeRivers);
    } catch (e: unknown) {
        console.error("Non-fatal evaluation crash inside notification dispatcher", e instanceof Error ? e.message : e);
    }

    if (runSitemap) {
        await generateSitemapToStorage(activeRivers, bucket);
    }

    console.log("Gauge synchronization successfully terminated.");
}

export const serveSitemap = onRequest({ timeoutSeconds: 30, memory: "256MiB" }, async (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    try {
        const file = bucket.file("public/sitemap.xml");
        const [exists] = await file.exists();
        if (!exists) {
            res.status(404).send("Sitemap not generated yet.");
            return;
        }
        const [buffer] = await file.download();
        res.set('Content-Type', 'application/xml');
        res.send(buffer);
    } catch (e: unknown) {
        console.error("Failed to proxy sitemap", e instanceof Error ? e.message : e);
        res.status(500).send("Proxy error");
    }
});

export const notifyAdminsOnReviewQueue = onDocumentCreated("reviewQueue/{docId}", async (event) => {
    const queueData = event.data?.data();
    if (!queueData) return;

    console.log(`Intercepted natively new Review Queue submission: ${queueData.name}`);

    const db = getFirestore();
    try {
    const userQuery = await db.collection("user")
        .where("notifications.reviewQueueAlerts", "==", true)
        .get();

    if (userQuery.empty) return;

    const userIDs = userQuery.docs.map(doc => ({ uid: doc.id }));
    const authResult = await getAuth().getUsers(userIDs);
    
    // Filter to ensure only authorized staff receive the alert
    const emails = authResult.users
        .filter(u => 
            u.customClaims?.admin === true || 
            u.customClaims?.superAdmin === true || 
            u.customClaims?.moderator === true
        )
        .map(u => u.email)
        .filter((e): e is string => !!e);

    if (emails.length === 0) return;

    } catch (e: unknown) {
        console.error("Non-fatal: Failed mapping queue alerts dynamically", e instanceof Error ? e.message : e);
    }
});

// --- ADMIN MANAGEMENT FUNCTIONS ---

export const adminLookupUser = onCall(async (request) => {
    verifyAdmin(request.auth);
    const { email, uid } = request.data;
    
    try {
        let user: any;
        if (email) user = await getAuth().getUserByEmail(email);
        else if (uid) user = await getAuth().getUser(uid);
        else throw new HttpsError("invalid-argument", "Email or UID required.");

        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            customClaims: user.customClaims || {},
            disabled: user.disabled,
            metadata: user.metadata
        };
    } catch (e: any) {
        throw new HttpsError("not-found", e.message);
    }
});

export const adminSetRole = onCall(async (request) => {
    const { targetUid, role } = request.data;
    if (!targetUid || !role) throw new HttpsError("invalid-argument", "Missing UID or role.");
    
    const validRoles = ["superAdmin", "admin", "moderator", "none"];
    if (!validRoles.includes(role)) throw new HttpsError("invalid-argument", "Invalid role type.");

    const auth = getAuth();
    
    // 1. Fetch target user to check current permissions (Hierarchy Protection)
    const targetUser = await auth.getUser(targetUid);
    const targetClaims = targetUser.customClaims || {};

    // 2. Enforce Hierarchy: Admins cannot touch SuperAdmins or other Admins
    if (targetClaims.superAdmin || targetClaims.admin) {
        verifySuperAdmin(request.auth);
    } else {
        verifyAdmin(request.auth);
    }

    // 3. Prevent promoting to SuperAdmin/Admin unless caller is SuperAdmin
    if (role === "superAdmin" || role === "admin") {
        verifySuperAdmin(request.auth);
    }

    // 4. Determine new claims
    const newClaims = { ...(targetClaims) };
    
    // Clear all existing admin roles first to ensure "drop to nothing" or clean swap
    delete newClaims.superAdmin;
    delete newClaims.admin;
    delete newClaims.moderator;

    if (role === "superAdmin") {
        newClaims.superAdmin = true;
        newClaims.admin = true;
        newClaims.moderator = true;
    } else if (role === "admin") {
        newClaims.admin = true;
        newClaims.moderator = true;
    } else if (role === "moderator") {
        newClaims.moderator = true;
    }
    // "none" leaves them all deleted

    await auth.setCustomUserClaims(targetUid, newClaims);
    
    await logAdminAction(request.auth!.uid, request.auth!.token.email || "unknown", `setRole:${role}`, targetUid);
    
    return { success: true, role };
});

export const adminBanUser = onCall(async (request) => {
    const { targetUid, banned } = request.data;
    if (!targetUid) throw new HttpsError("invalid-argument", "UID required.");

    const auth = getAuth();
    const user = await auth.getUser(targetUid);
    const targetClaims = user.customClaims || {};

    // Permission context check
    if (targetClaims.superAdmin || targetClaims.admin) {
        verifySuperAdmin(request.auth);
    } else {
        verifyAdmin(request.auth);
    }

    // 1. Safeguard: NO ONE can ban a superAdmin directly (must demote first)
    if (targetClaims.superAdmin && banned) {
        throw new HttpsError("permission-denied", "Cannot ban a superAdmin directly. Demote them first.");
    }

    // 2. Atomic Ban & Strip: Banning an admin/moderator clears their roles
    const newClaims: Record<string, any> = { ...targetClaims, banned };
    if (banned) {
        delete newClaims.superAdmin;
        delete newClaims.admin;
        delete newClaims.moderator;
    }

    await auth.setCustomUserClaims(targetUid, newClaims);

    await logAdminAction(request.auth!.uid, request.auth!.token.email || "unknown", banned ? "banUser" : "unbanUser", targetUid);

    return { success: true };
});

export const adminDeleteUser = onCall(async (request) => {
    verifyAdmin(request.auth);
    const { targetUid } = request.data;
    if (!targetUid) throw new HttpsError("invalid-argument", "UID required.");

    const auth = getAuth();
    const user = await auth.getUser(targetUid);

    // Safeguard
    if (user.customClaims?.admin || user.customClaims?.superAdmin) {
        verifySuperAdmin(request.auth);
    }

    console.log(`Admin ${request.auth!.uid} initiating cascade delete for ${targetUid}`);

    // 1. Wipe community lists
    const lists = await db.collection("community_lists").where("ownerId", "==", targetUid).get();
    const batch = db.batch();
    lists.forEach(doc => batch.delete(doc.ref));
    
    // 2. Wipe review queue submissions
    const queue = await db.collection("reviewQueue").where("submittedBy", "==", targetUid).get();
    queue.forEach(doc => batch.delete(doc.ref));

    // 3. Delete profile
    batch.delete(db.collection("user").doc(targetUid));
    
    await batch.commit();

    // 4. Delete Auth record
    await auth.deleteUser(targetUid);
    
    await logAdminAction(request.auth!.uid, request.auth!.token.email || "unknown", "deleteUserCascade", targetUid);
    
    return { success: true, message: "User wiped and deleted." };
});

export const adminSendEmail = onCall({
    secrets: [gmailPassword]
}, async (request) => {
    verifyAdmin(request.auth);
    const { to, subject, body } = request.data;
    if (!to || !subject || !body) throw new HttpsError("invalid-argument", "Missing fields.");

    const password = gmailPassword.value();
    if (!password) throw new HttpsError("failed-precondition", "Mail system not configured.");

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        secure: true,
        auth: { user: 'email.rivers.run@gmail.com', pass: password }
    });

    await transporter.sendMail({
        from: '"Rivers.run Admin" <email.rivers.run@gmail.com>',
        to,
        subject,
        text: body
    });

    await logAdminAction(request.auth!.uid, request.auth!.token.email || "unknown", "sendAdminEmail", "multiple", { to, subject });

    return { success: true };
});



export const manualSyncGaugeRegistry = onCall({
    timeoutSeconds: 540,
    memory: "512MiB"
}, async (request) => {
    verifyAdmin(request.auth);

    console.log("Starting manual USGS/Canada static gauge compilation...");
    const bucket = getStorage().bucket();
    await compileGaugeRegistryToStorage(bucket);
    await logAdminAction(request.auth!.uid, request.auth!.token.email || "unknown", "manualSyncGaugeRegistry", "system");
    console.log("Manual compilation completed securely.");
    return { success: true };
});

export const deleteLiveRiver = onCall({
    timeoutSeconds: 60,
    memory: "256MiB"
}, async (request) => {
    verifyAdmin(request.auth);

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
    const adminEmail = request.auth!.token?.email || "Unknown Admin";

    try {
        const password = gmailPassword.value();
        if (password) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                secure: true,
                auth: { user: 'email.rivers.run@gmail.com', pass: password }
            });

            await transporter.sendMail({
                from: 'email.rivers.run@gmail.com',
                to: [adminEmail, "email.rivers.run@gmail.com"],
                subject: `DELETION ALERT: River Component Removed - ${riverData?.name || riverId}`,
                text: `This river was deleted. The info prior to deletion is attached:\n\n${JSON.stringify(riverData, null, 2)}`
            });
        }
    } catch (e: unknown) {
        console.error("Non-fatal: Failed to log native river deletion email natively:", e instanceof Error ? e.message : e);
    }

    await riverRef.delete();
    await logAdminAction(request.auth!.uid, adminEmail, "deleteLiveRiver", riverId, { name: riverData?.name });
    console.log(`Explicitly deleted river natively: ${riverId} by admin ${adminEmail}`);

    return { success: true, message: "River permanently destroyed." };
});
