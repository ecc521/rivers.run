import type { RiverData } from "../types/River";

/**
 * Canonical country codes — the single source of truth for which countries
 * the app supports. New countries can be added here even before any river
 * data exists for them: this list only drives validation and labels, not
 * what shows in search dropdowns (that's computed from real data separately),
 * so an unused entry costs nothing.
 */
export type CountryCode =
  | "US" | "CA" | "GB" | "IE" | "FR" | "DE" | "NZ" | "AU" | "MX"
  | "CR" | "CO" | "PE" | "EC" | "CL" | "ZA" | "IT" | "CH" | "AT" | "NO" | "ES";

export const ALL_COUNTRY_CODES: CountryCode[] = [
  "US", "CA", "GB", "IE", "FR", "DE", "NZ", "AU", "MX",
  "CR", "CO", "PE", "EC", "CL", "ZA", "IT", "CH", "AT", "NO", "ES"
];

export const COUNTRY_NAME_MAP: Record<CountryCode, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", IE: "Ireland",
  FR: "France", DE: "Germany", NZ: "New Zealand", AU: "Australia", MX: "Mexico",
  CR: "Costa Rica", CO: "Colombia", PE: "Peru", EC: "Ecuador", CL: "Chile",
  ZA: "South Africa", IT: "Italy", CH: "Switzerland", AT: "Austria", NO: "Norway", ES: "Spain",
};

export const COUNTRY_SHORT_NAME_MAP: Record<CountryCode, string> = {
  US: "USA", CA: "CAN", GB: "UK", IE: "IE",
  FR: "FR", DE: "DE", NZ: "NZ", AU: "AU", MX: "MX",
  CR: "CR", CO: "CO", PE: "PE", EC: "EC", CL: "CL",
  ZA: "ZA", IT: "IT", CH: "CH", AT: "AT", NO: "NO", ES: "ES",
};

/**
 * `code` is usually a CountryCode, but also accepts the UI-only "global"/falsy
 * sentinel meaning "no country filter selected".
 */
export function getCountryName(code: string | null | undefined, short = false): string {
  if (!code || code === "global") return short ? "Global" : "All Countries";
  const map = short ? COUNTRY_SHORT_NAME_MAP : COUNTRY_NAME_MAP;
  return map[code.toUpperCase() as CountryCode] || code.toUpperCase();
}

/**
 * Canonical state/subdivision codes, nested by country. Only populated where
 * real data currently benefits from state-level filtering (US, CA, GB).
 * Adding a new country's subdivisions later is just a new top-level key here
 * — no migration, since the river record's own `states` field is unaffected.
 * New codes should stay globally unique by convention (e.g. GB's 3-letter
 * codes vs. US/CA's 2-letter codes) since a river's `states` string is flat
 * and unprefixed — the nesting here is for validation/lookup, not storage.
 */
export const CANONICAL_REGIONS: Record<CountryCode, Record<string, string>> = {
  US: {
    AK: "Alaska", AL: "Alabama", AR: "Arkansas", AZ: "Arizona", CA: "California", CO: "Colorado", CT: "Connecticut",
    FL: "Florida", GA: "Georgia", HI: "Hawaii", IA: "Iowa", ID: "Idaho", IL: "Illinois", IN: "Indiana", KS: "Kansas",
    KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", ME: "Maine", MI: "Michigan", MN: "Minnesota", MO: "Missouri",
    MS: "Mississippi", MT: "Montana", NC: "North Carolina", ND: "North Dakota", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
    NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin",
    WV: "West Virginia", WY: "Wyoming", DC: "District of Columbia", DE: "Delaware", PR: "Puerto Rico", VI: "Virgin Islands", GU: "Guam",
  },
  CA: {
    AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia",
    ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", NT: "Northwest Territories", YT: "Yukon", NU: "Nunavut",
  },
  GB: {
    ENG: "England", SCO: "Scotland", WAL: "Wales", NIR: "Northern Ireland",
  },
  IE: {}, FR: {}, DE: {}, NZ: {}, AU: {}, MX: {}, CR: {}, CO: {}, PE: {}, EC: {}, CL: {}, ZA: {}, IT: {}, CH: {}, AT: {}, NO: {}, ES: {},
};

