import { describe, it, expect, vi, beforeEach } from 'vitest';
import { irelandProvider } from '../ireland';

describe('Ireland OPW Service - Normalization & Mapping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('irelandProvider.getFullSiteListing', () => {
        it('should correctly normalize station IDs and map regions', async () => {
            const mockGeoJson = {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            station_ref: "0000001041",
                            station_name: "Sandy Mills",
                            region_id: 3,
                            value: "0.377"
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [-7.575758, 54.838318]
                        }
                    },
                    {
                        type: "Feature",
                        properties: {
                            station_ref: "0000003055",
                            station_name: "Glaslough",
                            region_id: 10,
                            value: "0.491"
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [-6.894344, 54.323281]
                        }
                    }
                ]
            };

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockGeoJson)
            });

            const result = await irelandProvider.getFullSiteListing!();
            
            expect(result).toHaveLength(2);
            
            // Station 1: Sandy Mills
            expect(result[0].id).toBe("01041");
            expect(result[0].state).toBe("DL"); // Donegal -> DL
            
            // Station 2: Glaslough
            expect(result[1].id).toBe("03055");
            expect(result[1].state).toBeUndefined(); // "North East" not in county map
        });
    });

    describe('irelandProvider.getLatest', () => {
         it('should match normalized IDs from GeoJSON', async () => {
            const mockGeoJson = {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            station_ref: "0000001041",
                            datetime: "2026-04-20T23:30:00Z",
                            value: "0.377"
                        }
                    }
                ]
            };

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockGeoJson)
            });

            const result = await irelandProvider.getLatest(['01041']);
            
            expect(result['01041']).toBeDefined();
            expect(result['01041'].m).toBe(0.377);
         });
    });
});
