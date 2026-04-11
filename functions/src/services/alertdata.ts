import { Firestore } from "firebase-admin/firestore";
import { Bucket } from "@google-cloud/storage";

const JSON_REMOTE_PATH = "private/alertdata.json";
const FULL_SYNC_HEURISTIC_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function syncAlertDataToStorage(db: Firestore, bucket: Bucket): Promise<any[]> {
    console.log("Starting AlertData Storage Synchronization...");
    const file = bucket.file(JSON_REMOTE_PATH);

    let legacyAlerts: any[] = [];
    let lastCompileMs = 0;
    let needsFullSync = false;

    // 1. Attempt to download the existing baseline from storage
    try {
        const [exists] = await file.exists();
        if (exists) {
            const [metadata] = await file.getMetadata();
            const updatedTime = new Date(metadata.updated || 0).getTime();
            
            // If the baseline file is older than 24 hours, safely enforce a full sync
            if (Date.now() - updatedTime > FULL_SYNC_HEURISTIC_MS) {
                console.log("Enforcing a Daily Full-Sync to cleanly reconstruct notification matrices.");
                needsFullSync = true;
            } else {
                const [buffer] = await file.download();
                legacyAlerts = JSON.parse(buffer.toString('utf-8'));
                lastCompileMs = updatedTime;
            }
        } else {
            console.log("No existing alert baseline discovered. Executing full dump.");
            needsFullSync = true;
        }
    } catch (e: unknown) {
        console.warn("Failed to natively load existing alert baseline. Safely failing backward to Full Sync.", e instanceof Error ? e.message : e);
        needsFullSync = true;
    }

    let querySnapshot;

    // 2. Fetch natively from database
    if (needsFullSync) {
        // Fetch completely from scratch using the same rules as native read to ensure we only cache useful records!
        // Anyone without notifications.enabled is safely completely omitted from the entire architecture!
        querySnapshot = await db.collection("user")
            .where("notifications.enabled", "==", true)
            .get();

        legacyAlerts = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            legacyAlerts.push({ uid: doc.id, ...data });
        });
        console.log(`Executed native Full Sync. Downloaded ${legacyAlerts.length} configured alert profiles securely.`);
    } else {
        const deltaBoundary = new Date(lastCompileMs);
        console.log(`Executing targeted Delta Sync for precisely modified users post-dating: ${deltaBoundary.toISOString()}`);
        
        // This targets specifically natively!
        querySnapshot = await db.collection("user")
            .where("updatedAt", ">", deltaBoundary)
            .get();

        console.log(`Delta sync successfully identified exactly ${querySnapshot.size} recently modified downstream user records.`);

        const alertsMap = new Map(legacyAlerts.map(legacy => [legacy.uid, legacy]));

        // Systematically map securely into explicit existing memory
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;
            
            // Re-evaluating if they should still be in the dataset at all!
            if (data.notifications?.enabled) {
                alertsMap.set(uid, { uid, ...data }); // Replaces or injects cleanly in O(1)
            } else {
                // They explicitly disabled notifications, purge them cleanly immediately!
                alertsMap.delete(uid); // Deletes cleanly in O(1) without splice
            }
        });

        legacyAlerts = Array.from(alertsMap.values());
    }

    // 3. Construct securely the final concatenated buffer
    if (querySnapshot.size === 0 && !needsFullSync) {
        console.log("Identical state confirmed strictly natively. Synchronization smoothly terminating safely without explicitly writing to Firebase storage.");
        return legacyAlerts;
    }

    // 4. Force upload precisely securely 
    const jsonStr = JSON.stringify(legacyAlerts);
    console.log(`Deploying strictly natively modified user alert JSON payload to storage (${(jsonStr.length / 1024).toFixed(2)} KB)...`);

    await file.save(jsonStr, {
        metadata: {
            contentType: "application/json",
            // No strict cache control because this is private and dynamically evaluated server-side
        }
    });

    console.log("Alert Configuration Baseline safely fully synchronized!");
    return legacyAlerts;
}
