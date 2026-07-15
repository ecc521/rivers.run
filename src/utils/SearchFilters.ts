import { getRiverCountries, type CountryCode } from "./regions";
import type { RiverData } from "../types/River";
import { lambert } from "./distance";

export interface AdvancedSearchQuery {
  normalSearch?: string;
  name?: string;
  section?: string;
  skillMin?: number;
  skillMax?: number;
  flowMin?: number;
  flowMax?: number;
  includeUnknownSkill?: boolean;
  includeUnknownFlow?: boolean;
  includeDams?: boolean;
  includeGauges?: boolean;
  distanceMax?: number;
  userLat?: number;
  userLon?: number;
  sortBy?: "none" | "alphabetical" | "skill" | "class" | "running" | "state";
  sortReverse?: boolean;
  listId?: string;
  listData?: { id: string; order: number }[];
  mapRadiusMode?: "current" | "center" | "custom";
  country?: string; 
  state?: string;
  favoritesOnly?: boolean;
}

export const defaultAdvancedSearchQuery: AdvancedSearchQuery = {
  normalSearch: "",
  skillMin: 1,
  skillMax: 8,
  flowMin: 0,
  flowMax: 4,
  includeUnknownSkill: true,
  includeUnknownFlow: true,
  includeDams: true,
  includeGauges: true,
  sortReverse: false,
};

// URL/query-string keys that express search intent. Used both for shareable
// links and for the saved "home" startup view. Kept here so the parse/serialize
// pair below and the Home page stay in sync.
export const SEARCH_PARAM_KEYS = [
  "search", "name", "section", "distanceMax", "radiusMode", "userLat", "userLon",
  "skillMin", "skillMax", "flowMin", "flowMax", "sortBy", "sortReverse",
  "country", "state", "list",
] as const;

// Serialize a query into a canonical (sorted) URL param string. Params are
// sorted so two equivalent queries produce identical strings — this is what
// makes the "is this view my home?" comparison reliable. By default the
// live-location coords (userLat/userLon) are omitted so a "near me" view
// recomputes against the user's current position rather than freezing; pass
// { includeCoords: true } for share links that should pin an exact origin.
export function serializeQueryToParams(
  query: AdvancedSearchQuery,
  opts: { includeCoords?: boolean } = {},
): string {
  const params = new URLSearchParams();
  const set = (key: string, val: unknown, def?: unknown) => {
    if (val !== undefined && val !== null && val !== "" && val !== def) {
      params.set(key, String(val));
    }
  };

  set("search", query.normalSearch);
  set("name", query.name);
  set("section", query.section);
  set("list", query.listId);
  if (query.distanceMax) {
    params.set("distanceMax", String(query.distanceMax));
    set("radiusMode", query.mapRadiusMode, "current");
    if (opts.includeCoords) {
      set("userLat", query.userLat);
      set("userLon", query.userLon);
    }
  }
  set("skillMin", query.skillMin, 1);
  set("skillMax", query.skillMax, 8);
  set("flowMin", query.flowMin, 0);
  set("flowMax", query.flowMax, 4);
  set("country", query.country);
  set("state", query.state);
  set("sortBy", query.sortBy, "none");
  if (query.sortReverse) params.set("sortReverse", "true");

  params.sort();
  return params.toString();
}

// Parse a URLSearchParams (from the address bar or a saved home value) back into
// an AdvancedSearchQuery, layered onto the defaults.
export function parseParamsToQuery(params: URLSearchParams): AdvancedSearchQuery {
  const q: AdvancedSearchQuery = { ...defaultAdvancedSearchQuery };

  const search = params.get("search");
  if (search) q.normalSearch = search;

  const name = params.get("name");
  if (name) q.name = name;

  const section = params.get("section");
  if (section) q.section = section;

  const distMax = params.get("distanceMax");
  if (distMax) {
    q.distanceMax = parseInt(distMax);
    q.mapRadiusMode = (params.get("radiusMode") as AdvancedSearchQuery["mapRadiusMode"]) || "current";
    const lat = params.get("userLat");
    const lon = params.get("userLon");
    if (lat) q.userLat = parseFloat(lat);
    if (lon) q.userLon = parseFloat(lon);
  }

  const sMin = params.get("skillMin");
  if (sMin) q.skillMin = parseInt(sMin);
  const sMax = params.get("skillMax");
  if (sMax) q.skillMax = parseInt(sMax);
  const fMin = params.get("flowMin");
  if (fMin) q.flowMin = parseFloat(fMin);
  const fMax = params.get("flowMax");
  if (fMax) q.flowMax = parseFloat(fMax);

  const sortBy = params.get("sortBy") as AdvancedSearchQuery["sortBy"];
  if (sortBy) q.sortBy = sortBy;
  else if (search) q.sortBy = "none";

  const country = params.get("country");
  if (country) {
    // Legacy pre-rename values (bookmarked/shared links predating the
    // canonical ISO country codes). "uk_ireland" has no single successor
    // since it's been split into GB/IE, so it maps to "all countries".
    const legacyMap: Record<string, string | undefined> = { usa: "US", ec: "CA", uk_ireland: undefined };
    q.country = country.toLowerCase() in legacyMap ? legacyMap[country.toLowerCase()] : country;
  }
  const state = params.get("state");
  if (state) q.state = state;

  const sortReverse = params.get("sortReverse");
  if (sortReverse) q.sortReverse = sortReverse === "true";

  const list = params.get("list");
  if (list) q.listId = list;

  return q;
}

