import type { RiverData } from "../types/River";

export type CountryCode = "usa" | "canada" | "france" | "germany" | "uk_ireland" | "global";

/**
 * Mapping of state/province abbreviations to their respective countries.
 * This is used as a baseline and potentially augmented dynamically.
 */
export const DEFAULT_STATE_MAP: Record<string, CountryCode[]> = {
  // USA
  "AK": ["usa"], "AL": ["usa"], "AR": ["usa"], "AZ": ["usa"], "CA": ["usa"], "CO": ["usa"], "CT": ["usa"],
  "FL": ["usa"], "GA": ["usa"], "HI": ["usa"], "IA": ["usa"], "ID": ["usa"], "IL": ["usa"], "IN": ["usa"], "KS": ["usa"],
  "KY": ["usa"], "LA": ["usa"], "MA": ["usa"], "MD": ["usa"], "ME": ["usa"], "MI": ["usa"], "MN": ["usa"], "MO": ["usa"],
  "MS": ["usa"], "MT": ["usa"], "NC": ["usa"], "ND": ["usa"], "NE": ["usa"], "NH": ["usa"], "NJ": ["usa"], "NM": ["usa"],
  "NV": ["usa"], "NY": ["usa"], "OH": ["usa"], "OK": ["usa"], "OR": ["usa"], "PA": ["usa"], "RI": ["usa"], "SC": ["usa"],
  "SD": ["usa"], "TN": ["usa"], "TX": ["usa"], "UT": ["usa"], "VA": ["usa"], "VT": ["usa"], "WA": ["usa"], "WI": ["usa"],
  "WV": ["usa"], "WY": ["usa"], "DC": ["usa"], "PR": ["usa"], "VI": ["usa"], "GU": ["usa"],
  // Canada
  "AB": ["canada"], "BC": ["canada"], "MB": ["canada"], "NB": ["canada"], "NL": ["canada"], "NS": ["canada"],
  "ON": ["canada"], "PE": ["canada"], "QC": ["canada"], "SK": ["canada"], "NT": ["canada"], "YT": ["canada"], "NU": ["canada"],
  // Common European / Others
  "FR": ["france"],
  "DE": ["usa", "germany"],
  "IE": ["uk_ireland"],
  "UK": ["uk_ireland"]
};

export const ALL_STATE_CODES = Object.keys(DEFAULT_STATE_MAP).sort((a, b) => a.localeCompare(b));

/**
 * Internal WeakMap cache to store computed countries for each river object.
 * This ensures we only perform the heavy regex/split logic once per data refresh.
 */
const countryCache = new WeakMap<RiverData, Set<CountryCode>>();

/**
 * Robustly identify the country for a gauge based on its prefix.
 */
export function getCountryFromPrefix(gaugeId: string): CountryCode | null {
  if (!gaugeId || !gaugeId.includes(":")) return null;
  const prefix = gaugeId.split(":")[0].toUpperCase();
  
  if (prefix === "USGS" || prefix === "NWS") return "usa";
  if (prefix === "EC") return "canada";
  if (prefix === "FR" || prefix === "VIGI") return "france";
  if (prefix === "EA" || prefix === "IE" || prefix === "UK") return "uk_ireland";
  if (prefix === "BAVARIA" || prefix === "DE") return "germany";
  
  return null;
}

/**
 * Logic to identify all countries a river belongs to.
 * Checks states, provinces, and gauge prefixes.
 */
export function getRiverCountries(river: RiverData, stateMap?: Map<string, Set<CountryCode>>): Set<CountryCode> {
  // Check cache first
  const cached = countryCache.get(river);
  if (cached) return cached;

  const result = new Set<CountryCode>();
  const states = (river.states || "").toUpperCase();
  const stateList = states.split(/[ ,]+/).filter(Boolean);

  // 1. Check state codes against mapping
  stateList.forEach(s => {
    // Check dynamic map first, then default
    const mapped = stateMap?.get(s);
    if (mapped) {
      mapped.forEach(c => result.add(c));
    } else {
      const defaults = DEFAULT_STATE_MAP[s];
      if (defaults) defaults.forEach(c => result.add(c));
    }
  });

  // 2. Fallbacks for full country names in state field
  if (states.includes("FRANCE")) result.add("france");
  if (states.includes("GERMANY") || states.includes("BAVARIA")) result.add("germany");
  if (states.includes("IRELAND")) result.add("uk_ireland");

  // 3. Gauge Prefix check
  if (river.gauges && river.gauges.length > 0) {
    river.gauges.forEach(g => {
      const country = getCountryFromPrefix(g.id);
      if (country) result.add(country);
    });
  }

  // Final fallback
  if (result.size === 0) result.add("global");

  countryCache.set(river, result);
  return result;
}

/**
 * Scans a full river dataset to build a dynamic mapping of states to countries.
 * This handles ambiguous codes and multi-country sets.
 */
export function deriveRegionMap(rivers: RiverData[]): Map<string, Set<CountryCode>> {
  const map = new Map<string, Set<CountryCode>>();

  rivers.forEach(r => {
    const states = (r.states || "").toUpperCase().split(/[ ,]+/).filter(Boolean);
    if (states.length === 0) return;

    // Identify country from gauges on THIS river
    const gaugeCountries = new Set<CountryCode>();
    r.gauges?.forEach(g => {
      const c = getCountryFromPrefix(g.id);
      if (c) gaugeCountries.add(c);
    });

    // If we found a country from gauges, associate it with all states in this river
    if (gaugeCountries.size > 0) {
      states.forEach(s => {
        if (!map.has(s)) map.set(s, new Set());
        gaugeCountries.forEach(c => map.get(s)!.add(c));
      });
    }
  });

  return map;
}
