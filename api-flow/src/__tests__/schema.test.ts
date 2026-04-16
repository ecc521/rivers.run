import { describe, it, expect } from 'vitest';
import { ReadingSchema } from '../schema';
import { toUnitSystem } from '../utils/units';

describe('Schema Validation Audit', () => {
    const mockReading = {
        dateTime: Date.now(),
        cfs: 100,
        ft: 2.1,
        cms: 2.83,
        m: 0.64,
        temp_f: 50,
        temp_c: 10,
        precip_in: 0.1,
        precip_mm: 2.54,
        // Legacy fields that should be stripped
        temp: 50,
        precip: 0.1,
        other: 'garbage'
    };

    it('toUnitSystem should strictly return only schema-compliant fields', () => {
        const result = toUnitSystem(mockReading as any, 'imperial', 'imperial');
        
        // Assert schema compliance
        const parsed = ReadingSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        
        // Assert no legacy leaks
        const keys = Object.keys(result);
        const allowedKeys = ['dateTime', 'cfs', 'ft', 'temp_f', 'precip_in', 'isForecast'];
        keys.forEach(k => {
            expect(allowedKeys).toContain(k);
        });
        expect(keys).not.toContain('temp');
        expect(keys).not.toContain('precip');
        expect(keys).not.toContain('other');
    });

    it('toUnitSystem should handle metric properly', () => {
        const result = toUnitSystem(mockReading as any, 'metric', 'metric');
        const parsed = ReadingSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        
        const keys = Object.keys(result);
        const allowedKeys = ['dateTime', 'cms', 'm', 'temp_c', 'precip_mm', 'isForecast'];
        keys.forEach(k => {
            expect(allowedKeys).toContain(k);
        });
    });

    it('should validate ReadingSchema allows optional fields', () => {
        const minimal = { dateTime: 123456789 };
        expect(ReadingSchema.safeParse(minimal).success).toBe(true);
    });

    it('should reject non-numeric values for unit fields', () => {
        const bad = { dateTime: 123456, cfs: 'one hundred' };
        expect(ReadingSchema.safeParse(bad).success).toBe(false);
    });
});
