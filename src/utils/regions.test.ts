import { describe, it, expect } from "vitest";
import { getRiverCountries } from "./regions";
import type { RiverData } from "../types/River";

describe("regions", () => {
  describe("getRiverCountries", () => {
    it("identifies US from state code", () => {
      const river = { states: "VA" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("US")).toBe(true);
      expect(countries.size).toBe(1);
    });

    it("identifies CA from province code", () => {
      const river = { states: "BC" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("CA")).toBe(true);
      expect(countries.size).toBe(1);
    });

    it("identifies both for border crossing", () => {
      const river = { states: "WA, BC" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("US")).toBe(true);
      expect(countries.has("CA")).toBe(true);
      expect(countries.size).toBe(2);
    });

    it("identifies country from gauge prefix", () => {
      const river = {
        states: "",
        gauges: [{ id: "USGS:12345" }]
      } as any as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("US")).toBe(true);
    });

    it("identifies UK from GB gauge prefix", () => {
      const river = { states: "", gauges: [{ id: "EA:12345" }] } as any as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("GB")).toBe(true);
    });

    it("identifies Ireland from IE gauge prefix", () => {
      const river = { states: "", gauges: [{ id: "IE:12345" }] } as any as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("IE")).toBe(true);
    });

    it("identifies GB subdivisions", () => {
      const river = { states: "ENG" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("GB")).toBe(true);
    });

    it("returns an empty set when nothing is recognized", () => {
      // Malformed data (e.g. a stray value not matching any known state,
      // country, or gauge prefix) is no longer defensively reinterpreted —
      // validation at the editor/API boundary is what prevents this data
      // from existing in the first place.
      const river = { states: "UNKNOWN" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.size).toBe(0);
    });

    it("uses the explicit countries field when present", () => {
      const river = { states: "", countries: "FR" } as RiverData;
      const countries = getRiverCountries(river);
      expect(countries.has("FR")).toBe(true);
      expect(countries.size).toBe(1);
    });
  });
});