// Normalize a stored homePageDefaultSearch value into a canonical param string
// for comparison. Supports the generic "query:<params>" form as well as the
// legacy "list:<id>" form (which predates arbitrary saved searches).
export function normalizeHomeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("query:")) {
    return serializeQueryToParams(parseParamsToQuery(new URLSearchParams(value.slice("query:".length))));
  }
  if (value.startsWith("list:")) {
    return serializeQueryToParams(parseParamsToQuery(new URLSearchParams(`list=${value.slice("list:".length)}`)));
  }
  return null;
}

export function hasActiveFilters(query: AdvancedSearchQuery): boolean {
  if (query.listId && query.listId.trim() !== "") return true;
  if (query.listData && query.listData.length > 0) return true;
  if (query.distanceMax != null && query.distanceMax <= 500) return true;
  if (query.name && query.name.trim() !== "") return true;
  if (query.section && query.section.trim() !== "") return true;
  if (query.state && query.state.trim() !== "") return true;
  
  if (query.skillMin !== undefined && query.skillMin !== defaultAdvancedSearchQuery.skillMin) return true;
  if (query.skillMax !== undefined && query.skillMax !== defaultAdvancedSearchQuery.skillMax) return true;
  if (query.flowMin !== undefined && query.flowMin !== defaultAdvancedSearchQuery.flowMin) return true;
  if (query.flowMax !== undefined && query.flowMax !== defaultAdvancedSearchQuery.flowMax) return true;
  
  if (query.includeUnknownSkill !== undefined && query.includeUnknownSkill !== defaultAdvancedSearchQuery.includeUnknownSkill) return true;
  if (query.includeUnknownFlow !== undefined && query.includeUnknownFlow !== defaultAdvancedSearchQuery.includeUnknownFlow) return true;
  if (query.includeDams !== undefined && query.includeDams !== defaultAdvancedSearchQuery.includeDams) return true;
  if (query.includeGauges !== undefined && query.includeGauges !== defaultAdvancedSearchQuery.includeGauges) return true;
  
  return false;
}

// Count the filters that actually REMOVE markers from the map. The distance
// radius is deliberately excluded: on the map it never hides markers (it only
// draws an indicator circle), so it is the neutral default, not a filter.
// sortBy is excluded too — marker order is not visible. Used to badge the map's
// Filter button so a filtered (or deep-linked) view isn't silently hiding rivers.
export function countMapActiveFilters(query: AdvancedSearchQuery): number {
  const d = defaultAdvancedSearchQuery;
  const hasText = (v?: string) => !!v && v.trim() !== "";
  // Each entry is one filter "category"; treating undefined as the default
  // (?? d.x) avoids counting an unset field as an active filter.
  const active: boolean[] = [
    hasText(query.normalSearch),
    hasText(query.name),
    hasText(query.section),
    hasText(query.state),
    hasText(query.country) && query.country !== "global",
    hasText(query.listId) || !!query.listData?.length,
    !!query.favoritesOnly,
    (query.skillMin ?? d.skillMin) !== d.skillMin || (query.skillMax ?? d.skillMax) !== d.skillMax,
    (query.flowMin ?? d.flowMin) !== d.flowMin || (query.flowMax ?? d.flowMax) !== d.flowMax,
    (query.includeUnknownSkill ?? d.includeUnknownSkill) !== d.includeUnknownSkill ||
      (query.includeUnknownFlow ?? d.includeUnknownFlow) !== d.includeUnknownFlow ||
      (query.includeDams ?? d.includeDams) !== d.includeDams ||
      (query.includeGauges ?? d.includeGauges) !== d.includeGauges,
  ];
  return active.filter(Boolean).length;
}

