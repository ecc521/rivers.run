/**
 * Canonical country/state validation data for the river editor API.
 *
 * This is a deliberate duplicate of `src/utils/regions.ts`'s `CANONICAL_REGIONS`
 * — the `api` worker and the web frontend are separate build targets/deployments
 * (Cloudflare Workers vs. Vite SPA), so they can't share a module directly.
 * Keep the two in sync when adding a country or subdivision.
 */

export type CountryCode =
  | "US" | "CA" | "GB" | "IE" | "FR" | "DE" | "NZ" | "AU" | "MX"
  | "CR" | "CO" | "PE" | "EC" | "CL" | "ZA" | "IT" | "CH" | "AT" | "NO" | "ES";

export const ALL_COUNTRY_CODES: CountryCode[] = [
  "US", "CA", "GB", "IE", "FR", "DE", "NZ", "AU", "MX",
  "CR", "CO", "PE", "EC", "CL", "ZA", "IT", "CH", "AT", "NO", "ES"
];

/** Only populated where real data currently benefits from state-level
 * filtering (US, CA, GB) — see src/utils/regions.ts for the full rationale. */
export const CANONICAL_REGIONS: Record<CountryCode, string[]> = {
  US: [
    "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS",
    "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM",
    "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI",
    "WV", "WY", "DC", "DE", "PR", "VI", "GU",
  ],
  CA: ["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "NT", "YT", "NU"],
  GB: ["ENG", "SCO", "WAL", "NIR"],
  IE: [], FR: [], DE: [], NZ: [], AU: [], MX: [], CR: [], CO: [], PE: [], EC: [], CL: [], ZA: [], IT: [], CH: [], AT: [], NO: [], ES: [],
};

export function parseTokens(value: string | null | undefined): string[] {
  return (value || "").toUpperCase().split(/[ ,]+/).map(s => s.trim()).filter(Boolean);
}

/** Every token in `countries` must be a known country code. */
export function validateCountries(countries: string | null | undefined): boolean {
  const tokens = parseTokens(countries);
  if (tokens.length === 0) return false;
  return tokens.every(c => (ALL_COUNTRY_CODES as string[]).includes(c));
}

/** Every token in `states` must be a valid subdivision of at least one of
 * the river's selected `countries` — states are validated as (state, country)
 * pairs, not against a flat global set, so future countries' subdivisions
 * can't collide with existing US/CA codes. */
export function validateStates(states: string | null | undefined, countries: string | null | undefined): boolean {
  const stateTokens = parseTokens(states);
  if (stateTokens.length === 0) return true; // states are optional

  const countryTokens = parseTokens(countries).filter(c => (ALL_COUNTRY_CODES as string[]).includes(c)) as CountryCode[];
  const validForSelectedCountries = new Set(countryTokens.flatMap(c => CANONICAL_REGIONS[c]));

  return stateTokens.every(s => validForSelectedCountries.has(s));
}

export interface AvailableRegions {
  availableCountries: string[];
  availableStatesByCountry: Record<string, string[]>;
}

/**
 * Computes which countries/states actually have at least one river, from the
 * `countries`/`states` columns of the rivers table. Cheap enough (a few hundred
 * rows) to run live on every request — no caching or precompute step needed.
 */
export function computeAvailableRegions(rows: { countries?: string | null; states?: string | null }[]): AvailableRegions {
  const countrySet = new Set<string>();
  const statesByCountry: Record<string, Set<string>> = {};

  for (const row of rows) {
    const countries = parseTokens(row.countries).filter(c => (ALL_COUNTRY_CODES as string[]).includes(c)) as CountryCode[];
    const states = parseTokens(row.states);

    countries.forEach(c => countrySet.add(c));

    // Associate each state with whichever of the river's countries actually
    // owns it — handles border-crossing rivers (e.g. "WA, BC") correctly.
    states.forEach(s => {
      countries.forEach(c => {
        if (CANONICAL_REGIONS[c].includes(s)) {
          if (!statesByCountry[c]) statesByCountry[c] = new Set();
          statesByCountry[c].add(s);
        }
      });
    });
  }

  const availableStatesByCountry: Record<string, string[]> = {};
  for (const [country, states] of Object.entries(statesByCountry)) {
    availableStatesByCountry[country] = Array.from(states).sort((a, b) => a.localeCompare(b));
  }

  return {
    availableCountries: Array.from(countrySet).sort((a, b) => a.localeCompare(b)),
    availableStatesByCountry
  };
}
