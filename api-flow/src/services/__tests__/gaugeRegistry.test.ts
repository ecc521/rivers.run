import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileGaugeRegistry, refreshFimanListing, refreshNwsListing } from '../gaugeRegistry';
import { usgsProvider } from '../usgs';
import { ecProvider } from '../canada';
import { ukProvider } from '../uk';
import { irelandProvider } from '../ireland';
import { usaceProvider } from '../usace';
import { nwsProvider } from '../nws';
import { fimanProvider } from '../fiman';
import type { GaugeSite } from '../provider';

vi.mock('../../utils/logger', () => ({ logToD1: vi.fn() }));

const site = (id: string, lat: number, lon: number): GaugeSite => ({ id, name: id, lat, lon });

const envWithRivers = (gauges: string[][]) => ({
    DB: { prepare: () => ({ all: async () => ({ results: gauges.map(ids => ({ gauges: JSON.stringify(ids.map(id => ({ id }))) })) }) }) },
}) as any;

beforeEach(() => {
    vi.restoreAllMocks();
    for (const p of [usgsProvider, ecProvider, ukProvider, irelandProvider, usaceProvider]) {
        vi.spyOn(p, 'getFullSiteListing' as any).mockResolvedValue([]);
    }
    vi.spyOn(nwsProvider, 'getFullSiteListing' as any).mockResolvedValue([]);
});

describe('refreshFimanListing', () => {
    it('lists FIMAN sites that no USGS registry entry covers, replacing the old ones', async () => {
        vi.spyOn(fimanProvider, 'getFullSiteListing' as any).mockResolvedValue([
            site('covered', 35.001, -82.0), site('own', 36.0, -82.0),
        ]);
        const registry: Record<string, GaugeSite> = {
            'USGS:1': site('USGS:1', 35.0, -82.0),
            'FIMAN:old': site('FIMAN:old', 34.0, -80.0),
        };
        await refreshFimanListing({} as any, registry);
        expect(Object.keys(registry).filter(k => k.startsWith('FIMAN:'))).toEqual(['FIMAN:own']);
        expect(registry['FIMAN:own'].id).toBe('FIMAN:own');
    });

    it('keeps the existing FIMAN entries when the listing fails', async () => {
        vi.spyOn(fimanProvider, 'getFullSiteListing' as any).mockRejectedValue(new Error('403'));
        const registry: Record<string, GaugeSite> = { 'FIMAN:old': site('FIMAN:old', 34.0, -80.0) };
        await refreshFimanListing({} as any, registry);
        expect(Object.keys(registry)).toEqual(['FIMAN:old']);
    });
});

