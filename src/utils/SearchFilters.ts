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
  sortBy?: "none" | "alphabetical" | "skill" | "class" | "running";
  sortReverse?: boolean;
  listData?: { id: string; order: number }[];
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
  sortBy: "none",
  sortReverse: false,
};

export function hasActiveFilters(query: AdvancedSearchQuery): boolean {
  if (query.favoritesOnly) return true;
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

function skillToNumber(skill: string): number {
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

function matchNormalSearch(r: RiverData, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const searchStr = [
    r.name || "",
    r.section || "",
    ...(Array.isArray(r.tags) ? r.tags : (r.tags ? [r.tags] : [])),
    r.isGauge ? "gauge" : ""
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
    default: return 0;
  }
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
    const mapped = list.map((r, i) => ({ index: i, value: r, sortKey: getSortKey(r, query.sortBy!) }));
    
    mapped.sort((a, b) => {
      if (a.sortKey > b.sortKey) return 1;
      if (a.sortKey < b.sortKey) return -1;
      return 0;
    });

    list = mapped.map(m => m.value);

    if (query.sortReverse) {
      list.reverse();
    }
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
    const mapped = list.map((r, i) => ({ index: i, value: r }));
    mapped.sort((a, b) => {
      const aGauge = !!a.value.isGauge;
      const bGauge = !!b.value.isGauge;
      if (aGauge && !bGauge) return 1;
      if (!aGauge && bGauge) return -1;
      return a.index - b.index; // Preserve original order
    });
    list = mapped.map(m => m.value);
  }

  return list;
}
