const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// State name to abbreviation mapping
const STATE_NAME_MAP = {
  "Alaska": "AK", "Alabama": "AL", "Arkansas": "AR", "Arizona": "AZ", "California": "CA", "Colorado": "CO", "Connecticut": "CT",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Iowa": "IA", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Massachusetts": "MA", "Maryland": "MD", "Maine": "ME", "Michigan": "MI", "Minnesota": "MN", "Missouri": "MO",
  "Mississippi": "MS", "Montana": "MT", "North Carolina": "NC", "North Dakota": "ND", "Nebraska": "NE", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "Nevada": "NV", "New York": "NY", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Virginia": "VA", "Vermont": "VT", "Washington": "WA", "Wisconsin": "WI",
  "West Virginia": "WV", "Wyoming": "WY", "District of Columbia": "DC", "Delaware": "DE", "Puerto Rico": "PR",
  "Alberta": "AB", "British Columbia": "BC", "Manitoba": "MB", "New Brunswick": "NB", "Newfoundland and Labrador": "NL", "Nova Scotia": "NS",
  "Ontario": "ON", "Prince Edward Island": "PE", "Quebec": "QC", "Saskatchewan": "SK", "Northwest Territories": "NT", "Yukon": "YT", "Nunavut": "NU"
};

const MASTER_FILE = path.resolve(__dirname, '../data/maps/usa_canada.pmtiles');
const OUTPUT_DIR = path.resolve(__dirname, '../output');
const PMTILES_BIN = path.resolve(__dirname, '../data/maps/pmtiles');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function processGeoJSON(filePath, countryPrefix) {
  console.log(`Processing ${filePath}...`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const manifest = {};

  for (const feature of data.features) {
    const name = feature.properties.name;
    const abbrev = STATE_NAME_MAP[name];
    if (!abbrev) {
      console.log(`Skipping ${name} (No abbreviation found)`);
      continue;
    }

    const outputFileName = `${countryPrefix}-${abbrev}_z14.pmtiles`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);
    const tempGeoJSONPath = path.join(OUTPUT_DIR, `temp_${abbrev}.geojson`);

    fs.writeFileSync(tempGeoJSONPath, JSON.stringify(feature));

    console.log(`Extracting ${name} (${abbrev}) to ${outputFileName}...`);
    try {
      execSync(`${PMTILES_BIN} extract ${MASTER_FILE} ${outputPath} --region=${tempGeoJSONPath} --maxzoom=14 --quiet`, { stdio: 'inherit' });
      
      const stats = fs.statSync(outputPath);
      manifest[abbrev] = {
        name: name,
        country: countryPrefix === 'US' ? 'usa' : 'ec',
        file: outputFileName,
        sizeMB: Math.round(stats.size / (1024 * 1024))
      };
      console.log(`  -> Completed: ${manifest[abbrev].sizeMB} MB`);
    } catch (e) {
      console.error(`  -> Failed extracting ${name}:`, e.message);
    }

    // Clean up temp geojson
    if (fs.existsSync(tempGeoJSONPath)) fs.unlinkSync(tempGeoJSONPath);
  }
  
  return manifest;
}

const usManifest = processGeoJSON(path.resolve(__dirname, '../data/maps/us-states.json'), 'US');
const caManifest = processGeoJSON(path.resolve(__dirname, '../data/maps/canada-provinces.geojson'), 'CA');

const fullManifest = { ...usManifest, ...caManifest };
fs.writeFileSync(path.join(OUTPUT_DIR, 'regions_manifest.json'), JSON.stringify(fullManifest, null, 2));

console.log("Extraction complete! Manifest saved to output/regions_manifest.json");
