import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    usaceProvider, siteIdOf, cdaOfficeOf, latestReading, projectSites, forecastCandidates, chooseForecast,
    syncUsaceSites, USACE_SITES_KEY, type A2WProject,
} from '../usace';

const NOW = Date.UTC(2026, 9, 4, 16, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (t: number) => new Date(t).toISOString();

const summersville = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-80.89, 38.22] },
    properties: {
        provider: 'LRH', code: 'Summersville', public_name: 'Summersville Lake', state: 'WV',
        timeseries: [
            { tsid: 'Summersville-Lake.Flow.Inst.15Minutes.0.OBS', label: 'Inflow', latest_time: iso(NOW - HOUR), latest_value: 604 },
            { tsid: 'Summersville-Outflow.Flow.Inst.15Minutes.0.OBS', label: 'Outflow', latest_time: iso(NOW - HOUR), latest_value: 2842.5 },
            { tsid: 'Summersville-Lake.Elev.Inst.15Minutes.0.OBS', label: 'Elevation', latest_time: iso(NOW - 2 * HOUR), latest_value: 1636.4 },
            { tsid: 'Summersville-Outflow.Stage.Inst.15Minutes.0.OBS', label: 'Stage Tailwater', latest_time: iso(NOW - HOUR), latest_value: 11.05 },
        ],
    },
};
const lockAndDam = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-91, 34] },
    properties: { provider: 'MVK', code: 'L&D 1', public_name: 'Lock and Dam 1', timeseries: [{ tsid: 'LD1.Stage.Inst.1Hour.0.raw', label: 'Stage' }] },
};

/** Routes fetch by URL substring; unmatched URLs fail the test. */
function mockFetch(routes: Array<[string, (url: string) => any]>) {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: any) => {
        const url = decodeURIComponent(String(input));
        calls.push(url);
        const route = routes.find(([match]) => url.includes(match));
        if (!route) throw new Error(`unexpected fetch ${url}`);
        const body = route[1](url);
        return { ok: true, json: async () => body, text: async () => JSON.stringify(body) } as any;
    }) as any;
    return calls;
}

describe('USACE helpers', () => {
    it('makes URL-safe site ids', () => {
        expect(siteIdOf('LRH', 'Summersville')).toBe('LRH.Summersville');
        expect(siteIdOf('MVK', 'L&D 1')).toBe('MVK.L_D_1');
    });

    it('maps Northwest districts to their division office', () => {
        expect(cdaOfficeOf('NWP')).toBe('NWDP');
        expect(cdaOfficeOf('NWO')).toBe('NWDM');
        expect(cdaOfficeOf('LRH')).toBe('LRH');
    });

    it('splits a dam into an outflow gauge (release, tailwater stage) and a lake gauge', () => {
        const project = { ...summersville.properties } as A2WProject;
        const sites = projectSites(project);
        expect(sites).toEqual([
            ['LRH.Summersville', {
                provider: 'LRH', name: 'Summersville Lake (Outflow)', state: 'WV',
                flow: 'Summersville-Outflow.Flow.Inst.15Minutes.0.OBS', stage: 'Summersville-Outflow.Stage.Inst.15Minutes.0.OBS',
            }],
            ['LRH.Summersville.Lake', {
                provider: 'LRH', name: 'Summersville Lake (Lake Level)', state: 'WV',
                flow: undefined, stage: 'Summersville-Lake.Elev.Inst.15Minutes.0.OBS',
            }],
        ]);
        expect(latestReading(project, sites[0][1])).toEqual({ dateTime: NOW - HOUR, cfs: 2842.5, ft: 11.05 });
        expect(latestReading(project, sites[1][1])).toEqual({ dateTime: NOW - 2 * HOUR, ft: 1636.4 });
    });

    it('drops sentinels and falls back to the stage time without a flow', () => {
        const project = {
            provider: 'X', code: 'Y', timeseries: [
                { tsid: 'a', label: 'Outflow', latest_time: iso(NOW), latest_value: -999999 },
                { tsid: 'b', label: 'Stage Tailwater', latest_time: iso(NOW - HOUR), latest_value: 5 },
            ],
        } as A2WProject;
        const [[, site]] = projectSites(project);
        expect(latestReading(project, site)).toEqual({ dateTime: NOW - HOUR, ft: 5 });
    });
});