function skillToNumber(skill: string | number): number {
  if (typeof skill === "number") return skill;
  const map: Record<string, number> = {
    FW: 1,
    B: 2,
    N: 3,
    LI: 4,
    I: 5,
    HI: 6,
    A: 7,
    E: 8,
  };
  return map[skill.toUpperCase()] || Infinity;
}


function getTagsArray(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return [tags];
}

// Populates the _searchString/_lowerName/_lowerSection/_searchTags cache fields
// that matchNormalSearch/getSearchRelevanceScore read (see BREADCRUMB comment on
// RiverData). Call once per river when data is fetched/enriched, not per search —
// these strings are otherwise rebuilt from scratch on every keystroke.
export function computeSearchCache(r: RiverData): void {
  const tags = getTagsArray(r.tags);
  const gaugeNames = r.gauges ? r.gauges.map(g => g.name || "").filter(Boolean) : [];
  r._lowerName = String(r.name || "").toLowerCase();
  r._lowerSection = String(r.section || "").toLowerCase();
  r._searchTags = [...tags, r.isGauge ? "gauge" : "", ...gaugeNames].join(" ").toLowerCase();
  r._searchString = [r.name || "", r.section || "", ...tags, r.isGauge ? "gauge" : "", ...gaugeNames].join(" ").toLowerCase();
}


function matchNormalSearch(r: RiverData, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const searchStr = r._searchString || [
    r.name || "",
    r.section || "",
    ...getTagsArray(r.tags),
    r.isGauge ? "gauge" : "",
    ...(r.gauges ? r.gauges.map(g => g.name || "").filter(Boolean) : [])
  ].join(" ").toLowerCase();
  return terms.every(term => searchStr.includes(term));
}

function matchExplicitMatch(r: RiverData, query: AdvancedSearchQuery): boolean {
  if (query.name && !String(r.name || "").toLowerCase().includes(query.name!.toLowerCase())) {
     return false;
  }
  if (query.section && !String(r.section || "").toLowerCase().includes(query.section!.toLowerCase())) {
     return false;
  }
  return true;
}

function matchSkill(r: RiverData, query: AdvancedSearchQuery): boolean {
  if (query.skillMin !== undefined && query.skillMax !== undefined) {
    const s = skillToNumber(r.skill || "");
    if (s === Infinity) return !!query.includeUnknownSkill;
    return s >= query.skillMin! && s <= query.skillMax!;
  }
  return true;
}

function matchFlow(r: RiverData, query: AdvancedSearchQuery): boolean {
  if (query.flowMin !== undefined && query.flowMax !== undefined) {
    if (r.dam && query.includeDams) return true;
    if (r.running === undefined) return !!query.includeUnknownFlow;
    return r.running >= query.flowMin! && r.running <= query.flowMax!;
  }
  return true;
}

function matchProximity(r: RiverData, query: AdvancedSearchQuery): boolean {
  if (query.distanceMax && query.userLat && query.userLon) {
    if (!r.accessPoints || r.accessPoints.length === 0) return false;
    const start = r.accessPoints[0];
    const rLat = start.lat;
    const rLon = start.lon;
    if (!rLat || !rLon) return false;
    
    const distanceMiles = lambert(query.userLat!, query.userLon!, rLat, rLon);
    return distanceMiles <= query.distanceMax!;
  }
  return true;
}

function getSortKey(r: RiverData, sortBy: string): any {
  switch (sortBy) {
    case "alphabetical": return String(r.name || "").toLowerCase();
    case "skill": return skillToNumber(r.skill || "");
    case "class": return r.class || "";
    case "running": return r.running ?? -1;
    case "state": return String(r.states || "").toLowerCase();
    default: return 0;
  }
}

function getSearchRelevanceScore(r: RiverData, terms: string[], regexes: RegExp[]): number {
  if (terms.length === 0) return 0;
  let score = 0;
  
  const lowerName = r._lowerName || String(r.name || "").toLowerCase();
  const lowerSection = r._lowerSection || String(r.section || "").toLowerCase();
  const searchTags = r._searchTags || [
    ...getTagsArray(r.tags),
    r.isGauge ? "gauge" : "",
    ...(r.gauges ? r.gauges.map(g => g.name || "").filter(Boolean) : [])
  ].join(" ").toLowerCase();
  
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const prefixRegex = regexes[i]; 

    if (lowerName === t) score += 100;
    else if (lowerName.startsWith(t)) score += 80;
    else if (prefixRegex.test(lowerName)) score += 60;
    else if (lowerName.includes(t)) score += 30;
    
    else if (lowerSection === t) score += 50; 
    else if (lowerSection.startsWith(t)) score += 40;
    else if (prefixRegex.test(lowerSection)) score += 30;
    else if (lowerSection.includes(t)) score += 15;
    
    else if (prefixRegex.test(searchTags)) score += 10;
    else if (searchTags.includes(t)) score += 2;
  }
  return score;
}

