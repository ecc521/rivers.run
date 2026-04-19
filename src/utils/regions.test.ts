import { describe, it, expect } from "vitest";
import { getRiverCountries, deriveRegionMap, type CountryCode } from "./regions";
import type { RiverData } from "../types/River";

describe("regions", () => {
  describe("getRiverCountries", () => {
    it("identifies USA from state code", () => {
      const river = { states: "VA" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("usa")).toBe(true);
      expect(countries.size).toBe(1);
    });

    it("identifies Canada from province code", () => {
      const river = { states: "BC" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("canada")).toBe(true);
      expect(countries.size).toBe(1);
    });

    it("identifies both for border crossing", () => {
      const river = { states: "WA, BC" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("usa")).toBe(true);
      expect(countries.has("canada")).toBe(true);
      expect(countries.size).toBe(2);
    });

    it("identifies country from gauge prefix", () => {
      const river = { 
        states: "", 
        gauges: [{ id: "USGS:12345" }] 
      } as any as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("usa")).toBe(true);
    });

    it("uses dynamic map override", () => {
      const river = { states: "XX" } as RiverData;
      const dynamicMap = new Map<string, Set<CountryCode>>([
        ["XX", new Set(["france"])]
      ]);
      const countries = getRiverCountries(river, dynamicMap);
      expect(countries.has("france")).toBe(true);
    });

    it("fallbacks to global if unknown", () => {
      const river = { states: "UNKNOWN" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("global")).toBe(true);
    });
  });

  describe("deriveRegionMap", () => {
    it("learns state mapping from gauges", () => {
      const rivers = [
        { 
          states: "WA", 
          gauges: [{ id: "USGS:1" }] 
        },
        {
          states: "BC",
          gauges: [{ id: "EC:1" }]
        }
      ] as any as RiverData[];
      
      const map = deriveRegionMap(rivers);
      expect(map.get("WA")?.has("usa")).toBe(true);
      expect(map.get("BC")?.has("canada")).toBe(true);
    });
  });
});
