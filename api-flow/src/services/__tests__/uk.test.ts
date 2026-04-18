import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ukProvider } from '../uk';

describe('UK EA Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ukProvider.getHistory', () => {
        it('should format historical JSON readings correctly', async () => {
            const now = Date.now();
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        { dateTime: new Date(now - 30 * 60000).toISOString(), value: 1.5, measure: "https://environment.data.gov.uk/flood-monitoring/id/measures/1234-level-m-latest" },
                        { dateTime: new Date(now - 15 * 60000).toISOString(), value: 25.5, measure: "https://environment.data.gov.uk/flood-monitoring/id/measures/1234-flow-m3/s-latest" }
                    ]
                })
            });

            const result = await ukProvider.getHistory(['1234'], now - 1000 * 60 * 60, now);

            expect(result['1234']).toBeDefined();
            expect(result['1234'].readings).toHaveLength(2);
            expect(result['1234'].readings[0].m).toBe(1.5);
            expect(result['1234'].readings[1].cms).toBe(25.5);
            expect(globalThis.fetch).toHaveBeenCalledOnce();
        });

        it('should handle API outages gracefully', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

            const now = Date.now();
            const result = await ukProvider.getHistory(['1234'], now - 1000 * 60 * 60, now);
            expect(result['1234']).toBeUndefined();
        });
    });

    describe('ukProvider.getFullSiteListing', () => {
        it('should format station names correctly from label', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            notation: '4321',
                            label: 'BATH LARKHALL ST SAVIOURS RD',
                            lat: 51.39,
                            long: -2.35
                        },
                        {
                            notation: '5678',
                            label: 'BEACHES MILL SECONDARY GS GSM',
                            lat: 51.40,
                            long: -2.36
                        }
                    ]
                })
            });

            const result = await ukProvider.getFullSiteListing!();
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Bath Larkhall St Saviours Road');
            expect(result[1].name).toBe('Beaches Mill Secondary Gauging Station GSM');
        });

        it('should prioritize Active status when multiple coordinates are present', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            notation: 'E85123',
                            label: ['Ilfracombe Lambda Upstream', 'Ilfracombe Lambda'],
                            lat: [51.196412, 51.19557], // Suspended first
                            long: [-4.120133, -4.119951],
                            status: [
                                'https://environment.data.gov.uk/flood-monitoring/def/core/statusSuspended',
                                'https://environment.data.gov.uk/flood-monitoring/def/core/statusActive'
                            ]
                        }
                    ]
                })
            });

            const result = await ukProvider.getFullSiteListing!();
            expect(result).toHaveLength(1);
            expect(result[0].lat).toBe(51.19557);
            expect(result[0].lon).toBe(-4.119951);
            expect(result[0].name).toBe('Ilfracombe Lambda');
        });
    });
});
