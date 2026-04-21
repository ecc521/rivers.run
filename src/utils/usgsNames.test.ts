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
        expect(formatGaugeName("USGS GS ON THE RIVER")).toEqual({ name: "USGS GS on the River" });
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
        expect(formatGaugeName("S FORK NEW RIVER")).toEqual({ name: "S Fork New River" });
        expect(formatGaugeName("NF DEEP RIVER")).toEqual({ name: "N Fork Deep River" });
        expect(formatGaugeName("EF POTOMAC RIVER")).toEqual({ name: "E Fork Potomac River" });
    });

    it("should handle N.F. style abbreviations by expanding waterbody but not direction", () => {
        expect(formatGaugeName("N.F. CLEARWATER RIVER")).toEqual({ name: "N Fork Clearwater River" });
        expect(formatGaugeName("S. FORK COAL RIVER AT ASHFORD, WV")).toEqual({ name: "S Fork Coal River", section: "At Ashford, WV" });
        expect(formatGaugeName("N. F. CLEARWATER")).toEqual({ name: "N Fork Clearwater" });
        expect(formatGaugeName("ST. CROIX RIVER")).toEqual({ name: "St. Croix River" });
        expect(formatGaugeName("RD. 100")).toEqual({ name: "Rd. 100" });
        expect(formatGaugeName("ST. JOHNS RIVER")).toEqual({ name: "St. Johns River" });
    });

    it("should protect the U.S. acronym and handle US without dots", () => {
        expect(formatGaugeName("U.S. GAUGE")).toEqual({ name: "U.S. Gauge" });
        expect(formatGaugeName("US GAUGE")).toEqual({ name: "US Gauge" });
        expect(formatGaugeName("USGS GAUGE")).toEqual({ name: "USGS Gauge" });
        expect(formatGaugeName("AT U.S. HWY 1")).toEqual({ name: "At U.S. HWY 1" });
    });

    it("should not swallow dots in decimal numbers", () => {
        expect(formatGaugeName("RIVER 1.5 MI ABOVE DAM")).toEqual({ name: "River 1.5 mi", section: "Above Dam" });
        expect(formatGaugeName("RIVER AT 0.5 MI")).toEqual({ name: "River", section: "At 0.5 MI" });
    });

    it("should handle multiple single-letter expansions correctly", () => {
        expect(formatGaugeName("N.F.N.F. POTOMAC")).toEqual({ name: "N Fork N Fork Potomac" });
        expect(formatGaugeName("S.F. POTOMAC")).toEqual({ name: "S Fork Potomac" });
        expect(formatGaugeName("W.F. POTOMAC")).toEqual({ name: "W Fork Potomac" });
        expect(formatGaugeName("E.F. POTOMAC")).toEqual({ name: "E Fork Potomac" });
        expect(formatGaugeName("YADKIN R BL W KERR SCOTT DAM")).toEqual({ name: "Yadkin River", section: "Below W Kerr Scott Dam" });
    });

    it("should handle Mouth, Below, and Downstream expansions", () => {
        expect(formatGaugeName("ROCKY R B MTH OF S PRONG")).toEqual({ name: "Rocky River", section: "Below Mouth of S Prong" });
        expect(formatGaugeName("RIVER DS DAM")).toEqual({ name: "River", section: "Downstream Dam" });
    });

    it("should handle contextual US (Upstream) vs US (Acronym)", () => {
        expect(formatGaugeName("RIVER 0.5 MI US OF DAM")).toEqual({ name: "River", section: "0.5 mi Upstream of Dam" });
        expect(formatGaugeName("AT US HWY 1")).toEqual({ name: "At US HWY 1" });
        expect(formatGaugeName("US GAUGE")).toEqual({ name: "US Gauge" });
    });

    it("should handle slashed abbreviations U/S and D/S", () => {
        expect(formatGaugeName("RIVER U/S DAM")).toEqual({ name: "River", section: "Upstream Dam" });
        expect(formatGaugeName("RIVER D/S DAM")).toEqual({ name: "River", section: "Downstream Dam" });
    });

    it("should handle road types as title-case (not expanded) per user preference", () => {
        expect(formatGaugeName("RD 100")).toEqual({ name: "Rd 100" });
        expect(formatGaugeName("ST. JOHNS RIVER")).toEqual({ name: "St. Johns River" });
        expect(formatGaugeName("HWY 64")).toEqual({ name: "HWY 64" });
        expect(formatGaugeName("NC SR 1001")).toEqual({ name: "NC SR 1001" });
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
        expect(result.section).toBe(", Brownsville Rd, GA");
    });

    it("should handle 'South F' and similar Fork abbreviations separately from directions", () => {
        const potomac = formatGaugeName("SOUTH F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(potomac.name).toBe("South Fork South Branch Potomac River");
        expect(potomac.section).toBe("Near Moorefield, WV");

        const nf = formatGaugeName("NORTH F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(nf.name).toBe("North Fork South Branch Potomac River");

        const sf_spaced = formatGaugeName("S F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(sf_spaced.name).toBe("S Fork South Branch Potomac River");

        const nf_spaced = formatGaugeName("N F SOUTH BRANCH POTOMAC RIVER NEAR MOOREFIELD, WV");
        expect(nf_spaced.name).toBe("N Fork South Branch Potomac River");
    });
});
