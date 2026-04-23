import { describe, it, expect } from "vitest";
import { getRiverCountries } from "./regions";
import type { RiverData } from "../types/River";

describe("regions", () => {
  describe("getRiverCountries", () => {
    it("identifies USA from state code", () => {
      const river = { states: "VA" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("usa")).toBe(true);
      expect(countries.size).toBe(1);
    });

    it("identifies EC from province code", () => {
      const river = { states: "BC" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("ec")).toBe(true);
      expect(countries.size).toBe(1);
    });

    it("identifies both for border crossing", () => {
      const river = { states: "WA, BC" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("usa")).toBe(true);
      expect(countries.has("ec")).toBe(true);
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



    it("fallbacks to global if unknown", () => {
      const river = { states: "UNKNOWN" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("global")).toBe(true);
    });

    it("identifies UK/Ireland from country code in states field", () => {
      const river = { states: "IE" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("uk_ireland")).toBe(true);
      
      const riverUK = { states: "UK" } as RiverData;
      const countriesUK = getRiverCountries(riverUK);
      expect(countriesUK.has("uk_ireland")).toBe(true);
    });

  });


});