describe('forecast series selection', () => {
    const catalog = [
        'Summersville-Lake.Flow.Inst.1Hour.0.CELRH-FCST-DAILY',
        'Summersville-Lake.Elev.Inst.1Hour.0.CELRH-FCST-DAILY',
        'Summersville-Outflow.Flow.Inst.1Hour.0.CELRH-FCST-DAILY',
        'Summersville.Flow-Out.Inst.1Hour.0.National-CWMS-Forecast',
        'Summersville-Outflow.Flow.Inst.15Minutes.0.OBS',
        'Sutton-Outflow.Flow.Inst.1Hour.0.CELRH-FCST-DAILY',
    ];

    it('ranks the outflow location first and never takes the lake inflow', () => {
        expect(forecastCandidates('Summersville-Outflow.Flow.Inst.15Minutes.0.OBS', 'Summersville', catalog)).toEqual([
            ['Summersville-Outflow.Flow.Inst.1Hour.0.CELRH-FCST-DAILY'],
            ['Summersville.Flow-Out.Inst.1Hour.0.National-CWMS-Forecast'],
        ]);
    });

    it('takes the best tier with data past now, then the furthest horizon', () => {
        const tiers = [['a', 'b'], ['c']];
        expect(chooseForecast(tiers, new Map([['a', NOW + DAY], ['b', NOW + 5 * DAY], ['c', NOW + 9 * DAY]]), NOW)).toBe('b');
        expect(chooseForecast(tiers, new Map([['a', NOW - DAY], ['c', NOW + DAY]]), NOW)).toBe('c');
        expect(chooseForecast(tiers, new Map([['a', NOW - DAY]]), NOW)).toBeUndefined();
    });
});

