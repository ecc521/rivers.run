import { loadCanadianProvince } from "./canada";
import * as fs from "fs";
import * as path from "path";

describe("loadCanadianProvince", () => {
    let originalFetch: typeof global.fetch;

    beforeAll(() => {
        originalFetch = global.fetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it("parses Canadian CSV gauge data seamlessly and matches thresholds securely", async () => {
        // Construct an explicit time in the last 6 hours so it isn't deleted by cutoff time parsing logic!
        const currentTime = Date.now();
        const testCsvPath = path.join(__dirname, "canada_mock_temp.csv");
        
        // Form legitimate string CSV explicitly with recent datestamps
        const csvContent = ` ID,Date,Water Level / Niveau d'eau (m),Discharge / Débit (cms)
05CD005,${new Date(currentTime - 1000 * 60 * 30).toISOString()},2.5,150.0
05CD005,${new Date(currentTime - 1000 * 60 * 15).toISOString()},2.6,155.0
08MF005,${new Date(currentTime - 1000 * 60 * 20).toISOString()},1.2,45.0`;

        fs.writeFileSync(testCsvPath, csvContent);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: fs.createReadStream(testCsvPath)
        });

        // Trigger explicitly utilizing any province target string
        const result = await loadCanadianProvince("ON");
        
        expect(result).toBeDefined();
        
        // Ensure both distinct gauges were parsed from the unified provincial CSV table
        expect(result["05CD005"]).toBeDefined();
        expect(result["08MF005"]).toBeDefined();
        
        const gauge1 = result["05CD005"];
        expect(gauge1.readings.length).toBe(2);

        const gauge2 = result["08MF005"];
        expect(gauge2.readings.length).toBe(1);

        // Assert scaling math applied seamlessly
        const firstReading = gauge1.readings[0];
        
        expect(firstReading.m).toBe(2.5);
        expect(firstReading.cms).toBe(150.0);
        
        // Clean up mock
        fs.unlinkSync(testCsvPath);
    });

    it("gracefully falls back when a 404 missing resource occurs for seasonal gauges", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404
        });

        const result = await loadCanadianProvince("AB");
        expect(result).toEqual({});
    });
});