describe('refreshNwsListing', () => {
    const usgs = site('USGS:02', 35.0, -82.0);

    it('drops NWS gauges near a USGS gauge, or on a USGS site NWPS names, and keeps the rest with their USGS id', async () => {
        vi.spyOn(nwsProvider, 'getFullSiteListing' as any).mockResolvedValue([
            site('NEAR', 35.001, -82.0), site('ONSITE', 36.0, -82.0), site('ALONE', 36.5, -82.0), site('INACTIVE', 37.0, -82.0),
        ]);
        const lookup = vi.spyOn(nwsProvider, 'getSiteListing').mockResolvedValue([
            { ...site('ONSITE', 36.0, -82.0), usgsId: '03' },
            { ...site('ALONE', 36.5, -82.0), usgsId: null },
            { ...site('INACTIVE', 37.0, -82.0), usgsId: '99' },
        ]);
        const registry: Record<string, GaugeSite> = { 'USGS:02': usgs, 'USGS:03': site('USGS:03', 35.5, -81.0) };

        await refreshNwsListing(envWithRivers([]), registry);

        expect(lookup).toHaveBeenCalledWith(['ONSITE', 'ALONE', 'INACTIVE']);
        expect(Object.keys(registry).filter(k => k.startsWith('NWS:')).sort((a, b) => a.localeCompare(b))).toEqual(['NWS:ALONE', 'NWS:INACTIVE']);
        expect(registry['NWS:ALONE'].usgsId).toBeNull();
        expect(registry['NWS:INACTIVE'].usgsId).toBe('99');
    });

    it('does not look up a gauge it already knows, and retries one whose lookup failed', async () => {
        vi.spyOn(nwsProvider, 'getFullSiteListing' as any).mockResolvedValue([site('KNOWN', 36.0, -82.0), site('FAILED', 36.5, -82.0)]);
        const lookup = vi.spyOn(nwsProvider, 'getSiteListing').mockResolvedValue([]);
        const registry: Record<string, GaugeSite> = { 'USGS:02': usgs, 'NWS:KNOWN': { ...site('NWS:KNOWN', 36.0, -82.0), usgsId: null } };

        await refreshNwsListing(envWithRivers([]), registry);
        expect(lookup).toHaveBeenCalledWith(['FAILED']);
        expect(registry['NWS:FAILED'].usgsId).toBeUndefined();

        await refreshNwsListing(envWithRivers([]), registry);
        expect(lookup).toHaveBeenLastCalledWith(['FAILED']);
    });

    it('looks sites up in batches, keeps what a good batch found, and leaves a failed batch to be retried', async () => {
        const ids = Array.from({ length: 120 }, (_, i) => `G${String(i).padStart(3, '0')}`);
        vi.spyOn(nwsProvider, 'getFullSiteListing' as any).mockResolvedValue(ids.map((id, i) => site(id, 36 + i * 0.01, -82.0)));
        const lookup = vi.spyOn(nwsProvider, 'getSiteListing').mockImplementation(async batch => {
            if (batch[0] === 'G050') throw new Error('timeout');
            return batch.map(id => ({ ...site(id, 36.0, -82.0), usgsId: null }));
        });
        const registry: Record<string, GaugeSite> = { 'USGS:02': usgs };

        await refreshNwsListing(envWithRivers([]), registry);

        expect(lookup.mock.calls.map(c => c[0].length)).toEqual([50, 50, 20]);
        expect(registry['NWS:G000'].usgsId).toBeNull();
        expect(registry['NWS:G060'].usgsId).toBeUndefined();
        expect(registry['NWS:G110'].usgsId).toBeNull();
        expect(Object.keys(registry).filter(k => k.startsWith('NWS:'))).toHaveLength(120);
    });

    it('keeps the registered NWS gauges when the listing fails, and still adds linked ones', async () => {
        vi.spyOn(nwsProvider, 'getFullSiteListing' as any).mockRejectedValue(new Error('504'));
        vi.spyOn(nwsProvider, 'getSiteListing').mockResolvedValue([site('CO1', 39.0, -105.0)]);
        const registry: Record<string, GaugeSite> = { 'NWS:OLD': site('NWS:OLD', 36.0, -82.0) };

        await refreshNwsListing(envWithRivers([['NWS:CO1']]), registry);
        expect(Object.keys(registry).sort((a, b) => a.localeCompare(b))).toEqual(['NWS:CO1', 'NWS:OLD']);
    });
});

describe('compileGaugeRegistry', () => {
    it('lists NWS before FIMAN so FIMAN drops what NWS has, and adds linked gauges from both', async () => {
        vi.spyOn(nwsProvider, 'getFullSiteListing' as any).mockResolvedValue([site('LIST1', 36.0, -82.0)]);
        vi.spyOn(fimanProvider, 'getFullSiteListing' as any).mockResolvedValue([
            site('twin', 36.001, -82.0), site('own', 37.0, -82.0),
        ]);
        vi.spyOn(nwsProvider, 'getSiteListing').mockImplementation(async ids => ids.map(id => ({ ...site(id, 36.0 + (id === 'LINK1' ? 2 : 0), -82.0), usgsId: null })));
        const fimanSites = vi.spyOn(fimanProvider, 'getSiteListing').mockResolvedValue([site('linked', 35.5, -83.0)]);

        const registry = await compileGaugeRegistry(
            envWithRivers([['FIMAN:linked', 'NWS:LINK1'], ['fiman:linked']]),
            { 'NWS:STALE': site('NWS:STALE', 1, 1) }
        );

        expect(fimanSites).toHaveBeenCalledWith(['linked']);
        expect(Object.keys(registry).sort((a, b) => a.localeCompare(b)))
            .toEqual(['FIMAN:linked', 'FIMAN:own', 'NWS:LINK1', 'NWS:LIST1']);
    });
});
