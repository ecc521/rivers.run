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
  ratingMin?: number;
  ratingMax?: number;
  includeUnknownSkill?: boolean;
  includeUnknownFlow?: boolean;
  includeUnknownRating?: boolean;
  includeDams?: boolean;
  favoritesOnly?: boolean;
  distanceMax?: number;
  userLat?: number;
  userLon?: number;
  sortBy?: "none" | "alphabetical" | "rating" | "skill" | "class" | "running";
  sortReverse?: boolean;
  listData?: { id: string; order: number }[];
}

export const defaultAdvancedSearchQuery: AdvancedSearchQuery = {
  normalSearch: "",
  skillMin: 1,
  skillMax: 8,
  flowMin: 0,
  flowMax: 4,
  ratingMin: 1,
  ratingMax: 5,
  includeUnknownSkill: true,
  includeUnknownFlow: true,
  includeUnknownRating: true,
  includeDams: true,
  sortBy: "none",
  sortReverse: false,
};

function skillToNumber(skill: string): number {
  const map: Record<string, number> = {
    FW: 1,
    B: 2,
    N: 3,
    "LI-": 3.5,
    LI: 4,
    "LI+": 4.5,
    "I-": 4.5,
    I: 5,
    "I+": 5.5,
    "HI-": 5.5,
    HI: 6,
    "HI+": 6.5,
    "A-": 6.5,
    A: 7,
    "A+": 7.5,
    "E-": 7.5,
    E: 8,
    "E+": 8.5,
  };
  return map[skill] || Infinity;
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

  // 1. Normal Search (matches Name, Section, or Tags)
  if (query.normalSearch) {
    const term = query.normalSearch.toLowerCase();
    list = list.filter(
      (r) =>
        String(r.name || "").toLowerCase().includes(term) ||
        String(r.section || "").toLowerCase().includes(term) ||
        (Array.isArray(r.tags) ? r.tags : (r.tags ? [r.tags] : [])).some(t => String(t).toLowerCase().includes(term)),
    );
  }

  // 2. Name / Section explicit matches
  if (query.name) {
    list = list.filter((r) =>
      String(r.name || "").toLowerCase().includes(query.name!.toLowerCase()),
    );
  }
  if (query.section) {
    list = list.filter((r) =>
      String(r.section || "").toLowerCase().includes(query.section!.toLowerCase()),
    );
  }

  // 3. Skill
  if (query.skillMin !== undefined && query.skillMax !== undefined) {
    list = list.filter((r) => {
      const s = skillToNumber(r.skill || "");
      if (s === Infinity) return query.includeUnknownSkill;
      return s >= query.skillMin! && s <= query.skillMax!;
    });
  }

  // 4. Rating
  if (query.ratingMin !== undefined && query.ratingMax !== undefined) {
    list = list.filter((r) => {
      const rate = Number(r.rating);
      if (r.rating == null || isNaN(rate) || rate < 0)
        return query.includeUnknownRating;
      return rate >= query.ratingMin! && rate <= query.ratingMax!;
    });
  }

  // 5. Flow
  if (query.flowMin !== undefined && query.flowMax !== undefined) {
    list = list.filter((r) => {
      if (r.dam && query.includeDams) return true;
      if (r.running === undefined)
        return query.includeUnknownFlow;
      return r.running >= query.flowMin! && r.running <= query.flowMax!;
    });
  }

  // 6. Proximity / Distance boundaries
  if (query.distanceMax && query.userLat && query.userLon) {
    list = list.filter((r) => {
      if (!r.accessPoints || r.accessPoints.length === 0) return false;
      const start = r.accessPoints[0];
      const rLat = start.lat;
      const rLon = start.lon;
      if (!rLat || !rLon) return false;
      
      const distanceMiles = lambert(query.userLat!, query.userLon!, rLat, rLon);
      return distanceMiles <= query.distanceMax!;
    });
  }

  // Sorting
  if (query.sortBy && query.sortBy !== "none") {
    list.sort((a, b) => {
      let valA: any, valB: any;
      switch (query.sortBy) {
        case "alphabetical":
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
          break;
        case "rating":
          valA = (a.rating == null || Number(a.rating) < 0) ? -1 : Number(a.rating);
          valB = (b.rating == null || Number(b.rating) < 0) ? -1 : Number(b.rating);
          break;
        case "skill":
          valA = skillToNumber(a.skill || "");
          valB = skillToNumber(b.skill || "");
          break;
        case "class":
          valA = a.class || "";
          valB = b.class || ""; // Note: simplified class sort
          break;
        case "running":
          valA = a.running ?? -1;
          valB = b.running ?? -1;
          break;
        default:
          return 0;
      }
      if (valA > valB) return 1;
      if (valA < valB) return -1;
      return 0;
    });

    if (query.sortReverse) {
      list.reverse();
    }
  } else if (query.listData && query.listData.length > 0) {
    // If no explicit sort is chosen but we have list constraints, sort by the implicit List Order!
    const orderMap = new Map(query.listData.map((ld) => [ld.id, ld.order]));
    list.sort((a, b) => {
       const orderA = orderMap.get(a.id) ?? Infinity;
       const orderB = orderMap.get(b.id) ?? Infinity;
       return orderA - orderB;
    });
  }

  return list;
}
