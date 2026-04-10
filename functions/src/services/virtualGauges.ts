import { Bucket } from "@google-cloud/storage";
import * as zlib from "zlib";

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

function parseUSGSLine(line: string, headers: string[], virtualGauges: Record<string, any>) {
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
                virtualGauges[id] = { name, lat, lon };
            }
        }
    }
}

async function scrapeUSGS(virtualGauges: Record<string, any>) {
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
                parseUSGSLine(line, headers, virtualGauges);
            }
            console.log(`- Compiled state: ${state} (Total so far: ${Object.keys(virtualGauges).length})`);
            await new Promise(r => setTimeout(r, 600));
        } catch (e: any) {
            console.error(`- Failed to retrieve state ${state}:`, e.message);
        }
    }
}

async function scrapeCanada(virtualGauges: Record<string, any>) {
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
                virtualGauges["canada:" + id] = { name, lat: finalLat, lon: finalLon };
            }
        }
        console.log(`- Compiled Canadian stations. Total Gauges: ${Object.keys(virtualGauges).length}`);
    } catch(e: any) {
        console.error("Failed to parse Canadian gauge points.", e.message);
    }
}

export async function compileVirtualGaugesToStorage(bucket: Bucket): Promise<void> {
    console.log("Compiling Virtual Gauges Mapping Dictionary...");
    
    const virtualGauges: Record<string, {name: string, lat: number, lon: number}> = {};

    await scrapeUSGS(virtualGauges);
    await scrapeCanada(virtualGauges);

    const payload = JSON.stringify(virtualGauges);
    const zippedBuffer = zlib.brotliCompressSync(Buffer.from(payload), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    
    const byteSize = Buffer.byteLength(payload);
    console.log(`3. Pushing mapped payload array to Cloud Storage (Uncompressed: ${(byteSize / 1024 / 1024).toFixed(2)} MB, Brotli: ${(zippedBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    
    const file = bucket.file("public/virtualGauges.json");
    await file.save(zippedBuffer, {
        metadata: {
            contentType: "application/json",
            contentEncoding: "br",
            cacheControl: "public, max-age=604800" // Cache for 1 week essentially
        }
    });

    try {
        await file.makePublic();
    } catch {
        console.warn("Non-fatal: makePublic IAM assertion blipped, file is likely already inheriting.");
    }
    
    console.log("Virtual Gauges Tracker natively deployed to Cloud Storage bucket!");
}
