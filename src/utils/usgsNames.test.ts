import { describe, it, expect } from "vitest";
import { formatGaugeName } from "./usgsNames";

describe("formatGaugeName", () => {
    it("should correctly split standard location delimiters into name and section", () => {
        expect(formatGaugeName("HAW RIVER AT HAW RIVER, NC")).toEqual({ name: "Haw River", section: "At Haw River, NC" });
        expect(formatGaugeName("DEEP RIVER AT RAMSEUR, NC")).toEqual({ name: "Deep River", section: "At Ramseur, NC" });
        expect(formatGaugeName("COLORADO RIVER NEAR GRAND CANYON, AZ")).toEqual({ name: "Colorado River", section: "Near Grand Canyon, AZ" });
        expect(formatGaugeName("POTOMAC RIVER AT LITTLE FALLS PUMP STA, MD")).toEqual({ name: "Potomac River", section: "At Little Falls Pump Sta, MD" });
    });

    it("should correctly handle state codes without commas", () => {
        expect(formatGaugeName("LOWER GREEN RIVER AT TUXEDO NC")).toEqual({ name: "Lower Green River", section: "At Tuxedo NC" });
        expect(formatGaugeName("COLORADO RIVER NEAR CISCO UT")).toEqual({ name: "Colorado River", section: "Near Cisco UT" });
        expect(formatGaugeName("PUMP STA NEAR WASHINGTON DC")).toEqual({ name: "Pump Sta", section: "Near Washington DC" });
    });

    it("should preserve standard acronyms and Roman numerals", () => {
        expect(formatGaugeName("SOUTH FORK NEW RIVER NO I")).toEqual({ name: "South Fork New River No I" });
        expect(formatGaugeName("USGS GAUGE ON THE RIVER")).toEqual({ name: "USGS Gauge on the River" });
        expect(formatGaugeName("TVA DAM BELOW NWS STATION III")).toEqual({ name: "TVA Dam", section: "Below NWS Station III" });
    });

    it("should handle punctuation and abbreviations", () => {
        expect(formatGaugeName("N.F. CLEARWATER RIVER")).toEqual({ name: "N.F. Clearwater River" });
        expect(formatGaugeName("S. FORK COAL RIVER AT ASHFORD, WV")).toEqual({ name: "S. Fork Coal River", section: "At Ashford, WV" });
    });

    it("should expand abbreviations like nr, blw, abv, br, cr with proper casing", () => {
        expect(formatGaugeName("ANACONTIA RIVER NR COLESVILLE, MD")).toEqual({ name: "Anacontia River", section: "Near Colesville, MD" });
        expect(formatGaugeName("RIVER BLW DAM")).toEqual({ name: "River", section: "Below Dam" });
        expect(formatGaugeName("RIVER ABV FALLS")).toEqual({ name: "River", section: "Above Falls" });
        expect(formatGaugeName("NORTHWEST BR ANACOSTIA RIVER")).toEqual({ name: "Northwest Branch Anacostia River" });
        expect(formatGaugeName("SALINE RIVER CR")).toEqual({ name: "Saline River Creek" });
    });

    it("should not expand abbreviations when they are part of a larger word", () => {
        expect(formatGaugeName("BRADLEY CREEK NR TOWN")).toEqual({ name: "Bradley Creek", section: "Near Town" });
        expect(formatGaugeName("ABVVILLE RIVER")).toEqual({ name: "Abvville River" });
    });

    it("should keep state codes capitalized when they appear at the end", () => {
        expect(formatGaugeName("WHITE RIVER AT ANDERSON IN")).toEqual({ name: "White River", section: "At Anderson IN" });
        expect(formatGaugeName("COLUMBIA RIVER AT THE DALLES OR")).toEqual({ name: "Columbia River", section: "At the Dalles OR" });
    });
});
