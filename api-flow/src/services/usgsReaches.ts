import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';
import type { Env } from '../index';

// Simple CSV line parser supporting quoted fields and escaped quotes
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i+1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export async function syncUsgsReaches(env: Env): Promise<void> {
  await logToD1(env, "INFO", "registry", "Starting USGS to NWM reach mapping sync...");
  try {
    const url = "https://water.noaa.gov/resources/downloads/reports/nwps_all_gauges_report.csv";
    const response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // 90s timeout
    if (!response.ok) {
      throw new Error(`Failed to fetch NOAA gauge report: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) {
      throw new Error("Empty CSV file received from NOAA");
    }

    const headers = parseCSVLine(lines[0]);
    const usgsIdx = headers.indexOf("usgs id");
    const reachIdx = headers.indexOf("reach id");

    if (usgsIdx === -1 || reachIdx === -1) {
      throw new Error("Could not find 'usgs id' or 'reach id' columns in NOAA CSV header");
    }

    const mapping: Record<string, string> = {};
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const fields = parseCSVLine(line);
      const usgsId = fields[usgsIdx]?.trim();
      const reachId = fields[reachIdx]?.trim();

      if (usgsId && reachId && usgsId !== "" && reachId !== "") {
        mapping[usgsId] = reachId;
        count++;
      }
    }

    // Save to R2
    const body = JSON.stringify(mapping);
    await env.FLOW_STORAGE.put("usgs_reaches.json", body, {
      httpMetadata: { contentType: "application/json" }
    });

    await logToD1(env, "INFO", "registry", `Successfully synced and updated usgs_reaches.json in R2 with ${count} mappings.`);
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    await logToD1(env, "WARN", "registry", `Failed to sync USGS to NWM reaches. Error: ${msg}`);
    console.error("Failed to sync USGS to NWM reaches:", e);
  }
}
