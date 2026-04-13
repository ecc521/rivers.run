import { Firestore } from "firebase-admin/firestore";
import { Bucket } from "@google-cloud/storage";
import * as zlib from "zlib";

const JSON_REMOTE_PATH = "public/lists.json";

export async function syncListsToStorage(db: Firestore, bucket: Bucket): Promise<any[]> {
    console.log("Starting Community Lists Storage Synchronization...");
    const file = bucket.file(JSON_REMOTE_PATH);

    const snapshot = await db.collection("community_lists")
                             .where("isPublished", "==", true)
                             .get();

    const lists: any[] = [];
    snapshot.forEach((doc) => {
        lists.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Discovered ${lists.length} published lists natively.`);

    // Protect against accidentally compiling empty if it somehow glitches, although legitimate 0 is possible.
    if (lists.length === 0) {
        console.warn("No published lists discovered. Compiling an empty array payload.");
    }

    const jsonStr = JSON.stringify(lists);
    const zippedBuffer = zlib.brotliCompressSync(Buffer.from(jsonStr), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    
    console.log(`Deploying strictly natively compiled list payload to storage (${(jsonStr.length / 1024).toFixed(2)} KB -> Brotli: ${(zippedBuffer.length / 1024).toFixed(2)} KB)...`);

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
        console.warn("Non-fatal IAM validation explicitly dropped. Proceeding safely.");
    }

    console.log("Lists Configuration Baseline safely synchronized!");
    return lists;
}
