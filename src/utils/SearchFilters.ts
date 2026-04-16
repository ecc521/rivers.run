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
  favoritesOnly?: boolean;
  distanceMax?: number;
  userLat?: number;
  userLon?: number;
  sortBy?: "none" | "alphabetical" | "skill" | "class" | "running" | "state";
  sortReverse?: boolean;
  listId?: string;
  listData?: { id: string; order: number }[];
  mapRadiusMode?: "current" | "center" | "custom";
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
  sortBy: "alphabetical",
  sortReverse: false,
};

export function hasActiveFilters(query: AdvancedSearchQuery): boolean {
  if (query.favoritesOnly) return true;
  if (query.listId) return true;
  if (query.listData && query.listData.length > 0) return true;
  if (query.distanceMax !== undefined) return true;
  if (query.name) return true;
  if (query.section) return true;
  if (query.skillMin !== defaultAdvancedSearchQuery.skillMin) return true;
  if (query.skillMax !== defaultAdvancedSearchQuery.skillMax) return true;
  if (query.flowMin !== defaultAdvancedSearchQuery.flowMin) return true;
  if (query.flowMax !== defaultAdvancedSearchQuery.flowMax) return true;
  if (query.includeUnknownSkill !== defaultAdvancedSearchQuery.includeUnknownSkill) return true;
  if (query.includeUnknownFlow !== defaultAdvancedSearchQuery.includeUnknownFlow) return true;
  if (query.includeDams !== defaultAdvancedSearchQuery.includeDams) return true;
  return false;
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

function getTagArray(tags: any): string[] {
  if (Array.isArray(tags)) return tags;
  if (tags) return [tags];
  return [];
}


function matchNormalSearch(r: RiverData, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const searchStr = [
    r.name || "",
    r.section || "",
    ...getTagArray(r.tags),
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
    case "alphabetical": return (r.name || "").toLowerCase();
    case "skill": return skillToNumber(r.skill || "");
    case "class": return r.class || "";
    case "running": return r.running ?? -1;
    case "state": return (r.states || "").toLowerCase();
    default: return 0;
  }
}

function getSearchRelevanceScore(r: RiverData, terms: string[]): number {
  if (terms.length === 0) return 0;
  let score = 0;
  
  const name = (r.name || "").toLowerCase();
  const section = (r.section || "").toLowerCase();
  
  const tagsStr = [
    ...getTagArray(r.tags),
    r.isGauge ? "gauge" : "",
    ...(r.gauges ? r.gauges.map(g => g.name || "").filter(Boolean) : [])
  ].join(" ").toLowerCase();


  for (const term of terms) {
    const t = term.toLowerCase();
    const escapedTerm = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`(^|[^a-z0-9])${escapedTerm}`, 'i'); 

    if (name === t) {
      score += 100;
    } else if (name.startsWith(t)) {
      score += 80;
    } else if (prefixRegex.test(name)) {
      score += 60;
    } else if (name.includes(t)) {
      score += 30;
    } else if (section === t) {
      score += 50; 
    } else if (section.startsWith(t)) {
      score += 40;
    } else if (prefixRegex.test(section)) {
      score += 30;
    } else if (section.includes(t)) {
      score += 15;
    } else if (prefixRegex.test(tagsStr)) {
      score += 10;
    } else if (tagsStr.includes(t)) {
      score += 2;
    }
  }
  return score;
}

export function filterRivers(
  rivers: RiverData[],
  query: AdvancedSearchQuery,
): RiverData[] {
  let list = [...rivers];

  if (query.listData && query.listData.length > 0) {
    const validIds = new Set(query.listData.map(l => l.id));
    list = list.filter((r) => validIds.has(r.id));
  }

  const terms = query.normalSearch 
    ? query.normalSearch.toLowerCase().split(/[ ,]+/).filter(t => t.length > 0) 
    : [];

  list = list.filter((r) => {
    if (!matchNormalSearch(r, terms)) return false;
    if (!matchExplicitMatch(r, query)) return false;
    if (!matchSkill(r, query)) return false;
    if (!matchFlow(r, query)) return false;
    if (!matchProximity(r, query)) return false;
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
        const aScore = getSearchRelevanceScore(a.value, terms);
        const bScore = getSearchRelevanceScore(b.value, terms);
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
    const mapped = list.map((r, i) => ({ 
      index: i, 
      value: r,
      score: getSearchRelevanceScore(r, terms)
    }));
    mapped.sort((a, b) => {
      const aGauge = !!a.value.isGauge;
      const bGauge = !!b.value.isGauge;

      // 1. Strictly Rivers above Gauges (ONLY IF "gauge" is NOT in search terms)
      if (terms.indexOf("gauge") === -1) {
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
      
      // 4. Preserve original order
      return a.index - b.index; // Preserve original order
    });
    list = mapped.map(m => m.value);
  }

  return list;
}
