import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OTA_DIR = path.join(DIST_DIR, 'ota');
const UPDATE_ZIP = path.join(OTA_DIR, 'update.zip');
const MANIFEST_JSON = path.join(OTA_DIR, 'manifest.json');

// Generate version from timestamp to ensure it's always unique
const timestamp = Math.floor(Date.now() / 1000);
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const version = `${packageJson.version}-${timestamp}`;

async function generateOTAData() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error("No dist folder found! Please run 'npm run build' first.");
    process.exit(1);
  }

  if (!fs.existsSync(OTA_DIR)) {
    fs.mkdirSync(OTA_DIR, { recursive: true });
  }

  console.log(`Generating OTA Update Bundle (Version: ${version})...`);

  // 1. Zip the dist folder (excluding the ota folder and sourcemaps)
  const output = fs.createWriteStream(UPDATE_ZIP);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level
  });

  output.on('close', function() {
    console.log(`Successfully created update.zip: ${archive.pointer()} total bytes`);
    
    // 2. Write the manifest JSON
    const manifest = {
      version: version,
      url: "https://rivers.run/ota/update.zip"
    };

    fs.writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2), 'utf8');
    console.log("Successfully wrote manifest.json");
    console.log(`OTA URL will be at: https://rivers.run/ota/manifest.json`);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn(err);
    } else {
      throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  // Glob to add the entire dist directory except the ota folder and maps
  archive.glob('**/*', {
    cwd: DIST_DIR,
    ignore: ['ota/**', '**/*.map']
  });

  await archive.finalize();
}

generateOTAData().catch(console.error);
