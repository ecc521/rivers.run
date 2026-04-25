const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const fs = require("fs");
const path = require("path");

const ACCOUNT_ID = "55098d8696658ea1ee4ec73ae57d1741";
const BUCKET_NAME = "rivers-maps";

// These MUST be set in your environment
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error("❌ ERROR: You must set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
  console.error("Run the script like this:");
  console.error("R2_ACCESS_KEY_ID='your_id' R2_SECRET_ACCESS_KEY='your_secret' node build-tools/upload_large_files.cjs");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const filesToUpload = [
  "US-AK_z14.pmtiles",
  "US-CA_z14.pmtiles",
  "US-FL_z14.pmtiles",
  "US-TX_z14.pmtiles"
];

async function uploadFile(fileName) {
  const filePath = path.join(__dirname, "../output", fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Skipping ${fileName} (File not found in output directory)`);
    return;
  }

  const fileStream = fs.createReadStream(filePath);
  console.log(`🚀 Starting multipart upload for ${fileName}...`);

  try {
    const parallelUploads3 = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileStream,
      },
      queueSize: 4, // concurrent uploads
      partSize: 1024 * 1024 * 50, // 50MB chunks
      leavePartsOnError: false,
    });

    parallelUploads3.on("httpUploadProgress", (progress) => {
      const percentage = ((progress.loaded / progress.total) * 100).toFixed(1);
      console.log(`  -> ${fileName}: ${percentage}% uploaded`);
    });

    await parallelUploads3.done();
    console.log(`✅ Successfully uploaded ${fileName}!`);
  } catch (e) {
    console.error(`❌ Failed to upload ${fileName}:`, e);
  }
}

async function run() {
  for (const file of filesToUpload) {
    await uploadFile(file);
  }
  console.log("All large files uploaded!");
}

run();