describe('usaceProvider', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    });

    it('lists dams with outflow or elevation and returns their latest readings', async () => {
        mockFetch([['/providers/projects', () => [summersville, lockAndDam]]]);
        const sites = await usaceProvider.getFullSiteListing!();
        expect(sites).toEqual([
            { id: 'LRH.Summersville', name: 'Summersville Lake (Outflow)', lat: 38.22, lon: -80.89, state: 'WV', country: 'US' },
            { id: 'LRH.Summersville.Lake', name: 'Summersville Lake (Lake Level)', lat: 38.22, lon: -80.89, state: 'WV', country: 'US' },
        ]);
        const latest = await usaceProvider.getLatest(['LRH.Summersville', 'LRH.Summersville.Lake', 'MVK.L_D_1']);
        expect(latest).toEqual({
            'LRH.Summersville': { dateTime: NOW - HOUR, cfs: 2842.5, ft: 11.05 },
            'LRH.Summersville.Lake': { dateTime: NOW - 2 * HOUR, ft: 1636.4 },
        });
    });

    it('builds the sites file with each live projected-release series', async () => {
        mockFetch([
            ['/providers/projects', () => [summersville]],
            ['/catalog/TIMESERIES', (url) => ({ entries: url.includes('office=LRH') ? [{ name: 'Summersville-Outflow.Flow.Inst.1Hour.0.CELRH-FCST-DAILY' }] : [] })],
            ['/timeseries/recent', () => [{ id: 'Summersville-Outflow.Flow.Inst.1Hour.0.CELRH-FCST-DAILY', dqu: { 'date-time': NOW + 14 * DAY } }]],
        ]);
        const put = vi.fn();
        const result = await syncUsaceSites({ FLOW_STORAGE: { put } }, NOW);
        expect(result).toEqual({ sites: 2, forecasts: 1 });
        expect(put.mock.calls[0][0]).toBe(USACE_SITES_KEY);
        const saved = JSON.parse(put.mock.calls[0][1]);
        expect(saved['LRH.Summersville']).toEqual({
            provider: 'LRH', name: 'Summersville Lake (Outflow)', state: 'WV',
            flow: 'Summersville-Outflow.Flow.Inst.15Minutes.0.OBS',
            stage: 'Summersville-Outflow.Stage.Inst.15Minutes.0.OBS',
            forecast: { office: 'LRH', tsId: 'Summersville-Outflow.Flow.Inst.1Hour.0.CELRH-FCST-DAILY' },
        });
        expect(saved['LRH.Summersville.Lake']).toEqual({
            provider: 'LRH', name: 'Summersville Lake (Lake Level)', state: 'WV', stage: 'Summersville-Lake.Elev.Inst.15Minutes.0.OBS',
        });
    });

    it('merges release and tailwater stage history, caps it at a week, and appends projected releases', async () => {
        // syncUsaceSites above left the sites cached in the module.
        const lastObs = NOW - HOUR;
        const calls = mockFetch([
            ['Summersville-Outflow.Flow.Inst.15Minutes.0.OBS', () => ({ values: [[iso(lastObs - HOUR), 2800], [iso(lastObs), 2842]] })],
            ['Summersville-Outflow.Stage.Inst.15Minutes.0.OBS', () => ({ values: [[iso(lastObs), 11.05], [iso(lastObs - 30 * 60000), null]] })],
            ['/cwms-data/timeseries?', () => ({ values: [[lastObs - HOUR, 2900, 0], [lastObs + HOUR, 400, 0], [lastObs + 2 * HOUR, -999999, 0]] })],
        ]);

        const result = await usaceProvider.getHistory(['LRH.Summersville'], NOW - 28 * DAY, undefined, true, {});
        expect(result['LRH.Summersville'].readings).toEqual([
            { dateTime: lastObs - HOUR, cfs: 2800 },
            { dateTime: lastObs, cfs: 2842, ft: 11.05 },
            { dateTime: lastObs + HOUR, cfs: 400, isForecast: true, forecastSource: 'USACE' },
        ]);
        expect(result['LRH.Summersville'].name).toBe('Summersville Lake (Outflow)');
        expect(calls.find(u => u.includes('Outflow.Flow.Inst.15Minutes'))).toContain(`begin=${iso(NOW - 7 * DAY)}`);
    });

    it('serves the lake gauge as ft only, never with a forecast, and nothing for unknown dams', async () => {
        const calls = mockFetch([['/reporting/providers/lrh/timeseries', () => ({ values: [[iso(NOW - HOUR), 1636]] })]]);
        const result = await usaceProvider.getHistory(['LRH.Summersville.Lake', 'LRH.Nope'], NOW - DAY, undefined, true, {});
        expect(Object.keys(result)).toEqual(['LRH.Summersville.Lake']);
        expect(result['LRH.Summersville.Lake'].readings).toEqual([{ dateTime: NOW - HOUR, ft: 1636 }]);
        expect(calls.some(u => u.includes('cwms-data'))).toBe(false);
    });

    it('shares graph responses through the edge cache and refetches nothing on a hit', async () => {
        const store = new Map<string, Response>();
        (globalThis as any).caches = {
            default: {
                match: async (key: string) => store.get(key)?.clone(),
                put: async (key: string, res: Response) => { store.set(key, res); },
            },
        };
        try {
            const calls = mockFetch([
                ['/reporting/providers/lrh/timeseries', () => ({ values: [[iso(NOW - DAY), 2800], [iso(NOW - HOUR), 2842]] })],
                ['/cwms-data/timeseries?', () => ({ values: [[NOW + HOUR, 400, 0]] })],
            ]);
            const first = await usaceProvider.getHistory(['LRH.Summersville'], NOW - 28 * DAY, undefined, true, {});
            const fetched = calls.length;
            expect(fetched).toBe(3); // release, tailwater stage, forecast

            // A later delta request in the same quarter hour reads the cached week and trims it.
            const delta = await usaceProvider.getHistory(['LRH.Summersville'], NOW - 2 * HOUR, undefined, true, {});
            expect(calls.length).toBe(fetched);
            expect(first['LRH.Summersville'].readings.map(r => r.dateTime)).toEqual([NOW - DAY, NOW - HOUR, NOW + HOUR]);
            expect(delta['LRH.Summersville'].readings.map(r => r.dateTime)).toEqual([NOW - HOUR, NOW + HOUR]);
            expect([...store.values()].every(r => r.headers.get('Cache-Control') === 'max-age=600')).toBe(true);
        } finally {
            delete (globalThis as any).caches;
        }
    });
});
