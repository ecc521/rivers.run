import { Firestore } from "firebase-admin/firestore";
import { Bucket } from "@google-cloud/storage";
import * as zlib from "zlib";
import { validateRiver } from "./riverValidation";

const JSON_REMOTE_PATH = "public/rivers.json";
const FULL_SYNC_HEURISTIC_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function syncRiverDataToStorage(db: Firestore, bucket: Bucket): Promise<{ activeRivers: any[], runSitemap: boolean }> {
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
                try {
                    const decompressed = zlib.brotliDecompressSync(buffer);
                    legacyRivers = JSON.parse(decompressed.toString('utf-8'));
                } catch {
                    legacyRivers = JSON.parse(buffer.toString('utf-8'));
                }
                lastCompileMs = updatedTime;
            }
        } else {
            console.log("No existing storage baseline discovered. Executing baseline fetch.");
            needsFullSync = true;
        }
    } catch (e: unknown) {
        console.warn("Failed to natively load existing river baseline configuration. Safely failing backward to Full Sync.", e instanceof Error ? e.message : e);
        needsFullSync = true;
    }

    let modifiedCount: number;

    // 2. Fetch natively from database
    if (needsFullSync) {
        // Fetch completely from scratch
        const querySnapshot = await db.collection("rivers").get();
        legacyRivers = [];
        const invalidRivers: any[] = [];

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const { isValid, errors } = validateRiver(data);
            if (!isValid) {
                invalidRivers.push({ data, errors });
            } else {
                legacyRivers.push(data);
            }
        });
        modifiedCount = legacyRivers.length;
        console.log(`Executed exact native Full Sync. Downloaded ${modifiedCount} rivers securely.`);

        for (const item of invalidRivers) {
            console.warn(`River ${item.data.id || 'UNKNOWN'} is improperly formatted. Moving to reviewQueue. Errors: ${item.errors.join(", ")}`);
            try {
                if (item.data.id) {
                    await db.collection("reviewQueue").doc(item.data.id).set({
                        ...item.data,
                        _moveReason: "Automatically moved due to backend formatting validation failure.",
                        _moveErrors: item.errors,
                        _movedAt: new Date()
                    });
                    await db.collection("rivers").doc(item.data.id).delete();
                }
            } catch (e: unknown) {
                if (e instanceof Error) {
                    console.error(`Failed to move invalid river ${item.data.id}`, e.message);
                }
            }
        }
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

        const invalidRivers: any[] = [];

        const riversMap = new Map(legacyRivers.map(legacy => [legacy.id, legacy]));

        // Systematically map securely into explicit existing memory
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const { isValid, errors } = validateRiver(data);
            
            if (!isValid) {
                invalidRivers.push({ data, errors });
                // If it became invalid, ensure it is removed from the public JSON payload
                riversMap.delete(data.id);
            } else {
                riversMap.set(data.id, data); // Replaces or injects cleanly in O(1)
            }
        });

        legacyRivers = Array.from(riversMap.values());

        for (const item of invalidRivers) {
            console.warn(`River ${item.data.id || 'UNKNOWN'} is improperly formatted. Moving to reviewQueue. Errors: ${item.errors.join(", ")}`);
            try {
                if (item.data.id) {
                    await db.collection("reviewQueue").doc(item.data.id).set({
                        ...item.data,
                        _moveReason: "Automatically moved due to backend formatting validation failure.",
                        _moveErrors: item.errors,
                        _movedAt: new Date()
                    });
                    await db.collection("rivers").doc(item.data.id).delete();
                }
            } catch (e: unknown) {
                if (e instanceof Error) {
                    console.error(`Failed to move invalid river ${item.data.id}`, e.message);
                }
            }
        }
    }

    // 3. Construct securely the final concatenated buffer
    if (modifiedCount === 0 && !needsFullSync) {
        console.log("Identical state confirmed strictly natively. Synchronization smoothly terminating safely without explicitly writing to Firebase storage.");
        return { activeRivers: legacyRivers, runSitemap: false };
    }

    // 4. Force upload precisely securely 
    const jsonStr = JSON.stringify(legacyRivers);
    const zippedBuffer = zlib.brotliCompressSync(Buffer.from(jsonStr), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    console.log(`Deploying strictly natively modified river baseline JSON payload to storage (${(jsonStr.length / 1024).toFixed(2)} KB -> Brotli: ${(zippedBuffer.length / 1024).toFixed(2)} KB)...`);

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
        console.warn("Non-fatal IAM validation. Exiting specifically.");
    }

    console.log("River Configuration Baseline safely fully synchronized!");
    return { activeRivers: legacyRivers, runSitemap: true };
}
