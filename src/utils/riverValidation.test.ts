import { describe, it, expect } from "vitest";
import { validateRiver } from "./riverValidation";

describe("riverValidation", () => {
  it("rejects purely null or undefined river profiles", () => {
    const res = validateRiver(null);
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("River object is completely null or undefined.");
  });

  it("fails validation for missing or invalid IDs and Names", () => {
    const res = validateRiver({ id: "123", name: "   " });
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("Missing or invalid River Name.");
    
    const res2 = validateRiver({ name: "Valid" });
    expect(res2.isValid).toBe(false);
    expect(res2.errors).toContain("Missing or invalid River ID.");
  });

  it("rejects rivers containing highly-bloated raw base64 images in their writeups", () => {
    const maliciousRiver = {
      id: "malicious_1",
      name: "Malicious River",
      writeup: '<p>Look at this map!</p> <img src="data:image/jpeg;base64,/9j/4AAQSk..." alt="Map" /> <p>Beware</p>'
    };
    const res = validateRiver(maliciousRiver);
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("Raw image structures (base64) are strictly disallowed to maintain fast load times and database space.");
  });

  it("strictly requires corresponding units if any flow tiers are populated", () => {
    const res = validateRiver({
      id: "valid_1",
      name: "Valid River",
      flow: {
        min: 100,
        low: 500,
        // Missing unit
      }
    });

    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("Flow unit ('cfs', 'ft', 'cms', 'm') must be specified if any flow tier values are provided.");
  });

  it("strictly enforces flow tiers are in ascending numeric order", () => {
    const res = validateRiver({
      id: "order_test",
      name: "Order Test",
      gauges: [{ isPrimary: true }],
      flow: {
        unit: "cfs",
        min: 200,
        low: 100, // Invalid: lower than min
        mid: 300,
        high: null,
        max: 500
      }
    });

    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("Flow tiers (min, low, mid, high, max) must be in strictly ascending numeric order.");
  });

  it("rejects multiple primary gauges", () => {
      const res = validateRiver({
          id: "two_primaries",
          name: "Two Pri",
          gauges: [
              { isPrimary: true },
              { isPrimary: true }
          ]
      });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContain("At most ONE gauge can be marked as primary.");
  });

  it("passes validation cleanly and yields warnings appropriately when object is big but safely formatted", () => {
    // Generate a ~26k string
    const largeDesc = "a".repeat(26000);
    const validRiver = {
      id: "valid_2",
      name: "Valid Huge River",
      skill: "FW",
      writeup: largeDesc,
      flow: {
        unit: "cfs",
        min: 10,
        low: 20,
        max: 30
      }
    };

    const res = validateRiver(validRiver);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings[0]).toContain("This river profile is abnormally large");
  });
});
