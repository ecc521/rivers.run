import { processUSGSResponse, formatGaugeName } from "./usgs";
import mockUsgsResponse from "./usgs_mock.json";

describe("processUSGSResponse", () => {
    it("should process JSON output to legacy Rivers format correctly", () => {
        const result = processUSGSResponse(mockUsgsResponse);
        
        expect(result).toBeDefined();
        
        // Assert the site is parsed into the return object keyed by siteCode
        expect(result["03504000"]).toBeDefined();
        
        const site = result["03504000"];
        expect(site.name).toBe("Lower Green River");
        expect(site.section).toBe("At Tuxedo NC");
        expect(site.readings.length).toBeGreaterThan(0);
        
        // Let's assert the first reading where both discharge and temp are present or just discharge
        const firstReadingDate = new Date("2026-04-10T12:00:00.000-04:00").getTime();
        const firstReading = site.readings.find((r: any) => r.dateTime === firstReadingDate);
        
        expect(firstReading).toBeDefined();
        // Should map "ft3/s" to "cfs"
        expect(firstReading.cfs).toBe(135);
        
        // Should map "deg C" to "temp" in Fahrenheit: (16.1 * 1.8) + 32 = 60.98
        expect(firstReading.temp).toBeCloseTo(60.98);
        
        // Second reading where temp has noDataValue - it should NOT be included
        const secondReadingDate = new Date("2026-04-10T12:15:00.000-04:00").getTime();
        const secondReading = site.readings.find((r: any) => r.dateTime === secondReadingDate);
        
        expect(secondReading).toBeDefined();
        expect(secondReading.cfs).toBe(136);
        expect(secondReading.temp).toBeUndefined(); // Missing because it was discarded noDataValue
    });
});

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

    it("should keep state codes capitalized when they appear at the end", () => {
        expect(formatGaugeName("WHITE RIVER AT ANDERSON IN")).toEqual({ name: "White River", section: "At Anderson IN" });
        expect(formatGaugeName("COLUMBIA RIVER AT THE DALLES OR")).toEqual({ name: "Columbia River", section: "At The Dalles OR" });
    });
});
