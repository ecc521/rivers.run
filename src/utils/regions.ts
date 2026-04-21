import type { RiverData } from "../types/River";

export type CountryCode = "usa" | "ec" | "uk_ireland" | "global";

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
  // EC (Formerly Canada)
  "AB": ["ec"], "BC": ["ec"], "MB": ["ec"], "NB": ["ec"], "NL": ["ec"], "NS": ["ec"],
  "ON": ["ec"], "PE": ["ec"], "QC": ["ec"], "SK": ["ec"], "NT": ["ec"], "YT": ["ec"], "NU": ["ec"],
  // Common European / Others
  "DE": ["usa"],
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
  if (prefix === "EC" || prefix === "CANADA") return "ec";
  if (prefix === "EA" || prefix === "IE" || prefix === "UK") return "uk_ireland";
  
  return null;
}

/**
 * Logic to identify all countries a river belongs to.
 * Checks states, provinces, and gauge prefixes.
 */
export function getRiverCountries(river: RiverData): Set<CountryCode> {
  // Check cache first
  const cached = countryCache.get(river);
  if (cached) return cached;

  const result = new Set<CountryCode>();
  const states = (river.states || "").toUpperCase();
  const stateList = states.split(/[ ,]+/).filter(Boolean);

  // 1. Check state codes against mapping
  stateList.forEach(s => {
    const defaults = DEFAULT_STATE_MAP[s];
    if (defaults) defaults.forEach(c => result.add(c));
  });

  // 2. Fallbacks for full country names in state field
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
 * Derives a mapping of states to the countries they belong to based on the provided river data.
 */
export function deriveRegionMap(rivers: RiverData[]): Map<string, Set<CountryCode>> {
  const stateToCountryMap = new Map<string, Set<CountryCode>>();
  rivers.forEach(river => {
    const countries = getRiverCountries(river);
    const states = (river.states || "").toUpperCase().split(/[ ,]+/).filter(Boolean);
    states.forEach(s => {
      if (!stateToCountryMap.has(s)) {
        stateToCountryMap.set(s, new Set<CountryCode>());
      }
      const countrySet = stateToCountryMap.get(s)!;
      countries.forEach(c => countrySet.add(c));
    });
  });
  return stateToCountryMap;
}

