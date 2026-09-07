import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usaceProvider, pickBestSeries, intervalToMinutes, resolveProjectElevation } from '../usace';

function jsonResponse(body: any) {
    return { ok: true, json: () => Promise.resolve(body) };
}

function elevationEntry(name: string, interval: string, ageMs = 1000, latestTimeOverride?: string) {
    return {
        name,
        interval,
        extents: [{
            'last-update': new Date(Date.now() - ageMs).toISOString(),
            'latest-time': latestTimeOverride ?? new Date(Date.now() - ageMs).toISOString()
        }]
    };
}

describe('USACE CWMS Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('intervalToMinutes', () => {
        it('parses standard CWMS interval strings', () => {
            expect(intervalToMinutes('15Minutes')).toBe(15);
            expect(intervalToMinutes('1Hour')).toBe(60);
            expect(intervalToMinutes('1Day')).toBe(1440);
            expect(intervalToMinutes('~1Day')).toBe(1440);
        });

        it('sorts unparseable intervals last', () => {
            expect(intervalToMinutes('irregular')).toBe(Number.MAX_SAFE_INTEGER);
            expect(intervalToMinutes('')).toBe(Number.MAX_SAFE_INTEGER);
        });
    });

    describe('pickBestSeries', () => {
        const now = 1_800_000_000_000;
        const DAY = 24 * 60 * 60 * 1000;

        it('prefers the most recently updated series', () => {
            const result = pickBestSeries([
                { name: 'A', lastUpdate: now - DAY * 2, intervalMinutes: 15 },
                { name: 'B', lastUpdate: now - DAY, intervalMinutes: 60 }
            ], now);
            expect(result?.name).toBe('B');
        });

        it('tie-breaks equally fresh series by shortest interval', () => {
            const result = pickBestSeries([
                { name: 'Daily', lastUpdate: now, intervalMinutes: 1440 },
                { name: 'Hourly', lastUpdate: now, intervalMinutes: 60 }
            ], now);
            expect(result?.name).toBe('Hourly');
        });

        it('rejects every candidate older than 30 days', () => {
            const result = pickBestSeries([
                { name: 'Stale', lastUpdate: now - DAY * 45, intervalMinutes: 15 }
            ], now);
            expect(result).toBeNull();
        });

        it('returns null for an empty candidate list', () => {
            expect(pickBestSeries([], now)).toBeNull();
        });
    });

    describe('resolveProjectElevation', () => {
        it('uses the bare project name when it has a live series (e.g. LRL/Brookville)', async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
                entries: [elevationEntry('Brookville.Elev.Inst.1Hour.0.OBS', '1Hour')]
            }));

            const result = await resolveProjectElevation('LRL', 'Brookville');
            expect(result?.location).toBe('Brookville');
            expect(globalThis.fetch).toHaveBeenCalledOnce();
        });

        it('falls back to the "-Lake" sub-location when the bare name has no series (e.g. LRH/Summersville)', async () => {
            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({ entries: [] })) // "Summersville" — nothing
                .mockResolvedValueOnce(jsonResponse({ // "Summersville-Lake" — has it
                    entries: [elevationEntry('Summersville-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }));

            const result = await resolveProjectElevation('LRH', 'Summersville');
            expect(result?.location).toBe('Summersville-Lake');
            expect(result?.series.name).toBe('Summersville-Lake.Elev.Inst.15Minutes.0.OBS');
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('returns null when neither variant has a fresh series', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ entries: [] }));

            const result = await resolveProjectElevation('SPK', 'Englebright Lake');
            expect(result).toBeNull();
        });
    });

    // There is no hand-maintained override table (removed — auto-discovery reproduces
    // the same two reservoirs it was originally seeded with, so every site, including
    // these, resolves through the same live discovery + values fetch every call.
    describe('usaceProvider.getHistory', () => {
        it('follows CWMS next-page cursors instead of truncating at page-size (regression)', async () => {
            const page1Values = Array.from({ length: 3 }, (_, i) => [Date.now() - (10 - i) * 60000, 1650 + i, 3]);
            const page2Values = Array.from({ length: 2 }, (_, i) => [Date.now() - (4 - i) * 60000, 1653 + i, 3]);

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [elevationEntry('Summersville-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }))
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ values: page1Values, 'next-page': 'CURSOR_TOKEN' })
                })
                .mockResolvedValueOnce(jsonResponse({ values: page2Values })); // no next-page: last page

            const now = Date.now();
            const result = await usaceProvider.getHistory(['LRH.Summersville-Lake'], now - 1000 * 60 * 60, now);

            expect(globalThis.fetch).toHaveBeenCalledTimes(3);
            const page2Url = (globalThis.fetch as any).mock.calls[2][0] as string;
            expect(page2Url).toContain('page=CURSOR_TOKEN');

            // Both pages' values present and correctly concatenated in request order.
            expect(result['LRH.Summersville-Lake'].readings).toHaveLength(5);
            expect(result['LRH.Summersville-Lake'].readings[0].ft).toBe(1650);
            expect(result['LRH.Summersville-Lake'].readings[4].ft).toBe(1654);
        });

        it('resolves a code live (discovery, then values) and formats readings', async () => {
            const t1 = Date.now() - 1000 * 60 * 30;
            const t2 = Date.now() - 1000 * 60 * 15;

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [elevationEntry('Summersville-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }))
                .mockResolvedValueOnce(jsonResponse({ values: [[t1, 1652.38, 3], [t2, 1652.44, 3]] }));

            const now = Date.now();
            const result = await usaceProvider.getHistory(['LRH.Summersville-Lake'], now - 1000 * 60 * 60, now);

            expect(result['LRH.Summersville-Lake']).toBeDefined();
            expect(result['LRH.Summersville-Lake'].name).toBe('Summersville-Lake');
            expect(result['LRH.Summersville-Lake'].readings).toHaveLength(2);
            expect(result['LRH.Summersville-Lake'].readings[1].ft).toBe(1652.44);

            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
            const valuesUrl = (globalThis.fetch as any).mock.calls[1][0] as string;
            expect(valuesUrl).toContain('office=LRH');
            expect(valuesUrl).toContain('Summersville-Lake.Elev.Inst.15Minutes.0.OBS');
        });

        it('filters out sentinel error values', async () => {
            const t1 = Date.now() - 1000 * 60 * 30;
            const t2 = Date.now() - 1000 * 60 * 15;

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [elevationEntry('Bluestone-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }))
                .mockResolvedValueOnce(jsonResponse({ values: [[t1, -901, 5], [t2, 1410.05, 3]] }));

            const now = Date.now();
            const result = await usaceProvider.getHistory(['LRH.Bluestone-Lake'], now - 1000 * 60 * 60, now);

            expect(result['LRH.Bluestone-Lake'].readings).toHaveLength(1);
            expect(result['LRH.Bluestone-Lake'].readings[0].ft).toBe(1410.05);
        });

        it('resolves a location by picking the freshest .Elev. series (excluding non-Elev variants)', async () => {
            const t1 = Date.now() - 1000 * 60 * 30;

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [
                        elevationEntry('Camanche.Elev-Top Con.Inst.~1Day.0.Calc-manual', '~1Day'),
                        elevationEntry('Camanche.Elev.Inst.1Hour.0.Calc-manual', '1Hour'),
                        elevationEntry('Camanche.Elev.Inst.~1Day.0.MANUAL', '~1Day', 2000)
                    ]
                }))
                .mockResolvedValueOnce(jsonResponse({ values: [[t1, 234.5, 3]] }));

            const now = Date.now();
            const result = await usaceProvider.getHistory(['SPK.Camanche'], now - 1000 * 60 * 60, now);

            expect(result['SPK.Camanche']).toBeDefined();
            expect(result['SPK.Camanche'].readings[0].ft).toBe(234.5);

            // Should have picked the hourly series (freshest + shortest interval), not the
            // "Elev-Top Con" variant or the coarser once-daily manual reading.
            const valuesUrl = (globalThis.fetch as any).mock.calls[1][0] as string;
            expect(valuesUrl).toContain('Camanche.Elev.Inst.1Hour.0.Calc-manual');
        });

        it('does not let a rule-curve series with a far-future latest-time beat live OBS telemetry (Bluestone regression)', async () => {
            const t1 = Date.now() - 1000 * 60 * 15;

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [
                        // RUL: last-update just now, but latest-time is 5 months in the future
                        elevationEntry('Bluestone-Lake.Elev.Inst.1Day.0.RUL', '1Day', 60000, '2026-12-31T12:30:00Z'),
                        // OBS: last-update also just now, latest-time is "now" like real telemetry
                        elevationEntry('Bluestone-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes', 30000)
                    ]
                }))
                .mockResolvedValueOnce(jsonResponse({ values: [[t1, 1410.05, 3]] }));

            const now = Date.now();
            const result = await usaceProvider.getHistory(['LRH.Bluestone-Lake'], now - 1000 * 60 * 60, now);

            expect(result['LRH.Bluestone-Lake']).toBeDefined();
            const valuesUrl = (globalThis.fetch as any).mock.calls[1][0] as string;
            expect(valuesUrl).toContain('Bluestone-Lake.Elev.Inst.15Minutes.0.OBS');
            expect(valuesUrl).not.toContain('RUL');
        });

        it('returns nothing for a location whose only elevation series is stale', async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
                entries: [elevationEntry('Englebright_Lake.Elev.Inst.~1Day.0.MANUAL', '~1Day', 1000 * 60 * 60 * 24 * 60)]
            }));

            const now = Date.now();
            const result = await usaceProvider.getHistory(['SPK.Englebright_Lake'], now - 1000 * 60 * 60, now);

            expect(result['SPK.Englebright_Lake']).toBeUndefined();
            expect(globalThis.fetch).toHaveBeenCalledOnce(); // only discovery — no values call made
        });

        it('handles a persistent API failure gracefully', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

            const now = Date.now();
            const result = await usaceProvider.getHistory(['LRH.Summersville-Lake'], now - 1000 * 60 * 60, now);

            expect(result['LRH.Summersville-Lake']).toBeUndefined();
        }, 10000);
    });

    describe('usaceProvider.getHistory (registry name preference)', () => {
        it('prefers the registry-cached public name over the raw location slug', async () => {
            // Uses a freshly re-imported module instance so this test's registry cache
            // can never leak into (or be affected by) the statically-imported
            // `usaceProvider` used by every other test in this file.
            vi.resetModules();
            const { usaceProvider: freshProvider } = await import('../usace');

            const fakeEnv = {
                FLOW_STORAGE: {
                    get: vi.fn().mockResolvedValue({
                        json: () => Promise.resolve({
                            'USACE:LRH.Summersville-Lake': { name: 'Summersville Lake', state: 'WV' }
                        })
                    })
                }
            };

            const t1 = Date.now() - 1000 * 60 * 15;
            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [elevationEntry('Summersville-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }))
                .mockResolvedValueOnce(jsonResponse({ values: [[t1, 1652.44, 3]] }));

            const now = Date.now();
            const result = await freshProvider.getHistory(['LRH.Summersville-Lake'], now - 1000 * 60 * 60, now, false, fakeEnv);

            expect(result['LRH.Summersville-Lake'].name).toBe('Summersville Lake');
            expect(result['LRH.Summersville-Lake'].state).toBe('WV');
            expect(result['LRH.Summersville-Lake'].section).toBeUndefined();
        });
    });

    describe('usaceProvider.getLatest', () => {
        it('returns only the most recent reading', async () => {
            const t1 = Date.now() - 1000 * 60 * 30;
            const t2 = Date.now() - 1000 * 60 * 15;

            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [elevationEntry('Summersville-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }))
                .mockResolvedValueOnce(jsonResponse({ values: [[t1, 1652.38, 3], [t2, 1652.44, 3]] }));

            const result = await usaceProvider.getLatest(['LRH.Summersville-Lake']);
            expect(result['LRH.Summersville-Lake'].ft).toBe(1652.44);
        });
    });

    describe('usaceProvider.getSiteListing', () => {
        it('resolves a code live and fetches its coordinates', async () => {
            globalThis.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({
                    entries: [elevationEntry('Summersville-Lake.Elev.Inst.15Minutes.0.OBS', '15Minutes')]
                }))
                .mockResolvedValueOnce(jsonResponse({
                    latitude: 38.2226,
                    longitude: -80.8903,
                    'public-name': 'Summersville Lake',
                    'state-initial': 'WV'
                }));

            const result = await usaceProvider.getSiteListing(['LRH.Summersville-Lake']);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'LRH.Summersville-Lake',
                name: 'Summersville Lake',
                lat: 38.2226,
                lon: -80.8903,
                state: 'WV',
                country: 'US'
            });
        });
    });
});
