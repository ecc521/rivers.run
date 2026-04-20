import { describe, it, expect } from 'vitest';
import { stringifyJSONObject } from '../utils/stream';

describe('stringifyJSONObject', () => {
    it('should correctly stringify a JSON object to Uint8Array', () => {
        const data = {
            "G1": { id: "G1", name: "Gauge 1" }
        };
        const extra = { generatedAt: 12345 };
        
        const buffer = stringifyJSONObject(data, extra);
        expect(buffer).toBeInstanceOf(Uint8Array);
        
        const jsonString = new TextDecoder().decode(buffer);
        const parsed = JSON.parse(jsonString);
        
        expect(parsed.generatedAt).toBe(12345);
        expect(parsed.G1.name).toBe("Gauge 1");
    });

    it('should handle large-ish datasets correctly', () => {
        const data: Record<string, any> = {};
        for (let i = 0; i < 1000; i++) {
            data[`G${i}`] = { id: `G${i}`, value: i };
        }
        
        const buffer = stringifyJSONObject(data, { count: 1000 });
        const jsonString = new TextDecoder().decode(buffer);
        const parsed = JSON.parse(jsonString);
        
        expect(parsed.count).toBe(1000);
        expect(parsed.G999.value).toBe(999);
    });
});