/** Flat state code -> owning countries. A code can map to more than one
 * country only if two countries' subdivisions happen to share a code, which
 * the canonical structure is designed to avoid by convention. */
export const DEFAULT_STATE_MAP: Record<string, CountryCode[]> = (() => {
  const map: Record<string, CountryCode[]> = {};
  for (const country of ALL_COUNTRY_CODES) {
    for (const code of Object.keys(CANONICAL_REGIONS[country])) {
      if (!map[code]) map[code] = [];
      map[code].push(country);
    }
  }
  return map;
})();

export const ALL_STATE_CODES: string[] = Object.keys(DEFAULT_STATE_MAP).sort((a, b) => a.localeCompare(b));

/** States/subdivisions available for a given country — used to scope the
 * river editor's state dropdown to the currently-selected country. */
export function getStatesForCountry(country: CountryCode | string | undefined | null): string[] {
  if (!country) return ALL_STATE_CODES;
  const bucket = CANONICAL_REGIONS[country.toUpperCase() as CountryCode];
  return bucket ? Object.keys(bucket).sort((a, b) => a.localeCompare(b)) : [];
}

export const STATE_NAME_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const country of ALL_COUNTRY_CODES) {
    Object.assign(map, CANONICAL_REGIONS[country]);
  }
  return map;
})();

export function getStateName(code: string): string {
  if (!code) return "";
  return STATE_NAME_MAP[code.toUpperCase()] || code;
}

export function getRegionName(code: string | null | undefined): string {
  if (!code) return "All States";
  return getStateName(code);
}

/**
 * Internal WeakMap cache to store computed countries for each river object.
 * This ensures we only perform the regex/split logic once per data refresh.
 */
const countryCache = new WeakMap<RiverData, Set<CountryCode>>();

/**
 * Robustly identify the country for a gauge based on its prefix.
 */
export function getCountryFromPrefix(gaugeId: string): CountryCode | null {
  if (!gaugeId || !gaugeId.includes(":")) return null;
  const prefix = gaugeId.split(":")[0].toUpperCase();

  if (prefix === "USGS" || prefix === "NWS") return "US";
  if (prefix === "EC" || prefix === "CANADA") return "CA";
  if (prefix === "EA" || prefix === "UK") return "GB";
  if (prefix === "IE") return "IE";

  return null;
}

/**
 * Logic to identify all countries a river belongs to. Checks the explicit
 * `countries` field, state codes, and gauge prefixes. Malformed inputs
 * (e.g. a country code accidentally placed in `states`) are no longer
 * specially patched here — validation at the editor/API boundary prevents
 * that data from existing in the first place, so an unrecognized value here
 * is simply ignored rather than defensively reinterpreted.
 */
export function getRiverCountries(river: RiverData): Set<CountryCode> {
  const cached = countryCache.get(river);
  if (cached) return cached;

  const result = new Set<CountryCode>();

  // 0. Explicit countries field (authoritative when present)
  if (river.countries) {
    river.countries.toUpperCase().split(/[ ,]+/).filter(Boolean).forEach(c => {
      if ((ALL_COUNTRY_CODES as string[]).includes(c)) result.add(c as CountryCode);
    });
  }

  // 1. State codes against the canonical map
  const stateList = (river.states || "").toUpperCase().split(/[ ,]+/).filter(Boolean);
  stateList.forEach(s => {
    DEFAULT_STATE_MAP[s]?.forEach(c => result.add(c));
  });

  // 2. Gauge prefix check
  river.gauges?.forEach(g => {
    const country = getCountryFromPrefix(g.id);
    if (country) result.add(country);
  });

  countryCache.set(river, result);
  return result;
}

