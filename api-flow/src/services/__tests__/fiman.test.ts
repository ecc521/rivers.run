import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fimanProvider, easternToUtcMs, parseLastUpdate, parseHistoryTime, stageOffset, latestReading,
    displayName, isMapEligible, reorderName,
} from '../fiman';
import { dropCoveredSites } from '../../utils/geo';
import type { GaugeSite } from '../provider';

const feedProps = (over: Record<string, unknown> = {}) => ({
    siteId: '25530', name: ' N Fork Catawba River/Us 221 N\r\n', latitude: 35.8754, longitude: -81.9426, county: 'McDowell',
    inService: 1, hydroAllStage: 1.71, currentElevationMsl: 1723.04, gageDatum: 1721.33,
    lastUpdate: 'Oct  4 2026  2:45PM', ...over,
});

const mockFetch = (body: unknown, ok = true, status = 200) => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok, status, text: () => Promise.resolve(JSON.stringify(body)) });
};

const feed = (...props: Record<string, unknown>[]) => ({ features: props.map(properties => ({ properties })) });

describe('FIMAN Eastern time', () => {
    it('converts EDT and EST wall-clock times', () => {
        expect(easternToUtcMs(2026, 9, 4, 14, 31, 50)).toBe(Date.UTC(2026, 9, 4, 18, 31, 50));
        expect(easternToUtcMs(2026, 0, 15, 14, 31)).toBe(Date.UTC(2026, 0, 15, 19, 31));
    });

    it('reads the repeated November hour as EDT and a skipped March hour as EST', () => {
        expect(easternToUtcMs(2026, 10, 1, 1, 30)).toBe(Date.UTC(2026, 10, 1, 5, 30));
        expect(easternToUtcMs(2026, 10, 1, 2, 30)).toBe(Date.UTC(2026, 10, 1, 7, 30));
        expect(easternToUtcMs(2026, 2, 8, 2, 30)).toBe(Date.UTC(2026, 2, 8, 7, 30));
    });

    it('parses lastUpdate text', () => {
        expect(parseLastUpdate('Oct  4 2026  2:45PM')).toBe(Date.UTC(2026, 9, 4, 18, 45));
        expect(parseLastUpdate('Jan 15 2026 12:05AM')).toBe(Date.UTC(2026, 0, 15, 5, 5));
        expect(parseLastUpdate('Jan 15 2026 12:05PM')).toBe(Date.UTC(2026, 0, 15, 17, 5));
        expect(parseLastUpdate('nonsense')).toBeNull();
        expect(parseLastUpdate(null)).toBeNull();
    });

    it('parses unzoned history times', () => {
        expect(parseHistoryTime('2026-10-04T14:45:00')).toBe(Date.UTC(2026, 9, 4, 18, 45));
        expect(parseHistoryTime('bad')).toBeNull();
    });
});

describe('FIMAN stage offset', () => {
    it('prefers the offset implied by current elevation and stage', () => {
        expect(stageOffset({ currentElevationMsl: 1723.04, hydroAllStage: 1.71, gageDatum: 5 })).toBeCloseTo(1721.33);
    });

    it('falls back to the datum, then to null', () => {
        expect(stageOffset({ gageDatum: 928.7 })).toBe(928.7);
        expect(stageOffset({})).toBeNull();
    });
});

