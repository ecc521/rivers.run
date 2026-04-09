import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Replace with path to your service account when running
const serviceAccountPath = path.join(__dirname, '..', '..', 'firebase-adminsdk.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Please place your Firebase Service Account JSON at the repository root and name it 'firebase-adminsdk.json'");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const riversCol = db.collection('rivers');

// Run migration
async function migrate() {
  console.log("Fetching current riverdata.json from production...");
  const devFileUrl = 'https://rivers.run/riverdata.json';
  const response = await fetch(devFileUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch riverdata: ${response.statusText}`);
  }

  const rivers = await response.json();
  console.log(`Fetched ${rivers.length} rivers. Beginning migration to Firestore...`);

  let successCount = 0;
  let failCount = 0;

  for (const river of rivers) {
    try {
      // 1. Process access points (from plat/plon, tlat/tlon legacy data)
      let accessPoints = [];
      
      // Some legacy data might have access formatted in different ways. 
      // If it exists in 'access' Array from standardizeRiverFormat
      if (river.access && Array.isArray(river.access)) {
         accessPoints = river.access.map((ap) => ({
           name: ap.name || ap.label || "Access",
           type: ap.name?.toLowerCase().includes("put") ? "put-in" : (ap.name?.toLowerCase().includes("take") ? "take-out" : "mid-point"),
           lat: parseFloat(ap.lat),
           lon: parseFloat(ap.lon)
         }));
      } else {
        if (river.plat && river.plon) {
          accessPoints.push({ name: "Put-In", type: "put-in", lat: parseFloat(river.plat), lon: parseFloat(river.plon) });
        }
        if (river.tlat && river.tlon) {
          accessPoints.push({ name: "Take-Out", type: "take-out", lat: parseFloat(river.tlat), lon: parseFloat(river.tlon) });
        }
      }

      // 2. Unify Gauges
      const gauges = [];
      if (river.gauge) {
        gauges.push({ id: river.gauge, isPrimary: true });
      }
      if (river.relatedgauges && Array.isArray(river.relatedgauges)) {
        for (const rg of river.relatedgauges) {
          if (rg !== river.gauge) {
             gauges.push({ id: rg, isPrimary: false });
          }
        }
      }

      // 3. Clean up strict Schema
      const document = {
        id: river.id || null,
        name: river.name || "Unknown River",
        state: river.state || "Unknown",
        class: river.class || "Unknown",
        section: river.section || "",
        gauges: gauges,
        accessPoints: accessPoints,
        overview: river.writeup || river.overview || "",
        imageUrls: [],
        updatedAt: Timestamp.now()
      };

      if (!document.id) {
         // Create a synthetic ID from name if missing
         document.id = document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }

      // 4. Save to Firestore
      await riversCol.doc(document.id).set(document);
      successCount++;
      process.stdout.write(`\rSuccessfully migrated ${successCount}/${rivers.length}`);

    } catch (e) {
      console.error(`\nFailed to migrate river ${river.name}: `, e);
      failCount++;
    }
  }

  console.log(`\n\nMigration Complete. Success: ${successCount}. Failed: ${failCount}.`);
}

migrate().catch(console.error);
