import { describe, it, expect } from "vitest";
import { filterRivers, type AdvancedSearchQuery, defaultAdvancedSearchQuery } from "./SearchFilters";
import type { RiverData } from "../types/River";

const mockRivers: RiverData[] = [
  {
    id: "r1",
    name: "Lower Green River",
    section: "Tuxedo to Fish Top",
    skill: 5, // Intermediate (Numeric)
    running: 2.5, // Between mid and high (flow max is 4 usually in UI terms, assume running is a normalized value 0-4 or raw CFS)
    accessPoints: [{ lat: 35.2443, lon: -82.3524 }], // random coordinates roughly in NC
    tags: ["dam release", "classic"],
    class: "III"
  } as RiverData,
  {
    id: "r2",
    name: "Ocoee River",
    section: "Middle",
    skill: 7, // Advanced (Numeric)
    running: 3, 
    accessPoints: [{ lat: 35.088, lon: -84.508 }],
    class: "III-IV"
  } as RiverData,
  {
    id: "r3",
    name: "Gauley River",
    section: "Upper",
    skill: "E", // Expert
    running: 4,
    accessPoints: [{ lat: 38.252, lon: -80.895 }],
    class: "V"
  } as RiverData,
  {
    id: "r4",
    name: "Nantahala River",
    section: "Powerhouse to Wesser",
    skill: "N", // Novice
    running: 2,
    accessPoints: [{ lat: 35.281, lon: -83.639 }],
    class: "II"
  } as RiverData,
  {
    id: "r5",
    name: "French Broad",
    section: "Section 9",
    skill: "I", 
    running: undefined, // Unknown flow
    accessPoints: [{ lat: 35.807, lon: -82.809 }], 
    class: "II-III"
  } as RiverData
];

describe("SearchFilters", () => {
  describe("filterRivers", () => {
    it("returns all rivers with default query", () => {
      const results = filterRivers(mockRivers, defaultAdvancedSearchQuery);
      expect(results.length).toBe(mockRivers.length);
    });

    it("filters by fuzzy string matching in name/section/tags (e.g. 'lower green')", () => {
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        normalSearch: "lower green"
      };
      const results = filterRivers(mockRivers, query);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("r1");
    });

    it("filters by explicit name and section", () => {
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        name: "River",
        section: "Middle"
      };
      const results = filterRivers(mockRivers, query);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("r2");
    });

    it("filters by skill range (numeric)", () => {
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        skillMin: 1, // FW
        skillMax: 4, // LI
        includeUnknownSkill: false
      };
      const results = filterRivers(mockRivers, query);
      // Only r4 (Novice, which is 3) should match
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("r4");
    });

    it("filters by skill range (mixed strings and numbers)", () => {
      const mixedRivers: RiverData[] = [
        { id: "s1", skill: "I" } as RiverData, // 5
        { id: "s2", skill: 5 } as RiverData,   // 5
        { id: "s3", skill: "E" } as RiverData, // 8
        { id: "s4", skill: 8 } as RiverData,   // 8
      ];
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        skillMin: 5,
        skillMax: 5
      };
      const results = filterRivers(mixedRivers, query);
      expect(results.length).toBe(2);
      expect(results.some(r => r.id === "s1")).toBe(true);
      expect(results.some(r => r.id === "s2")).toBe(true);
    });

    it("filters by distance (lambert projection approximation)", () => {
      // User is right at the Lower Green put-in
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        userLat: 35.2443,
        userLon: -82.3524,
        distanceMax: 10 // Only rivers within 10 miles. r1 matches.
      };
      const results = filterRivers(mockRivers, query);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Lower Green River");
    });

    it("applies sorting using Schwartzian transform", () => {
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        sortBy: "alphabetical"
      };
      const results = filterRivers(mockRivers, query);
      expect(results.length).toBe(5);
      expect(results[0].id).toBe("r5"); // French Broad
      expect(results[1].id).toBe("r3"); // Gauley
      expect(results[2].id).toBe("r1"); // Lower Green
    });

    it("sorts by implicit listData order appropriately", () => {
      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        listData: [
          { id: "r3", order: 1 },
          { id: "r1", order: 2 }
        ]
      };
      const results = filterRivers(mockRivers, query);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe("r3");
      expect(results[1].id).toBe("r1");
    });

    it("prioritizes prefix name matches over section word matches", () => {
      const searchMockRivers: RiverData[] = [
        {
          id: "swan",
          name: "Swan River",
          section: "Yarkin to Yough",
          isGauge: false,
        } as RiverData,
        {
          id: "yough",
          name: "Youghiogheny River",
          section: "Middle",
          isGauge: false,
        } as RiverData,
      ];

      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        normalSearch: "yough",
      };

      const results = filterRivers(searchMockRivers, query);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe("yough"); // Name prefix match (+80) > section word match (+30)
      expect(results[1].id).toBe("swan");
    });

    it("prioritizes full word matches over partial matches in search results sorting", () => {
      const searchMockRivers: RiverData[] = [
        {
          id: "partialMatch",
          name: "Saline River near Shaw",
          isGauge: false,
          tags: ["gauge"],
        } as RiverData,
        {
          id: "fullMatch",
          name: "Haw River",
          isGauge: true,
        } as RiverData,
      ];

      const query: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        normalSearch: "haw river gauge",
      };

      const results = filterRivers(searchMockRivers, query);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe("fullMatch");
      expect(results[1].id).toBe("partialMatch");
    });

    it("places rivers before gauges unless 'gauge' is in search terms", () => {
      const mixedMockRivers: RiverData[] = [
        {
          id: "gauge2",
          name: "Saline River Gauge",
          isGauge: true,
        } as RiverData,
        {
          id: "river1",
          name: "Saline River",
          isGauge: false,
        } as RiverData,
      ];

      // 1. Without 'gauge', River comes first despite equal relevance
      const queryNoGauge: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        normalSearch: "saline river",
      };
      
      const resultsNoGauge = filterRivers(mixedMockRivers, queryNoGauge);
      expect(resultsNoGauge[0].id).toBe("river1");

      // 2. With 'gauge', Gauge gets more relevance points and comes first
      const queryWithGauge: AdvancedSearchQuery = {
        ...defaultAdvancedSearchQuery,
        normalSearch: "saline river gauge",
      };

      const resultsWithGauge = filterRivers(mixedMockRivers, queryWithGauge);
      expect(resultsWithGauge[0].id).toBe("gauge2");
    });
  });
});
