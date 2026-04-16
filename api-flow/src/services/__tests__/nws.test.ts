import { describe, it, expect, vi } from 'vitest';
import { parseNWSeries, nwsProvider } from '../nws';

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

    describe('nwsProvider.getFullSiteListing', () => {
        it('should fetch and format NWS gauge list', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    gauges: [
                        {
                            identifier: 'clvv2',
                            name: 'CLEAR LAKE AT LAKEPORT',
                            latitude: 39.04,
                            longitude: -122.91
                        },
                        {
                            identifier: 'sumw2',
                            name: 'Snoqualmie River at Snoqualmie',
                            latitude: 47.53,
                            longitude: -121.82
                        }
                    ]
                })
            });

            const result = await nwsProvider.getFullSiteListing?.();
            expect(result).toHaveLength(2);
            expect(result![0].name).toBe('Clear Lake At Lakeport');
            expect(result![1].name).toBe('Snoqualmie River At Snoqualmie');
        });
    });
});
