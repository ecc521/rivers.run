import { describe, it, expect } from 'vitest';
import { forEachLimited } from '../concurrency';

describe('forEachLimited', () => {
    it('visits every item and never exceeds the limit', async () => {
        let inFlight = 0;
        let peak = 0;
        const seen: number[] = [];
        await forEachLimited(Array.from({ length: 12 }, (_, i) => i), 3, async item => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise(r => setTimeout(r, 2));
            seen.push(item);
            inFlight--;
        });
        expect(seen.toSorted((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
        expect(peak).toBe(3);
    });

    it('handles an empty list and a limit above the item count', async () => {
        await expect(forEachLimited([], 5, async () => {})).resolves.toBeUndefined();
        const seen: string[] = [];
        await forEachLimited(['a', 'b'], 10, async item => { seen.push(item); });
        expect(seen).toEqual(['a', 'b']);
    });
});