export function filterRivers(
  rivers: RiverData[],
  query: AdvancedSearchQuery,
): RiverData[] {
  let list = [...rivers];

  if (query.listData) {
    const validIds = new Set(query.listData.map(l => l.id));
    list = list.filter((r) => validIds.has(r.id));
  }

  const terms = query.normalSearch 
    ? query.normalSearch.toLowerCase().split(/[ ,]+/).filter(t => t.length > 0) 
    : [];
    
  const termRegexes = terms.map(t => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'i'));

  list = list.filter((r) => {
    if (query.country && query.country !== "global") {
       const countries = getRiverCountries(r);
       if (!countries.has(query.country as CountryCode)) return false;
    }
    if (query.state) {
        const rStates = (r.states || "").toUpperCase().split(/[ ,]+/).filter(Boolean);
        if (!rStates.includes(query.state.toUpperCase())) return false;
    }
    if (!matchNormalSearch(r, terms)) return false;
    if (!matchExplicitMatch(r, query)) return false;
    if (!matchSkill(r, query)) return false;
    if (!matchFlow(r, query)) return false;
    if (!matchProximity(r, query)) return false;
    if (query.includeGauges === false && r.isGauge) return false;
    return true;
  });

  // Sorting
  if (query.sortBy && query.sortBy !== "none") {
    const isAlphabetical = query.sortBy === "alphabetical";
    const mapped = list.map((r, i) => ({ 
        index: i, 
        value: r, 
        sortKey: getSortKey(r, query.sortBy!),
    }));
    
    mapped.sort((a, b) => {
      // Gauge separation ONLY for alphabetical sort
      if (isAlphabetical && terms.indexOf("gauge") === -1) {
        const aGauge = !!a.value.isGauge;
        const bGauge = !!b.value.isGauge;
        if (!aGauge && bGauge) return -1;
        if (aGauge && !bGauge) return 1;
      }

      // Respect search relevance for alphabetical sort if search terms exist
      if (isAlphabetical && terms.length > 0) {
        const aScore = getSearchRelevanceScore(a.value, terms, termRegexes);
        const bScore = getSearchRelevanceScore(b.value, terms, termRegexes);
        if (aScore !== bScore) {
          return bScore - aScore;
        }
      }

      let cmp = 0;
      if (a.sortKey > b.sortKey) cmp = 1;
      else if (a.sortKey < b.sortKey) cmp = -1;

      if (cmp !== 0) {
        return query.sortReverse ? -cmp : cmp;
      }
      
      return a.index - b.index;
    });

    list = mapped.map(m => m.value);

  } else if (query.listData && query.listData.length > 0) {
    // If no explicit sort is chosen but we have list constraints, sort by the implicit List Order!
    const orderMap = new Map(query.listData.map((ld) => [ld.id, ld.order]));
    const mapped = list.map((r, i) => ({ index: i, value: r, sortKey: orderMap.get(r.id) ?? Infinity }));
    
    mapped.sort((a, b) => {
      return a.sortKey - b.sortKey;
    });

    list = mapped.map(m => m.value);
  } else {
    // If no explicit sort and no list constraint, sort rivers above gauges
    // Prioritize full word matches in search
    const hasGaugeTerm = terms.indexOf("gauge") !== -1;
    const mapped = list.map((r, i) => ({
      index: i,
      value: r,
      score: getSearchRelevanceScore(r, terms, termRegexes),
      // Precomputed once per item (uses the cache if computeSearchCache already
      // ran) instead of re-lowercasing both names on every O(n log n) comparison.
      lowerName: r._lowerName || String(r.name || "").toLowerCase(),
    }));
    mapped.sort((a, b) => {
      const aGauge = !!a.value.isGauge;
      const bGauge = !!b.value.isGauge;

      // 1. Strictly Rivers above Gauges (ONLY IF "gauge" is NOT in search terms)
      if (!hasGaugeTerm) {
        if (!aGauge && bGauge) return -1;
        if (aGauge && !bGauge) return 1;
      }

      // 2. Sort by search relevance
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      // 3. Tiebreaker: Rivers above Gauges (Fallthrough)
      if (!aGauge && bGauge) return -1;
      if (aGauge && !bGauge) return 1;

      // 4. Alphabetical fallback when no search terms, otherwise preserve order
      if (terms.length === 0) {
        if (a.lowerName < b.lowerName) return -1;
        if (a.lowerName > b.lowerName) return 1;
      }
      return a.index - b.index;
    });
    list = mapped.map(m => m.value);
  }

  return list;
}
