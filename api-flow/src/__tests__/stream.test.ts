import { describe, it, expect } from 'vitest';
import { streamJSONObject } from '../utils/stream';

describe('streamJSONObject', () => {
    it('should correctly stream a JSON object with extra keys', async () => {
        const data = {
            "G1": { id: "G1", name: "Gauge 1" },
            "G2": { id: "G2", name: "Gauge 2" }
        };
        const extra = { generatedAt: 12345 };
        
        const stream = streamJSONObject(data, extra);
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let result = "";
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value);
        }
        
        try {
            const parsed = JSON.parse(result);
            expect(parsed.generatedAt).toBe(12345);
            expect(parsed.G1.name).toBe("Gauge 1");
            expect(parsed.G2.name).toBe("Gauge 2");
            expect(parsed.G1.id).toBe("G1");
        } catch (e) {
            console.error("Failed to parse streamed JSON:", result);
            throw e;
        }
    });

    it('should handle empty data object', async () => {
        const stream = streamJSONObject({}, { generatedAt: 999 });
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let result = "";
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value);
        }
        
        const parsed = JSON.parse(result);
        expect(parsed.generatedAt).toBe(999);
        expect(Object.keys(parsed).length).toBe(1);
    });
});
