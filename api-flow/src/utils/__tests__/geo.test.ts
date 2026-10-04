import { describe, it, expect } from 'vitest';
import { distanceM, buildProximityIndex } from '../geo';

describe('geo', () => {
    it('measures meters between points', () => {
        expect(distanceM({ lat: 35, lon: -82 }, { lat: 35.001, lon: -82 })).toBeCloseTo(111.2, 0);
        expect(distanceM({ lat: 35, lon: -82 }, { lat: 35, lon: -82 })).toBe(0);
    });

    it('finds points across grid cell borders and respects the radius', () => {
        const near = buildProximityIndex([{ lat: 35.0099, lon: -82.0001 }]);
        expect(near({ lat: 35.0101, lon: -82.0001 }, 300)).toBe(true);
        expect(near({ lat: 35.0301, lon: -82.0001 }, 300)).toBe(false);
        expect(buildProximityIndex([])({ lat: 35, lon: -82 }, 300)).toBe(false);
    });
});
