import { processUSGSResponse } from "./usgs";
import mockUsgsResponse from "./usgs_mock.json";

describe("processUSGSResponse", () => {
    it("should process JSON output to legacy Rivers format correctly", () => {
        const result = processUSGSResponse(mockUsgsResponse);
        
        expect(result).toBeDefined();
        
        // Assert the site is parsed into the return object keyed by siteCode
        expect(result["03504000"]).toBeDefined();
        
        const site = result["03504000"];
        expect(site.name).toBe("LOWER GREEN RIVER AT TUXEDO NC");
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
