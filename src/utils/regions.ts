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
export const COUNTRY_NAME_MAP: Record<string, string> = {
  "global": "All Countries",
  "usa": "United States",
  "ec": "Canada",
  "uk_ireland": "UK / Ireland"
};

export const COUNTRY_SHORT_NAME_MAP: Record<string, string> = {
  "global": "Global",
  "usa": "USA",
  "ec": "CAN",
  "uk_ireland": "UK / IE"
};

export function getCountryName(code: string, short = false): string {
    if (!code) return short ? COUNTRY_SHORT_NAME_MAP["global"] : COUNTRY_NAME_MAP["global"];
    const map = short ? COUNTRY_SHORT_NAME_MAP : COUNTRY_NAME_MAP;
    return map[code.toLowerCase()] || code.toUpperCase();
}

export const STATE_NAME_MAP: Record<string, string> = {
  "AK": "Alaska", "AL": "Alabama", "AR": "Arkansas", "AZ": "Arizona", "CA": "California", "CO": "Colorado", "CT": "Connecticut",
  "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "IA": "Iowa", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "KS": "Kansas",
  "KY": "Kentucky", "LA": "Louisiana", "MA": "Massachusetts", "MD": "Maryland", "ME": "Maine", "MI": "Michigan", "MN": "Minnesota", "MO": "Missouri",
  "MS": "Mississippi", "MT": "Montana", "NC": "North Carolina", "ND": "North Dakota", "NE": "Nebraska", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
  "NV": "Nevada", "NY": "New York", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VA": "Virginia", "VT": "Vermont", "WA": "Washington", "WI": "Wisconsin",
  "WV": "West Virginia", "WY": "Wyoming", "DC": "District of Columbia",
  "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick", "NL": "Newfoundland and Labrador", "NS": "Nova Scotia",
  "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec", "SK": "Saskatchewan", "NT": "Northwest Territories", "YT": "Yukon", "NU": "Nunavut",
  "IE": "Ireland", "UK": "United Kingdom", "DE": "Germany"
};

export function getStateName(code: string): string {
    if (!code) return "";
    return STATE_NAME_MAP[code.toUpperCase()] || code;
}

export function getRegionName(code: string | null | undefined): string {
    if (!code) return "All Regions";
    return getStateName(code);
}


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

  // 0. Explicit countries check (new schema field)
  if (river.countries) {
    const explicitCountries = river.countries.toUpperCase().split(/[ ,]+/).filter(Boolean);
    explicitCountries.forEach(c => {
       const mapped = c.toLowerCase();
       if (mapped === 'usa' || mapped === 'us') result.add('usa');
       else if (mapped === 'ca' || mapped === 'ec') result.add('ec');
       else if (mapped === 'gb' || mapped === 'uk' || mapped === 'ie') result.add('uk_ireland');
       else result.add('global');
    });
  }

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

