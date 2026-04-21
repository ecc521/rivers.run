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

    it("should expand abbreviations like nr, blw, abv, br, cr with proper casing", () => {
        expect(formatGaugeName("ANACONTIA RIVER NR COLESVILLE, MD")).toEqual({ name: "Anacontia River", section: "Near Colesville, MD" });
        expect(formatGaugeName("RIVER BLW DAM")).toEqual({ name: "River", section: "Below Dam" });
        expect(formatGaugeName("RIVER ABV FALLS")).toEqual({ name: "River", section: "Above Falls" });
        expect(formatGaugeName("NORTHWEST BR ANACOSTIA RIVER")).toEqual({ name: "Northwest Branch Anacostia River" });
        expect(formatGaugeName("SALINE RIVER CR")).toEqual({ name: "Saline River Creek" });
    });

    it("should expand cardinal directions and forks", () => {
        expect(formatGaugeName("S FORK NEW RIVER")).toEqual({ name: "South Fork New River" });
        expect(formatGaugeName("NF DEEP RIVER")).toEqual({ name: "North Fork Deep River" });
        expect(formatGaugeName("EF POTOMAC RIVER")).toEqual({ name: "East Fork Potomac River" });
    });

    it("should handle N.F. style abbreviations gracefully", () => {
        // Current behavior will expand N to North and F to Fork and leave the dots
        expect(formatGaugeName("N.F. CLEARWATER RIVER")).toEqual({ name: "North.Fork. Clearwater River" });
        expect(formatGaugeName("S. FORK COAL RIVER AT ASHFORD, WV")).toEqual({ name: "South. Fork Coal River", section: "At Ashford, WV" });
    });

    it("should NOT expand nor anymore (should be title case)", () => {
        expect(formatGaugeName("RIVER NOR BRIDGE")).toEqual({ name: "River Nor Bridge" });
    });

    it("should not expand abbreviations when they are part of a larger word", () => {
        expect(formatGaugeName("BRADLEY CREEK NR TOWN")).toEqual({ name: "Bradley Creek", section: "Near Town" });
        expect(formatGaugeName("NC RIVER")).toEqual({ name: "NC River" }); // Should stay NC if state code
    });

    it("should keep state codes capitalized when they appear at the end", () => {
        expect(formatGaugeName("WHITE RIVER AT ANDERSON IN")).toEqual({ name: "White River", section: "At Anderson IN" });
        expect(formatGaugeName("COLUMBIA RIVER AT THE DALLES OR")).toEqual({ name: "Columbia River", section: "At the Dalles OR" });
    });

    it("should correctly handle Chattahoochee River gauge names with distances", () => {
        const result = formatGaugeName("Chattahoochee R 0.39 Mi Downstream Ga140, Alpharetta, GA");
        expect(result.name).toBe("Chattahoochee River");
        expect(result.section).toBe("0.39 mi Downstream Ga140, Alpharetta, GA");
    });

    it("should handle 'Ab' and 'Bl' shorthand expansions", () => {
        expect(formatGaugeName("TALLULAH R AB POWERHOUSE").name).toBe("Tallulah River");
        expect(formatGaugeName("TALLULAH R AB POWERHOUSE").section).toBe("Above Powerhouse");
        expect(formatGaugeName("HYCO R BL ABAY D").section).toBe("Below Abay D");
    });

    it("should handle French keywords for Canada/France", () => {
        const aval = formatGaugeName("MADAWASKA A 6 KM EN AVAL DU BARRAGE");
        expect(aval.name).toBe("Madawaska");
        expect(aval.section).toBe("A 6 km en aval du Barrage");

        const a = formatGaugeName("LA SEINE À PARIS");
        expect(a.name).toBe("La Seine");
        expect(a.section).toBe("À Paris");
    });

    it("should split at the first comma if it follows a river descriptor", () => {
        const result = formatGaugeName("SWEETWATER CREEK, BROWNSVILLE RD, GA");
        expect(result.name).toBe("Sweetwater Creek");
        expect(result.section).toBe(", Brownsville Road, GA");
    });

    it("should handle 'South F' and similar Fork abbreviations separately from directions", () => {
        const potomac = formatGaugeName("SOUTH F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(potomac.name).toBe("South Fork South Branch Potomac River");
        expect(potomac.section).toBe("Near Moorefield, WV");

        const nf = formatGaugeName("NORTH F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(nf.name).toBe("North Fork South Branch Potomac River");

        const sf_spaced = formatGaugeName("S F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(sf_spaced.name).toBe("South Fork South Branch Potomac River");

        const nf_spaced = formatGaugeName("N F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(nf_spaced.name).toBe("North Fork South Branch Potomac River");
    });
});
