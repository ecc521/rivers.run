import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Replace with path to your service account when running
const serviceAccountPath = path.join(__dirname, '..', 'rivers-run-firebase-adminsdk-wzb5p-94cccdc3a2.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Please place your Firebase Service Account JSON at the repository root and name it correctly.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const riversCol = db.collection('rivers');

// Data parsing helpers
function extractLevel(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function detectUnit(river) {
  if (river.relativeflowtype) {
    const rType = river.relativeflowtype.toLowerCase();
    if (rType.includes("ft") || rType.includes("feet")) return "ft";
    if (rType.includes("cms")) return "cms";
    return "cfs";
  }
  
  const allText = [river.minrun, river.maxrun, river.lowflow, river.midflow, river.highflow].join(" ").toLowerCase();
  if (allText.includes("cms")) return "cms";
  if (allText.includes("ft") || allText.includes("feet") || allText.includes("foot") || allText.includes("\'")) return "ft";
  
  return "cfs"; // Default fallback
}

// Run migration
async function migrate() {
  console.log("Loading local riverdata.json...");
  const dataPath = path.join(__dirname, '..', 'riverdata.json');
  if (!fs.existsSync(dataPath)) {
    console.error("Local riverdata.json not found!");
    process.exit(1);
  }

  const fileData = fs.readFileSync(dataPath, 'utf8');
  const allData = JSON.parse(fileData);
  
  // Filter out auto-generated gauges. User-initiated data always has an original 'id'.
  const rivers = allData.filter(r => !!r.id);
  const autoGauges = allData.length - rivers.length;
  
  console.log(`Loaded ${allData.length} total entries from riverdata.json (Skipping ${autoGauges} auto-generated gauges)`);
  console.log(`Beginning migration of ${rivers.length} user-initiated rivers to Firestore...`);

  let successCount = 0;
  let failCount = 0;

  for (const river of rivers) {
    try {
      // 1. Process access points
      let accessPoints = [];
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

      // 3. Process Tags
      let cleanTags = [];
      if (river.tags && typeof river.tags === 'string') {
        cleanTags = river.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      } else if (Array.isArray(river.tags)) {
        cleanTags = river.tags;
      }

      // 4. Extract Flows
      const unit = detectUnit(river);
      const flow = {
        unit: unit,
        min: extractLevel(river.minrun),
        max: extractLevel(river.maxrun),
        low: extractLevel(river.lowflow),
        mid: extractLevel(river.midflow),
        high: extractLevel(river.highflow),
      };

      // 5. Clean up strict Schema
      const document = {
        id: river.id || null,
        name: river.name || "Unknown River",
        state: river.state || "Unknown",
        class: river.class || "Unknown",
        section: river.section || "",
        gauges: gauges,
        accessPoints: accessPoints,
        overview: river.writeup || river.overview || "",
        skill: river.skill || null,
        rating: river.rating || null,
        tags: cleanTags,
        aw: river.aw || null,
        flow: flow,
        imageUrls: [],
        updatedAt: Timestamp.now()
      };

      if (!document.id) {
         document.id = document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }

      // 6. Save to Firestore
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
