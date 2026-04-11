import { promisify } from "util";
import { gzip } from "zlib";

const states = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma",
  "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny",
  "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx",
  "ut", "vt", "va", "wa", "wv", "wi", "wy", "pr", "vi"
];

function fixCasing(str: string): string {
  const splitStr = str.toLowerCase().split(' ');
  for (let i = 0; i < splitStr.length; i++) {
    if (splitStr[i]) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
  }
  return splitStr.join(' ');
}

function fixSiteName(siteName: string): string {
  const name = siteName.split(/\bnr\b/i).join("near").split(/\bbl\b/i).join("below").split(/\bdnstrm\b/i).join("downstream").split(/\babv\b/i).join("above")
    .split(/\b@\b/).join("at").split(/\bS\b/).join("South").split(/\bN\b/).join("North").split(/\bE\b/).join("East").split(/\bW\b/).join("West")
    .split(/\bCr\b/i).join("Creek").split(/\bCk\b/i).join("Creek").split(/\bR\b/i).join("River").split(/\bCYN\b/i).join("Canyon").split(/\bSTA\b/i).join("Station")
    .split(/\bRv\b/i).join("River");
  return fixCasing(name);
}

function parseUSGSLine(line: string, headers: string[], gaugeRegistry: Record<string, any>) {
    if (line.trim().length === 0) return;

    const tokens = line.split('\t');
    if (tokens.length >= headers.length && headers.length > 0) {
        const idIndex = headers.indexOf('site_no');
        const nameIndex = headers.indexOf('station_nm');
        const latIndex = headers.indexOf('dec_lat_va');
        const lonIndex = headers.indexOf('dec_long_va');
        
        if (idIndex > -1 && nameIndex > -1 && latIndex > -1 && lonIndex > -1) {
            const id = "USGS:" + tokens[idIndex];
            const name = fixSiteName(tokens[nameIndex]);
            const lat = parseFloat(tokens[latIndex]);
            const lon = parseFloat(tokens[lonIndex]);
            if (!isNaN(lat) && !isNaN(lon)) {
                gaugeRegistry[id] = { name, lat, lon };
            }
        }
    }
}

async function scrapeUSGS(gaugeRegistry: Record<string, any>) {
    console.log("1. Pulling USGS Native Metadata...");
    for (const state of states) {
        const url = `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${state}&siteStatus=active&siteType=ST&hasDataTypeCd=iv&siteOutput=expanded`;
        try {
            const res = await fetch(url);
            const text = await res.text();
            const lines = text.split('\n');
            let headers: string[] = [];
            
            for (let line of lines) {
                line = line.trimEnd();
                if (!line || line.startsWith('#') || line.includes('5s') || line.includes('15s')) continue;
                
                if (line.includes('agency_cd')) {
                    headers = line.split('\t');
                    continue;
                }
                parseUSGSLine(line, headers, gaugeRegistry);
            }
            console.log(`- Compiled state: ${state} (Total so far: ${Object.keys(gaugeRegistry).length})`);
            await new Promise(r => setTimeout(r, 600));
        } catch (e: unknown) {
            console.error(`- Failed to retrieve state ${state}:`, e instanceof Error ? e.message : e);
        }
    }
}

async function scrapeCanada(gaugeRegistry: Record<string, any>) {
    console.log("2. Pulling Canadian Native Metadata...");
    try {
        const canRes = await fetch("https://wateroffice.ec.gc.ca/services/map_data");
        const canData = await canRes.json() as any;
        
        for (const [id, site] of Object.entries(canData)) {
            const s = site as any;
            const name = s.name ? fixCasing(s.name) : "Unknown Canadian Gauge";
            const finalLat = parseFloat(s.lat || s.latitude);
            const finalLon = parseFloat(s.lon || s.longitude);
            if (!isNaN(finalLat) && !isNaN(finalLon)) {
                gaugeRegistry["canada:" + id] = { name, lat: finalLat, lon: finalLon };
            }
        }
        console.log(`- Compiled Canadian stations. Total Gauges: ${Object.keys(gaugeRegistry).length}`);
    } catch(e: unknown) {
        console.error("Failed to parse Canadian gauge points.", e instanceof Error ? e.message : e);
    }
}

export async function compileGaugeRegistryToStorage(bucket: any): Promise<void> {
    console.log("Starting full USGS/Canada static gauge registry compilation...");
    
    // We strictly use an efficient in-memory map here before compression
    const gaugeRegistry: Record<string, {name: string, lat: number, lon: number}> = {};

    await scrapeUSGS(gaugeRegistry);
    await scrapeCanada(gaugeRegistry);

    const payload = JSON.stringify(gaugeRegistry);
    console.log(`Final Gauge Registry JSON length: ${payload.length} bytes`);

    // Gzip natively to severely reduce egress footprint when deploying dynamically
    const buffer = Buffer.from(payload, "utf-8");
    const compressed = await promisify(gzip)(buffer);

    const file = bucket.file("public/gaugeRegistry.json");
    await file.save(compressed, {
        metadata: {
            contentType: "application/json",
            contentEncoding: "gzip"
        }
    });

    try {
        await file.makePublic();
    } catch {
        console.warn("Non-fatal: makePublic IAM assertion blipped, file is likely already inheriting.");
    }
    
    console.log("Gauge Registry JSON natively deployed to Cloud Storage bucket!");
}
