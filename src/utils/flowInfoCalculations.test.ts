import { describe, it, expect } from "vitest";
import { calculateRelativeFlow, calculateColor, calculateTrend, calculateParsedThresholds } from "./flowInfoCalculations";
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

    it("correctly handles null thresholds by treating them as missing, avoiding coercion to 0", () => {
        // CASE: Little Sandy Bug Regression
        // Missing thresholds (null) should NOT be coerced to 0. 
        // If flow is 0 and max is null, it should NOT return 4.
        const river = {
            cfs: 0,
            flow: { unit: "cfs", min: 100, low: null, mid: null, high: null, max: null }
        } as unknown as RiverData;

        const ratio = calculateRelativeFlow(river);
        // Previously this returned 4 because max was coerced to 0 and 0 >= 0 was true.
        // Now it should return 0 (below minrun) or null if minrun was also null.
        expect(ratio).toBe(0); 

        const riverAllNull = {
            cfs: 0,
            flow: { unit: "cfs", min: null, low: null, mid: null, high: null, max: null }
        } as unknown as RiverData;
        expect(calculateRelativeFlow(riverAllNull)).toBeNull();
    });

    it("interpolates stage-height (ft) linearly, so a 0/negative threshold no longer yields NaN", () => {
        // Stage height is read against an arbitrary gauge datum, so this river's
        // min of -2 ft is legitimate; log-interpolating it used to give NaN.
        const thresholds = { min: -2, low: 0, mid: 3, high: 8, max: null };
        const at = (ft: number) =>
          calculateRelativeFlow({ ft, flow: { unit: "ft", ...thresholds } } as unknown as RiverData);

        expect(at(2.57)).toBeCloseTo(1 + 2.57 / 3, 6); // 1.856667
        expect(at(0)).toBe(1); // exactly at low
        expect(at(3)).toBe(2); // exactly at mid
        expect(at(-1)).toBe(0.5); // (-1 - -2) / (0 - -2), first segment
    });

    it("keeps log-scale interpolation for cfs, unaffected by the stage-height change", () => {
        const river = {
          cfs: 250,
          flow: { unit: "cfs", min: 100, low: 200, mid: 500, high: 1000, max: 2000 }
        } as unknown as RiverData;
        expect(calculateRelativeFlow(river)).toBeCloseTo(1.2435, 3);
    });

    it("ignores non-positive cfs thresholds rather than log-scaling them", () => {
        // A river can't run at 0 cfs, so those thresholds are dropped and
        // refilled by interpolation (min 25, low 50) instead of reaching log(0).
        const river = {
          cfs: 50,
          flow: { unit: "cfs", min: -10, low: 0, mid: 100, high: 200, max: 400 }
        } as unknown as RiverData;
        expect(calculateRelativeFlow(river)).toBe(1); // exactly at the refilled low
    });

    it("scores a stage-height river with a non-positive threshold and a missing one", () => {
        // The missing mid used to interpolate to NaN via Math.log10(0), which
        // made this river's whole score NaN.
        const river = {
          ft: 5,
          flow: { unit: "ft", min: -2, low: 0, mid: null, high: 8, max: null }
        } as unknown as RiverData;
        expect(calculateRelativeFlow(river)).toBe(2.25); // mid fills in at 4
    });
  });

  describe("calculateParsedThresholds", () => {
    it("drops duplicate and out-of-order thresholds, then refills the gap", () => {
        // Duplicates would give calculateRatio a zero span to divide by. The
        // dropped slot is re-interpolated, so no gap is left behind.
        const geometricMid = Math.sqrt(200 * 400); // 282.84
        for (const raw of [[100, 200, 200, 400, 800], [100, 200, 50, 400, 800]]) {
          const parsed = calculateParsedThresholds(raw, "cfs");
          expect(parsed[2]).toBeCloseTo(geometricMid, 6);
          expect([parsed[0], parsed[1], parsed[3], parsed[4]]).toEqual([100, 200, 400, 800]);
        }
    });

    it("keeps negative stage-height thresholds and spaces the gaps linearly", () => {
        expect(calculateParsedThresholds([-2, 0, null, 8, null], "ft")).toEqual([-2, 0, 4, 8, 12]);
    });

    it("drops non-positive thresholds for volume units only", () => {
        expect(calculateParsedThresholds([0, 100, 200, 400, 800], "cfs")[0]).toBeLessThan(100);
        expect(calculateParsedThresholds([0, 100, 200, 400, 800], "cfs")[0]).toBeGreaterThan(0);
        expect(calculateParsedThresholds([0, 1, 2, 4, 8], "m")[0]).toBe(0);
    });

    it("always returns strictly increasing, finite values", () => {
        // calculateRatio relies on this: a zero span there is unreachable.
        const candidates = [-5, -1, 0, 0.5, 3, 100, null, ""];
        let configs: any[][] = [[]];
        for (let slot = 0; slot < 5; slot++) {
          configs = configs.flatMap(config => candidates.map(v => [...config, v]));
        }

        for (const unit of ["cfs", "cms", "ft", "m"]) {
          const isVolume = !["ft", "m"].includes(unit);
          for (const config of configs) {
            const defined = calculateParsedThresholds(config, unit)
              .filter((v): v is number => v !== undefined);
            const increasing = defined.every((v, i) => i === 0 || v > defined[i - 1]);
            const valid = defined.every(v => Number.isFinite(v) && (!isVolume || v > 0));
            expect({ config, unit, increasing, valid })
              .toEqual({ config, unit, increasing: true, valid: true });
          }
        }
    });
  });

  describe("calculateColor", () => {
    it("returns string color for min value", () => {
      expect(calculateColor(0, false)).toBe("hsl(0,100%,74%)"); // Redish
    });

    it("returns string color for mid value", () => {
      expect(calculateColor(2, false)).toBe("hsl(120,100%,70%)"); // Green
    });

    it("returns blue-ish string color for max value", () => {
      expect(calculateColor(4, false)).toBe("hsl(240,100%,80%)");
    });
    
    it("handles colorblind light-mode interpolation correctly", () => {
       // Should safely blend orange and blue.
       // For running = 0, should be purely orange ([255, 189, 122])
       expect(calculateColor(0, false, true)).toBe("rgb(255,189,122)");
       
       // For running = 4, should be purely blue ([153, 153, 255])
       expect(calculateColor(4, false, true)).toBe("rgb(153,153,255)");
    });
    
    it("handles dark mode lightness inversion", () => {
       expect(calculateColor(2, true)).toBe("hsl(120,100%,22%)"); // Deep green for dark mode instead of light green
    });

    it("returns empty string on null", () => {
      expect(calculateColor(null)).toBe("");
    });
  });

  describe("calculateTrend", () => {
    it("returns 'flat' if less than 2 readings", () => {
      expect(calculateTrend(undefined)).toBe("flat");
      expect(calculateTrend([])).toBe("flat");
      expect(calculateTrend([{ dateTime: 1000, cfs: 100 }])).toBe("flat");
    });

    it("calculates flow trends correctly using cfs", () => {
      const now = Date.now();
      // Up trend: 100 cfs to 120 cfs (20% increase, +20 cfs) over 2 hours
      const upReadings = [
        { dateTime: now - 2 * 60 * 60 * 1000, cfs: 100 },
        { dateTime: now, cfs: 120 }
      ];
      expect(calculateTrend(upReadings)).toBe("up");

      // Flat trend (insufficient increase percentage): 1000 cfs to 1010 cfs (+1% increase)
      const flatUpReadings = [
        { dateTime: now - 2 * 60 * 60 * 1000, cfs: 1000 },
        { dateTime: now, cfs: 1010 }
      ];
      expect(calculateTrend(flatUpReadings)).toBe("flat");

      // Flat trend (insufficient absolute increase): 10 cfs to 15 cfs (+50% increase, but only +5 cfs)
      const flatUpLowFlow = [
        { dateTime: now - 2 * 60 * 60 * 1000, cfs: 10 },
        { dateTime: now, cfs: 15 }
      ];
      expect(calculateTrend(flatUpLowFlow)).toBe("flat");

      // Down trend: 200 cfs to 180 cfs (10% decrease, -20 cfs) over 2 hours
      const downReadings = [
        { dateTime: now - 2 * 60 * 60 * 1000, cfs: 200 },
        { dateTime: now, cfs: 180 }
      ];
      expect(calculateTrend(downReadings)).toBe("down");
    });

    it("calculates stage trends correctly using ft", () => {
      const now = Date.now();
      // Up trend: 2.0 ft to 2.05 ft (+0.05 ft) over 2 hours
      const upReadings = [
        { dateTime: now - 2 * 60 * 60 * 1000, ft: 2.0 },
        { dateTime: now, ft: 2.05 }
      ];
      expect(calculateTrend(upReadings)).toBe("up");

      // Flat trend: 2.0 ft to 2.02 ft (+0.02 ft)
      const flatReadings = [
        { dateTime: now - 2 * 60 * 60 * 1000, ft: 2.0 },
        { dateTime: now, ft: 2.02 }
      ];
      expect(calculateTrend(flatReadings)).toBe("flat");

      // Down trend: 3.5 ft to 3.4 ft (-0.1 ft)
      const downReadings = [
        { dateTime: now - 2 * 60 * 60 * 1000, ft: 3.5 },
        { dateTime: now, ft: 3.4 }
      ];
      expect(calculateTrend(downReadings)).toBe("down");
    });

    it("filters out forecast readings when calculating trend", () => {
      const now = Date.now();
      // Two actual readings showing flat trend, plus future forecast showing huge rise.
      // Should ignore forecast and return flat.
      const readings = [
        { dateTime: now - 2 * 60 * 60 * 1000, cfs: 100 },
        { dateTime: now, cfs: 100 },
        { dateTime: now + 2 * 60 * 60 * 1000, cfs: 500, isForecast: true }
      ];
      expect(calculateTrend(readings)).toBe("flat");
    });

    it("uses oldest reading if no reading falls exactly in the 1.5 - 2.5 hour window", () => {
      const now = Date.now();
      // Readings at 1 hour ago and now. Oldest is 1 hour ago.
      // Time difference is 1 hour (>= 45 mins), so it should evaluate trend against it.
      // 100 to 110 cfs (10% increase, +10 cfs) -> Flat (since cfs change is < 15)
      // 100 to 120 cfs (20% increase, +20 cfs) -> Up
      const readings = [
        { dateTime: now - 1 * 60 * 60 * 1000, cfs: 100 },
        { dateTime: now, cfs: 120 }
      ];
      expect(calculateTrend(readings)).toBe("up");
    });
  });
});
