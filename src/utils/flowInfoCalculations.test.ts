import { describe, it, expect } from "vitest";
import { calculateRelativeFlow, calculateColor } from "./flowInfoCalculations";
import type { RiverData } from "../types/River";

describe("flowInfoCalculations", () => {
  describe("calculateRelativeFlow", () => {
    it("returns null if flow or unit is missing", () => {
      const river = { cfs: 100 } as RiverData;
      expect(calculateRelativeFlow(river)).toBeNull();
    });

    it("returns 0 if flow is below minrun", () => {
      const river = {
        cfs: 50,
        flow: { unit: "cfs", min: 100, low: 200, mid: 300, high: 400, max: 500 }
      } as RiverData;
      expect(calculateRelativeFlow(river)).toBe(0);
    });

    it("returns 4 if flow is above maxrun", () => {
      const river = {
        cfs: 600,
        flow: { unit: "cfs", min: 100, low: 200, mid: 300, high: 400, max: 500 }
      } as unknown as RiverData;
      expect(calculateRelativeFlow(river)).toBe(4);
    });

    it("calculates relative ratio accurately between low and mid", () => {
      const river = {
        cfs: 250,
        flow: { unit: "cfs", min: 100, low: 200, mid: 500, high: 1000, max: 2000 }
      } as unknown as RiverData;
      
      const flowRatio = calculateRelativeFlow(river);
      // between low and mid starts at 1, goes up logarithmically.
      // Math.log(250) - Math.log(200) / (Math.log(500) - Math.log(200)) = ~0.243
      expect(flowRatio).toBeGreaterThan(1);
      expect(flowRatio).toBeLessThan(2);
      expect(flowRatio).toBeCloseTo(1.2435, 3);
    });

    it("infers logarithmic gaps effectively with descending metrics missing", () => {
       const river = {
          cfs: 1500,
          flow: { unit: "cfs", min: 500, low: null, mid: null, high: null, max: 3000 }
       } as unknown as RiverData;
       const ratio = calculateRelativeFlow(river)!;
       expect(ratio).toBeGreaterThan(0);
       expect(ratio).toBeLessThan(4);
    });
    
    it("uses latestReading instead of cfs/ft/cms if provided", () => {
        const river = {
          latestReading: 350,
          cfs: 100, // old value
          flow: { unit: "cfs", min: 100, low: 200, mid: 300, high: 400, max: 500 }
        } as unknown as RiverData;
        
        const ratio = calculateRelativeFlow(river);
        // 350 is between mid(300) and high(400), so 2 + ratio
        expect(ratio).toBeGreaterThan(2);
        expect(ratio).toBeLessThan(3);
    });
  });

  describe("calculateColor", () => {
    it("returns string color for min value natively", () => {
      expect(calculateColor(0, false)).toBe("hsl(0,100%,74%)"); // Redish
    });

    it("returns string color for mid value natively", () => {
      expect(calculateColor(2, false)).toBe("hsl(120,100%,70%)"); // Green
    });

    it("returns blue-ish string color for max value natively", () => {
      expect(calculateColor(4, false)).toBe("hsl(240,100%,80%)");
    });
    
    it("handles colorblind light-mode interpolation correctly", () => {
       // Should safely blend orange and blue.
       // For running = 0, should be purely orange ([255, 189, 122])
       expect(calculateColor(0, false, true)).toBe("rgb(255,189,122)");
       
       // For running = 4, should be purely blue ([153, 153, 255])
       expect(calculateColor(4, false, true)).toBe("rgb(153,153,255)");
    });
    
    it("handles dark mode lightness inversion natively", () => {
       expect(calculateColor(2, true)).toBe("hsl(120,100%,22%)"); // Deep green for dark mode instead of light green
    });

    it("returns empty string on null", () => {
      expect(calculateColor(null)).toBe("");
    });
  });
});
