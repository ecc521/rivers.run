import { describe, it, expect, vi } from 'vitest';
import { parseNWSeries, nwsProvider, observedReading } from '../nws';

describe('NWS Service', () => {
    describe('parseNWSeries', () => {
        it('should parse NWS JSON correctly', () => {
            const now = Date.now();
            const data = {
                primaryUnits: "ft",
                secondaryUnits: "kcfs"
            };
            const obsData = [
                {
                    validTime: new Date(now - 1000 * 60 * 10).toISOString(), // 10 mins ago
                    primary: 2.5,
                    secondary: 1.2
                },
                {
                    validTime: new Date(now - 1000 * 60 * 5).toISOString(), // 5 mins ago
                    primary: 2.6,
                    secondary: 1.3
                }
            ];

            const result = parseNWSeries(data, obsData, now - 1000 * 60 * 60, now, false); 
            const readings = Array.from(result.values());
            
            expect(readings).toHaveLength(2);
            expect(readings[0].ft).toBe(2.5);
            expect(readings[0].cfs).toBe(1200); // 1.2 kcfs -> 1200 cfs
            expect(readings[1].ft).toBe(2.6);
            expect(readings[1].cfs).toBe(1300);
        });

        it('should handle primary flow and secondary stage', () => {
            const now = Date.now();
            const data = {
                primaryUnits: "cfs",
                secondaryUnits: "ft"
            };
            const obsData = [
                {
                    validTime: new Date(now - 1000 * 60 * 10).toISOString(),
                    primary: 500,
                    secondary: 3.1
                }
            ];
            const result = parseNWSeries(data, obsData, now - 1000 * 60 * 60, now, false);
            const readings = Array.from(result.values());
            expect(readings[0].cfs).toBe(500);
            expect(readings[0].ft).toBe(3.1);
        });

        it('should filter old readings', () => {
             const now = Date.now();
             const data = {
                primaryUnits: "ft"
             };
             const obsData = [
                {
                    validTime: new Date(now - 1000 * 60 * 120).toISOString(), // 2 hours ago
                    primary: 1.0
                },
                {
                    validTime: new Date(now - 1000 * 60 * 30).toISOString(), // 30 mins ago
                    primary: 2.0
                }
            ];
            
            // 1 hour threshold -> maxTime=now, minTime=now-1h
            const result = parseNWSeries(data, obsData, now - 1000 * 60 * 60, now, false); 
            const readings = Array.from(result.values());
            expect(readings).toHaveLength(1);
            expect(readings[0].ft).toBe(2.0);
        });
        it('should handle null and empty string values correctly', () => {
            const now = Date.now();
            const data = {
                primaryUnits: "ft",
                secondaryUnits: "kcfs"
            };
            const obsData = [
                {
                    validTime: new Date(now - 1000 * 60 * 15).toISOString(),
                    primary: null,
                    secondary: 1.0
                },
                {
                    validTime: new Date(now - 1000 * 60 * 10).toISOString(),
                    primary: '',
                    secondary: 1.1
                },
                {
                    validTime: new Date(now - 1000 * 60 * 5).toISOString(),
                    primary: 10.5,
                    secondary: 1.2
                }
            ];
            const result = parseNWSeries(data, obsData, now - 1000 * 60 * 60, now, false);
            const readings = Array.from(result.values());
            expect(readings).toHaveLength(3); // Time based map creates entries
            expect(readings[0].ft).toBeUndefined();
            expect(readings[0].cfs).toBe(1000);
            expect(readings[1].ft).toBeUndefined();
            expect(readings[1].cfs).toBe(1100);
            expect(readings[2].ft).toBe(10.5);
            expect(readings[2].cfs).toBe(1200);
        });
    });

    describe('bulk gauge list', () => {
        const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
        const gauge = (lid: string, over: Record<string, unknown> = {}) => ({
            lid, name: 'Swannanoa River at Biltmore', latitude: 35.57, longitude: -82.5, state: { abbreviation: 'NC' },
            status: { observed: { primary: 2.5, primaryUnit: 'ft', secondary: 1.2, secondaryUnit: 'kcfs', validTime: hoursAgo(1) } },
            ...over,
        });
        const mockList = (...gauges: object[]) => {
            globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ gauges }) });
        };

        it('reads stage and flow from the latest observation, ignoring sentinels', () => {
            expect(observedReading(gauge('A'))).toMatchObject({ ft: 2.5, cfs: 1200 });
            const noFlow = gauge('B', { status: { observed: { primary: 2.5, primaryUnit: 'ft', secondary: -999, secondaryUnit: 'kcfs', validTime: hoursAgo(1) } } });
            const reading = observedReading(noFlow);
            expect(reading?.ft).toBe(2.5);
            expect(reading?.cfs).toBeUndefined();
            expect(observedReading(gauge('C', { status: { observed: { validTime: '0001-01-01T00:00:00Z' } } }))).toBeNull();
            expect(observedReading({})).toBeNull();
        });

        it('lists the NC river gauges observed recently, using a bounding box', async () => {
            mockList(
                gauge('SWNN7'),
                gauge('OLDN7', { status: { observed: { primary: 1, primaryUnit: 'ft', validTime: hoursAgo(24 * 5) } } }),
                gauge('NEVN7', { status: { observed: { validTime: '0001-01-01T00:00:00Z' } } }),
                gauge('GAGA1', { state: { abbreviation: 'GA' } }),
                gauge('TIDN7', { name: 'Pamlico Sound at Avon (in MLLW)' }),
                gauge('DAMN7', { status: { observed: { primary: 1920.4, primaryUnit: 'ft', validTime: hoursAgo(1) } } }),
            );
            const result = await nwsProvider.getFullSiteListing!();
            expect(result.map(s => s.id)).toEqual(['SWNN7']);
            expect(result[0]).toMatchObject({ name: 'Swannanoa River', section: 'At Biltmore', state: 'NC', country: 'US', lat: 35.57, lon: -82.5 });
            const url = String((globalThis.fetch as any).mock.calls[0][0]);
            expect(url).toContain('bbox.xmin=');
            expect(url).not.toMatch(/gauges$/);
        });

        it('getLatest answers from one bulk request, case-insensitively, without per-gauge calls', async () => {
            mockList(gauge('SWNN7'), gauge('OTHER'));
            const latest = await nwsProvider.getLatest(['swnn7', 'MISSING']);
            expect(Object.keys(latest)).toEqual(['swnn7']);
            expect(latest.swnn7).toMatchObject({ ft: 2.5, cfs: 1200 });
            expect(globalThis.fetch).toHaveBeenCalledOnce();
        });
    });
});