/**
 * Derives a mapping of states to the countries they actually belong to,
 * across every river and standalone gauge currently loaded (tens of
 * thousands of entries at real scale, mostly standalone gauges). Deliberately
 * doesn't reuse getRiverCountries here: that function's per-call Set()
 * allocation and WeakMap cache are wasted work at this scale, since
 * standalone gauge objects are rebuilt fresh on every fetch and never hit
 * the cache. Each state is validated against CANONICAL_REGIONS for the
 * specific country it's being attributed to, so a gauge whose provider
 * metadata reports a bordering country's state code (e.g. a Canadian gauge
 * near the Maine border reporting state "ME") can't get attributed to the
 * wrong country.
 */
export function deriveRegionMap(rivers: RiverData[]): Map<string, Set<CountryCode>> {
  const stateToCountryMap = new Map<string, Set<CountryCode>>();

  const addPair = (state: string, country: string) => {
    const bucket = CANONICAL_REGIONS[country as CountryCode];
    if (!bucket || !(state in bucket)) return;
    let countrySet = stateToCountryMap.get(state);
    if (!countrySet) {
      countrySet = new Set<CountryCode>();
      stateToCountryMap.set(state, countrySet);
    }
    countrySet.add(country as CountryCode);
  };

  // Scratch arrays reused across iterations instead of allocated per-river —
  // at ~15k entries, a closure or array literal allocated inside the loop
  // body is the dominant cost, not the string/lookup work itself.
  let states: string[] = [];
  const countries: string[] = [];

  for (const river of rivers) {
    const statesRaw = river.states;
    if (!statesRaw) continue;
    const countriesRaw = river.countries;

    // Fast path: a single state token and a single explicit country token —
    // true for every standalone gauge and effectively every schema-validated
    // curated river — resolves with no array allocation at all. This is the
    // path ~15k of ~15k rows take in practice.
    if (
      countriesRaw &&
      statesRaw.indexOf(",") === -1 && statesRaw.indexOf(" ") === -1 &&
      countriesRaw.indexOf(",") === -1 && countriesRaw.indexOf(" ") === -1
    ) {
      addPair(statesRaw.toUpperCase(), countriesRaw.toUpperCase());
      continue;
    }

    // General path: multi-country/multi-state rivers, or a row missing an
    // explicit countries value (rare — legacy data predating that field's
    // write-side requirement) that needs the state-implied/gauge-prefix
    // fallback signals.
    if (statesRaw.indexOf(",") === -1 && statesRaw.indexOf(" ") === -1) {
      states.length = 1;
      states[0] = statesRaw.toUpperCase();
    } else {
      states = statesRaw.toUpperCase().split(/[ ,]+/).filter(Boolean);
      if (states.length === 0) continue;
    }

    // This river's country set — same three signals as getRiverCountries
    // (explicit field, state-implied, gauge-prefix-implied), almost always a
    // single entry, so a plain reused array beats allocating a Set per row.
    countries.length = 0;

    if (countriesRaw) {
      if (countriesRaw.indexOf(",") === -1 && countriesRaw.indexOf(" ") === -1) {
        const c = countriesRaw.toUpperCase();
        if (!countries.includes(c)) countries.push(c);
      } else {
        const tokens = countriesRaw.toUpperCase().split(/[ ,]+/);
        for (const c of tokens) {
          if (c && !countries.includes(c)) countries.push(c);
        }
      }
    }

    // State-implied and gauge-prefix-implied country are fallbacks for the
    // rare row missing an explicit `countries` value (legacy data predating
    // that field's write-side requirement) — every standalone gauge and every
    // schema-validated curated river already has it set, so skipping these
    // loops whenever countries is already non-empty avoids paying their cost
    // on effectively all ~15k rows just to re-derive what's already known.
    if (countries.length === 0) {
      for (const s of states) {
        const implied = DEFAULT_STATE_MAP[s];
        if (!implied) continue;
        for (const c of implied) {
          if (!countries.includes(c)) countries.push(c);
        }
      }
    }
    if (countries.length === 0) {
      const gauges = river.gauges;
      if (gauges) {
        for (const g of gauges) {
          const c = getCountryFromPrefix(g.id);
          if (c && !countries.includes(c)) countries.push(c);
        }
      }
    }

    if (countries.length === 0) continue;

    for (const state of states) {
      for (const country of countries) {
        addPair(state, country);
      }
    }
  }

  return stateToCountryMap;
}
