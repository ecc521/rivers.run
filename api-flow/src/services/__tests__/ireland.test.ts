import { describe, it, expect, vi, beforeEach } from 'vitest';
import { irelandProvider } from '../ireland';

describe('Ireland OPW Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('irelandProvider.getHistory', () => {
        it('should format readings from CSV correctly', async () => {
            const time1 = new Date(Date.now() - 1000 * 60 * 30).toISOString();
            const time2 = new Date(Date.now() - 1000 * 60 * 15).toISOString();
            
            const mockCsv = `datetime,value
${time1},1.234
${time2},1.250`;

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(mockCsv)
            });

            const now = Date.now();
            const result = await irelandProvider.getHistory(['00001'], now - 1000 * 60 * 60 * 24, now);
            
            expect(result['00001']).toBeDefined();
            expect(result['00001'].readings).toHaveLength(2);
            expect(result['00001'].readings[0].m).toBe(1.234);
            expect(result['00001'].readings[1].m).toBe(1.250);
            expect(global.fetch).toHaveBeenCalledOnce();
        });

        it('should handle malformed or missing csv gracefully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false
            });

            const now = Date.now();
            const result = await irelandProvider.getHistory(['00001'], now - 1000 * 60 * 60, now);
            expect(result['00001']).toBeUndefined();
        });
    });
});
