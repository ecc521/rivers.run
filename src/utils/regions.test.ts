import { describe, it, expect } from "vitest";
import { getRiverCountries, deriveRegionMap } from "./regions";
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

  describe("deriveRegionMap", () => {
    it("attributes a simple single-state, single-country row correctly (fast path)", () => {
      const map = deriveRegionMap([{ states: "KY", countries: "US" } as RiverData]);
      expect(map.get("KY")?.has("US")).toBe(true);
      expect(map.size).toBe(1);
    });

    it("rejects a state that doesn't actually belong to the row's country, even if a gauge implies that country", () => {
      // Regression test: a gauge whose provider metadata reports a bordering
      // country's state code (e.g. a Canadian EC gauge reporting state "ME")
      // must not attribute Maine to Canada — "ME" isn't a valid CA province.
      const river = {
        states: "ME",
        countries: "CA",
        gauges: [{ id: "EC:12345" }]
      } as any as RiverData;
      const map = deriveRegionMap([river]);
      expect(map.get("ME")?.has("CA")).toBeFalsy();
    });

    it("handles a genuine multi-country border river across both countries' valid states", () => {
      const river = { states: "WA, BC", countries: "US, CA" } as RiverData;
      const map = deriveRegionMap([river]);
      expect(map.get("WA")?.has("US")).toBe(true);
      expect(map.get("BC")?.has("CA")).toBe(true);
      // Cross-attribution should still be rejected even in the multi-value case
      expect(map.get("WA")?.has("CA")).toBeFalsy();
      expect(map.get("BC")?.has("US")).toBeFalsy();
    });

    it("falls back to gauge-prefix-implied country when countries is missing", () => {
      const river = { states: "ON", gauges: [{ id: "EC:12345" }] } as any as RiverData;
      const map = deriveRegionMap([river]);
      expect(map.get("ON")?.has("CA")).toBe(true);
    });

    it("falls back to state-implied country when countries is missing and there's no gauge", () => {
      const river = { states: "VA" } as RiverData;
      const map = deriveRegionMap([river]);
      expect(map.get("VA")?.has("US")).toBe(true);
    });

    it("ignores rows with no states value", () => {
      const map = deriveRegionMap([{ states: "", countries: "US" } as RiverData]);
      expect(map.size).toBe(0);
    });

    it("unions multiple rows into the same state bucket", () => {
      const rivers = [
        { states: "CO", countries: "US" } as RiverData,
        { states: "CO", countries: "US" } as RiverData,
        { states: "ON", countries: "CA" } as RiverData,
      ];
      const map = deriveRegionMap(rivers);
      expect(map.get("CO")?.has("US")).toBe(true);
      expect(map.get("ON")?.has("CA")).toBe(true);
      expect(map.size).toBe(2);
    });
  });
});
