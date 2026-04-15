import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ukProvider } from '../uk';

describe('UK EA Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ukProvider.getHistory', () => {
        it('should format historical JSON readings correctly', async () => {
            const now = Date.now();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        { dateTime: new Date(now - 30 * 60000).toISOString(), value: 1.5, measure: "http://environment.data.gov.uk/flood-monitoring/id/measures/1234-level-m-latest" },
                        { dateTime: new Date(now - 15 * 60000).toISOString(), value: 25.5, measure: "http://environment.data.gov.uk/flood-monitoring/id/measures/1234-flow-m3/s-latest" }
                    ]
                })
            });

            const result = await ukProvider.getHistory(['1234'], now - 1000 * 60 * 60, now);

            expect(result['1234']).toBeDefined();
            expect(result['1234'].readings).toHaveLength(2);
            expect(result['1234'].readings[0].m).toBe(1.5);
            expect(result['1234'].readings[1].cms).toBe(25.5);
            expect(global.fetch).toHaveBeenCalledOnce();
        });

        it('should handle API outages gracefully', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

            const now = Date.now();
            const result = await ukProvider.getHistory(['1234'], now - 1000 * 60 * 60, now);
            expect(result['1234']).toBeUndefined();
        });
    });
});