describe('FIMAN provider', () => {
    beforeEach(() => vi.clearAllMocks());

    it('builds a latest reading from the feed', () => {
        expect(latestReading(feedProps())).toEqual({ dateTime: Date.UTC(2026, 9, 4, 18, 45), ft: 1.71 });
        expect(latestReading(feedProps({ lastUpdate: 'garbled' }))).toBeNull();
        expect(latestReading(feedProps({ hydroAllStage: null }))).toBeNull();
    });

    it('getLatest returns only requested gauges', async () => {
        mockFetch(feed(feedProps(), feedProps({ siteId: '1850', hydroAllStage: 0.58 })));
        const result = await fimanProvider.getLatest(['1850']);
        expect(Object.keys(result)).toEqual(['1850']);
        expect(result['1850'].ft).toBe(0.58);
        expect(String((globalThis.fetch as any).mock.calls[0][0])).toBe('https://fiman.nc.gov/api/gaugefeatures');
        expect((globalThis.fetch as any).mock.calls[0][1].headers['User-Agent']).toMatch(/Rivers\.run Flow Bot/);
    });

    it('getLatest throws when FIMAN blocks the request, leaving isolation to the caller', async () => {
        mockFetch({}, false, 403);
        await expect(fimanProvider.getLatest(['1850'])).rejects.toThrow(/403/);
    });

    it('getHistory converts elevation to stage and Eastern times to UTC', async () => {
        mockFetch({
            ...feedProps(),
            historical: [
                { value: 1722.58, at: '2026-10-04T10:30:00', code: '00065' },
                { value: 1723.04, at: '2026-10-04T14:45:00', code: '00065' },
                { value: 19.8, at: '2026-10-04T14:45:00', code: '00060' },
            ],
        });
        const result = await fimanProvider.getHistory(['25530'], Date.UTC(2026, 9, 4), Date.UTC(2026, 9, 5));
        const history = result['25530'];
        expect(history.name).toContain('Catawba');
        expect(history.state).toBe('NC');
        expect(history.units).toBe('ft');
        expect(history.readings).toEqual([
            { dateTime: Date.UTC(2026, 9, 4, 14, 30), ft: 1.25 },
            { dateTime: Date.UTC(2026, 9, 4, 18, 45), ft: 1.71 },
        ]);
    });

    it('getHistory clips to the requested window', async () => {
        mockFetch({
            ...feedProps(),
            historical: [
                { value: 1722.58, at: '2026-10-04T10:30:00', code: '00065' },
                { value: 1723.04, at: '2026-10-04T14:45:00', code: '00065' },
            ],
        });
        const result = await fimanProvider.getHistory(['25530'], Date.UTC(2026, 9, 4, 16));
        expect(result['25530'].readings).toHaveLength(1);
    });

    it('getHistory fetches at most 5 gauges at a time', async () => {
        let inFlight = 0;
        let peak = 0;
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise(r => setTimeout(r, 2));
            inFlight--;
            return { ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ ...feedProps(), historical: [] })) };
        });
        const codes = Array.from({ length: 20 }, (_, i) => `G${i}`);
        const result = await fimanProvider.getHistory(codes, 0, 1);
        expect(Object.keys(result)).toHaveLength(20);
        expect(peak).toBe(5);
    });

    it('getHistory leaves out a gauge whose fetch fails', async () => {
        mockFetch({}, false, 403);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(await fimanProvider.getHistory(['25530'], 0, 1)).toEqual({});
    });

    it('getHistory skips a gauge it cannot offset to stage', async () => {
        mockFetch({ siteId: 'X', historical: [{ value: 5, at: '2026-10-04T10:30:00', code: '00065' }] });
        expect(await fimanProvider.getHistory(['X'], 0)).toEqual({});
    });

    it('lists linked sites without the map filters, and every eligible site otherwise', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(Date.UTC(2026, 9, 4, 19, 0));
        try {
            const feedBody = feed(
                feedProps(),
                feedProps({ siteId: 'DCBV2', name: 'Dan River at Central Blvd in Danville', county: 'Danville VA' }),
                feedProps({ siteId: 'NOLOC', latitude: null }),
                feedProps({ siteId: 'OWNED', owner: 'USGS' }),
                feedProps({ siteId: 'DEAD', lastUpdate: 'Sep 20 2026  2:45PM' }),
                feedProps({ siteId: 'DAM', hydroAllStage: 989.32 }),
            );
            mockFetch(feedBody);
            const all = await fimanProvider.getFullSiteListing!();
            expect(all.map(s => [s.id, s.state])).toEqual([['25530', 'NC'], ['DCBV2', 'VA']]);
            expect(all[0]).toMatchObject({ lat: 35.8754, lon: -81.9426, country: 'US' });

            mockFetch(feedBody);
            expect((await fimanProvider.getSiteListing(['DAM', 'OWNED', 'NOLOC'])).map(s => s.id)).toEqual(['OWNED', 'DAM']);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('FIMAN map eligibility', () => {
    const now = Date.UTC(2026, 9, 4, 19, 0);
    const ok = feedProps({ owner: 'NCEM', isCoastal: 0, rainOnlyGage: 0 });

    it('accepts a working inland stage gauge', () => {
        expect(isMapEligible(ok, now)).toBe(true);
    });

    it.each([
        ['USGS-owned', { owner: 'USGS' }],
        ['a Town of Cary storm drain', { owner: 'Town of Cary' }],
        ['out of service', { inService: 0 }],
        ['coastal', { isCoastal: 1 }],
        ['rain only', { rainOnlyGage: 1 }],
        ['a lake elevation', { hydroAllStage: 989.32 }],
        ['a week without a reading', { lastUpdate: 'Sep 26 2026  2:45PM' }],
        ['no stage', { hydroAllStage: null }],
        ['an unreadable time', { lastUpdate: 'x' }],
    ])('rejects a gauge that is %s', (_label, over) => {
        expect(isMapEligible({ ...ok, ...over }, now)).toBe(false);
    });
});

describe('FIMAN coverage and names', () => {
    const site = (id: string, lat: number, lon: number): GaugeSite => ({ id, name: id, lat, lon });

    it('drops sites within 300 m of another network and keeps the rest', () => {
        const others = [site('USGS:1', 35.0, -82.0)];
        const sites = [
            site('near', 35.0 + 0.002, -82.0), // about 220 m
            site('edge', 35.0 + 0.004, -82.0), // about 440 m
            site('far', 36.0, -82.0),
        ];
        expect(dropCoveredSites(sites, others).map(s => s.id)).toEqual(['edge', 'far']);
        expect(dropCoveredSites(sites, [])).toHaveLength(3);
    });

    it('formats FIMAN names and expands Cary stream prefixes', () => {
        expect(displayName('SC: Seabrook US', 'x').name).toMatch(/^Swift Creek/);
        expect(displayName('FLAT CREEK @ US70, Black Mountain', 'x').name).toMatch(/^Flat Creek/);
        expect(displayName('  ', 'fallback')).toEqual({ name: 'fallback' });
    });

    it('puts the waterbody first when a feed name lists the road or landmark first', () => {
        expect(displayName('Bunches Creek Rd @ Raven Fork', 'x')).toEqual({ name: 'Raven Fork', section: 'At Bunches Creek Road' });
        expect(displayName('Tribal Hatchery @ Straight Fork', 'x')).toEqual({ name: 'Straight Fork', section: 'At Tribal Hatchery' });
        expect(displayName('Water Intake at Lumber River', 'x')).toEqual({ name: 'Lumber River', section: 'At Water Intake' });
        expect(displayName('River Road over Barnards Creek', 'x')).toEqual({ name: 'Barnards Creek', section: 'At River Road' });
        expect(displayName('Greenville Loop Road over Hewletts Creek', 'x')).toEqual({ name: 'Hewletts Creek', section: 'At Greenville Loop Road' });
    });

    it('reads dashes and slashes as "at" only between a waterbody and a place', () => {
        expect(displayName('Locks Creek - Cedar Creek Rd.', 'x')).toEqual({ name: 'Locks Creek', section: 'At Cedar Creek Road' });
        expect(displayName('Beaver Creek 2 - Louise St.', 'x')).toEqual({ name: 'Beaver Creek 2', section: 'At Louise St' });
        expect(displayName('Mud Creek/Hendersonville', 'x')).toEqual({ name: 'Mud Creek', section: 'At Hendersonville' });
        expect(displayName('Nottely River/Cook Bridge', 'x')).toEqual({ name: 'Nottely River', section: 'At Cook Bridge' });
    });

    it('keeps US highways and drops the period left by abbreviations', () => {
        expect(displayName('N Fork Catawba River/Us 221 N', 'x')).toEqual({ name: 'North Fork Catawba River', section: 'At US 221 North' });
        expect(displayName('FLAT CREEK @ US70, Black Mountain', 'x')).toEqual({ name: 'Flat Creek', section: 'At US70, Black Mountain' });
        expect(displayName('French Broad R. at Craven St', 'x')).toEqual({ name: 'French Broad River', section: 'At Craven St' });
    });

    it('leaves names alone unless both sides clearly fit', () => {
        const untouched = [
            'Bridge Creek at US15', 'Blanket Cr @Lasater Mill Pond', 'Marsh Causeway @ NC 615', 'Smiths Creek - Upper',
            'Wilmington - Cape Fear R nr US 17/76', 'Neuse R at Cherry Branch Ferry Terminal', 'Little River/Sparta Bridge Creek',
            'Morrisville - Cedar Fork District Park', 'North Toe River Between Plumtree/Frank', 'Snowbird Creek N/Milltown',
        ];
        for (const raw of untouched) expect(reorderName(raw)).toBe(raw);
        expect(displayName('SC: Seabrook US', 'x')).toEqual({ name: 'Swift Creek', section: 'At Seabrook Upstream' });
        expect(displayName('Wilson Creek near Edgemont', 'x')).toEqual({ name: 'Wilson Creek', section: 'Near Edgemont' });
    });
});
