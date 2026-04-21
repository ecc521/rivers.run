import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiFlow from '../index';

vi.mock('../services/gaugeRegistry', () => ({
    compileGaugeRegistry: vi.fn().mockResolvedValue({})
}));

// Mock providers to avoid actual network calls during full sync tests
vi.mock('../services/usgs', () => ({ usgsProvider: { getHistory: vi.fn(), getLatest: vi.fn(), getFullSiteListing: vi.fn() } }));
vi.mock('../services/nws', () => ({ nwsProvider: { getLatest: vi.fn() } }));
vi.mock('../services/canada', () => ({ canadaProvider: { getHistory: vi.fn(), getLatest: vi.fn(), getFullSiteListing: vi.fn() } }));
vi.mock('../services/uk', () => ({ ukProvider: { getLatest: vi.fn(), getFullSiteListing: vi.fn() } }));
vi.mock('../services/ireland', () => ({ irelandProvider: { getLatest: vi.fn(), getFullSiteListing: vi.fn() } }));
vi.mock('../services/france', () => ({ franceProvider: { getLatest: vi.fn(), getFullSiteListing: vi.fn() } }));

describe('Sitemap Generation Engine', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockCtx = {
        waitUntil: vi.fn((promise) => promise)
    };

    function createMockEnv(dbRivers: any[], dbLists: any[], registryData: Record<string, any>) {
        let capturedXml = '';
        return {
            getCapturedXml: () => capturedXml,
            DB: {
                prepare: vi.fn().mockImplementation((_query: string) => ({
                    bind: vi.fn().mockReturnThis(),
                    all: vi.fn().mockResolvedValue({ results: [] }),
                    run: vi.fn().mockResolvedValue({ success: true })
                })),
                batch: vi.fn().mockImplementation(async (_prepares: any[]) => {
                    return [
                        { results: dbRivers },
                        { results: dbLists }
                    ];
                })
            },
            FLOW_STORAGE: {
                get: vi.fn().mockImplementation((key: string) => {
                    if (key === "gauge_registry.json") {
                        return Promise.resolve({
                            json: vi.fn().mockResolvedValue(registryData)
                        });
                    }
                    return Promise.resolve(null);
                }),
                put: vi.fn().mockImplementation(async (_key: string, value: any) => {
                    if (value && typeof value.getReader === 'function') {
                        const reader = value.getReader();
                        const decoder = new TextEncoder().encoding === 'utf-8' ? new TextDecoder() : new TextDecoder();
                        while (true) {
                            const { done, value: chunk } = await reader.read();
                            if (done) break;
                            capturedXml += decoder.decode(chunk, { stream: true });
                        }
                    }
                    return { success: true };
                })
            }
        };
    }

    it('should generate a sitemap on daily cron and include all entities', async () => {
        const dbRivers = [
            { id: 'river1', name: 'Youghiogheny', section: 'Lower', isGauge: 0 },
            { id: 'gauge-river', name: 'Ohiopyle Gauge', section: '', isGauge: 1 }
        ];
        const dbLists = [
            { id: 'list1', title: 'My Favorites Bucket' }
        ];
        const registryData = {
            'USGS:03081500': { id: 'USGS:03081500', name: 'Yough River at Ohiopyle' },
            'UK:1234': { id: 'UK:1234', name: 'Thames at London' }
        };

        const mockEnv = createMockEnv(dbRivers, dbLists, registryData);
        const dailyEvent = { cron: "0 0 * * *", type: "scheduled", scheduledTime: Date.now() };

        await apiFlow.scheduled(dailyEvent as any, mockEnv as any, mockCtx as any);

        // Verify R2 put was called for sitemap
        const sitemapCall = mockEnv.FLOW_STORAGE.put.mock.calls.find(call => call[0] === "sitemap.xml");
        expect(sitemapCall).toBeDefined();

        const xml = mockEnv.getCapturedXml();
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        // Verify Curated Rivers (0.7)
        expect(xml).toContain('<loc>https://rivers.run/river/river1/youghiogheny-lower</loc>');
        expect(xml).toContain('<priority>0.7</priority>');
        expect(xml).toContain('<loc>https://rivers.run/gauge/gauge-river/ohiopyle-gauge</loc>');

        // Verify Standalone Gauges (0.4)
        expect(xml).toContain('<loc>https://rivers.run/gauge/USGS:03081500/yough-river-at-ohiopyle</loc>');
        expect(xml).toContain('<loc>https://rivers.run/gauge/UK:1234/thames-at-london</loc>');
        expect(xml).toContain('<priority>0.4</priority>');

        // Verify Playlists (0.5)
        expect(xml).toContain('<loc>https://rivers.run/lists/list1/my-favorites-bucket</loc>');
        expect(xml).toContain('<priority>0.5</priority>');

        // Verify Static Routes (1.0)
        expect(xml).toContain('<loc>https://rivers.run</loc>');
        expect(xml).toContain('<priority>1.0</priority>');
    });

    it('should NOT generate sitemap on 15-minute sync', async () => {
        const mockEnv = createMockEnv([], [], {});
        const syncEvent = { cron: "*/15 * * * *", type: "scheduled", scheduledTime: Date.now() };

        await apiFlow.scheduled(syncEvent as any, mockEnv as any, mockCtx as any);

        expect(mockEnv.FLOW_STORAGE.put).not.toHaveBeenCalledWith("sitemap.xml", expect.anything(), expect.any(Object));
    });

    it('should generate sitemap on monthly recompile', async () => {
        const mockEnv = createMockEnv([], [], {});
        const monthlyEvent = { cron: "0 0 1 * *", type: "scheduled", scheduledTime: Date.now() };

        await apiFlow.scheduled(monthlyEvent as any, mockEnv as any, mockCtx as any);

        expect(mockEnv.FLOW_STORAGE.put).toHaveBeenCalledWith("sitemap.xml", expect.anything(), expect.any(Object));
    });
});
