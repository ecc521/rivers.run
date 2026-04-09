import { Firestore } from "firebase-admin/firestore";
import { Bucket } from "@google-cloud/storage";

const JSON_REMOTE_PATH = "public/riverdata.json";
const FULL_SYNC_HEURISTIC_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function syncRiverDataToStorage(db: Firestore, bucket: Bucket): Promise<any[]> {
    console.log("Starting RiverData Storage Synchronization...");
    const file = bucket.file(JSON_REMOTE_PATH);

    let legacyRivers: any[] = [];
    let lastCompileMs = 0;
    let needsFullSync = false;

    // 1. Attempt to download the existing baseline from storage
    try {
        const [exists] = await file.exists();
        if (exists) {
            const [metadata] = await file.getMetadata();
            // Google Cloud Storage updated time is ISO 8601
            const updatedTime = new Date(metadata.updated || 0).getTime();
            
            // If the baseline file is older than 24 hours, safely enforce a full sync to garbage-collect any deleted rivers
            if (Date.now() - updatedTime > FULL_SYNC_HEURISTIC_MS) {
                console.log("Enforcing a Daily Full-Sync to cleanly garbage-collect natively deleted rivers.");
                needsFullSync = true;
            } else {
                const [buffer] = await file.download();
                legacyRivers = JSON.parse(buffer.toString('utf-8'));
                lastCompileMs = updatedTime;
            }
        } else {
            console.log("No existing storage baseline discovered. Executing baseline fetch.");
            needsFullSync = true;
        }
    } catch (e) {
        console.warn("Failed to natively load existing river baseline configuration. Safely failing backward to Full Sync.", e);
        needsFullSync = true;
    }

    let modifiedCount: number;

    // 2. Fetch natively from database
    if (needsFullSync) {
        // Fetch completely from scratch
        const querySnapshot = await db.collection("rivers").get();
        legacyRivers = [];
        querySnapshot.forEach(doc => {
            legacyRivers.push(doc.data());
        });
        modifiedCount = legacyRivers.length;
        console.log(`Executed exact native Full Sync. Downloaded ${modifiedCount} rivers securely.`);
    } else {
        // Run specific Delta Sync since the exact millisecond boundary securely identified from the storage file payload 
        const deltaBoundary = new Date(lastCompileMs);
        console.log(`Executing targeted Delta Sync for precisely newly modified rivers exclusively post-dating: ${deltaBoundary.toISOString()}`);
        
        // This targets specifically natively using a strict filter! 
        const querySnapshot = await db.collection("rivers")
            .where("updatedAt", ">", deltaBoundary)
            .get();

        modifiedCount = querySnapshot.size;
        console.log(`Delta sync successfully identified exactly ${modifiedCount} recently modified downstream changes.`);

        // Systematically splice securely into explicit existing memory
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const index = legacyRivers.findIndex(legacy => legacy.id === data.id);
            if (index >= 0) {
                legacyRivers[index] = data; // Replaces cleanly!
            } else {
                legacyRivers.push(data); // Injects completely!
            }
        });
    }

    // 3. Construct securely the final concatenated buffer
    if (modifiedCount === 0 && !needsFullSync) {
        console.log("Identical state confirmed strictly natively. Synchronization smoothly terminating safely without explicitly writing to Firebase storage.");
        return legacyRivers;
    }

    // 4. Force upload precisely securely 
    const jsonStr = JSON.stringify(legacyRivers);
    console.log(`Deploying strictly natively modified river baseline JSON payload to storage (${(jsonStr.length / 1024).toFixed(2)} KB)...`);

    await file.save(jsonStr, {
        metadata: {
            contentType: "application/json",
            cacheControl: "public, max-age=900, s-maxage=900"
        }
    });

    try {
        await file.makePublic();
    } catch {
        console.warn("Non-fatal IAM validation. Exiting specifically.");
    }

    console.log("River Configuration Baseline safely fully synchronized!");
    return legacyRivers;
}
