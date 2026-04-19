import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiFlow from '../index';
import { sendEmail } from '../email';

import * as registry from '../services/gaugeRegistry';
import { usgsProvider } from '../services/usgs';

// Mock the email dispatcher so we don't actually try to send SMTP emails
vi.mock('../email', () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('../services/gaugeRegistry', () => ({
    compileGaugeRegistry: vi.fn().mockResolvedValue({})
}));

vi.mock('../services/usgs', () => ({
    usgsProvider: {
        getHistory: vi.fn(),
        getLatest: vi.fn().mockResolvedValue({}),
        getFullSiteListing: vi.fn()
    }
}));

function createMockCloudflareEnv(dbRows: any[], siteData: Record<string, any>) {
    // Tell the loop to process these gauges by returning them in the registry
    vi.mocked(registry.compileGaugeRegistry).mockResolvedValue(siteData as any);
    
    // We mock USGS getHistory to directly return our siteData
    vi.spyOn(usgsProvider, 'getHistory').mockImplementation(async (ids) => {
        const result: any = {};
        for (const id of ids) {
            const fullId = `USGS:${id}`;
            if (siteData[fullId]) {
                result[id] = siteData[fullId];
            }
        }
        return result;
    });

    vi.spyOn(usgsProvider, 'getLatest').mockImplementation(async (ids) => {
        const result: any = {};
        for (const id of ids) {
            const fullId = `USGS:${id}`;
            if (siteData[fullId]) {
                result[id] = siteData[fullId].readings?.[0] || null;
            }
        }
        return result;
    });

    return {
        DB: {
            prepare: vi.fn().mockImplementation((query: string) => ({
                bind: vi.fn().mockReturnValue({
                    all: vi.fn().mockResolvedValue({ 
                        results: query.includes("notifications_none_until") ? dbRows : [] 
                    })
                }),
                all: vi.fn().mockResolvedValue({ 
                    results: [] 
                })
            })),
            batch: vi.fn()
        },
        FLOW_STORAGE: {
            get: vi.fn().mockImplementation((key: string) => {
                if (key === "gauge_registry.json") {
                    return Promise.resolve({
                        json: vi.fn().mockResolvedValue(siteData)
                    });
                }
                return Promise.resolve(null);
            }),
            put: vi.fn()
        }
    };
}

describe('Daily Digest Notification Engine', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockCtx = {
        waitUntil: vi.fn((promise) => promise)
    };

    const dummyEvent = { cron: "*/15 * * * *", type: "scheduled", scheduledTime: Date.now() };

    it('Test A: All Rivers are Too Low - No Email', async () => {
        const mockEnv = createMockCloudflareEnv([
            {
                user_id: 'user_A',
                email: 'test@example.com',
                notifications_time_of_day: '10:00',
                river_id: 'river_1',
                name: 'Low River',
                section: null,
                flow_min: 500,
                flow_max: 1000,
                gauges: JSON.stringify([{ id: 'USGS:1' }]),
                custom_min: null,
                custom_max: null
            }
        ], {
            "USGS:1": {
                id: "USGS:1", name: "Test Gauge", lat: 0, lon: 0,
                readings: [{ value: 100, timestamp: Date.now() }] // Way below 500
            }
        });

        await apiFlow.scheduled(dummyEvent as any, mockEnv as any, mockCtx as any);

        // Verify No Email sent
        expect(sendEmail).not.toHaveBeenCalled();

        // Verify DB update batched the notification target pushes
        expect(mockEnv.DB.batch).toHaveBeenCalled();
        const batchCalls = mockEnv.DB.batch.mock.calls;
        expect(batchCalls.length).toBeGreaterThan(0);
        
        const prepareCalls = mockEnv.DB.prepare.mock.calls.map(c => c[0]);
        const updateQuery = prepareCalls.find(q => q.includes("UPDATE users SET notifications_none_until"));
        expect(updateQuery).toBeDefined();
    });

    it('Test B: Rivers are Running - Email dispatched', async () => {
        const mockEnv = createMockCloudflareEnv([
            {
                user_id: 'user_B',
                email: 'runner@example.com',
                notifications_time_of_day: '10:00',
                river_id: 'river_2',
                name: 'Running River',
                section: null,
                flow_min: 500,
                flow_max: 1000,
                gauges: JSON.stringify([{ id: 'USGS:2' }]),
                custom_min: null,
                custom_max: null
            }
        ], {
            "USGS:2": {
                id: "USGS:2", name: "Test Gauge", lat: 0, lon: 0,
                readings: [{ value: 750, timestamp: Date.now() }] // Perfect
            }
        });

        await apiFlow.scheduled(dummyEvent as any, mockEnv as any, mockCtx as any);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const emailArgs = vi.mocked(sendEmail).mock.calls[0][0];
        expect(emailArgs.to).toBe('runner@example.com');
        expect(emailArgs.html).toContain('Running River');
        expect(emailArgs.html).toContain('Rivers that are Running');
    });

    it('Test C: Customized Alert Thresholds', async () => {
        const mockEnv = createMockCloudflareEnv([
            {
                user_id: 'user_C',
                email: 'custom@example.com',
                notifications_time_of_day: '10:00',
                river_id: 'river_3',
                name: 'Custom River',
                section: null,
                flow_min: 500, // Normally too high if > 1000
                flow_max: 1000,
                gauges: JSON.stringify([{ id: 'USGS:3' }]),
                custom_min: 1500, // User ONLY wants emails when it is massively flooded
                custom_max: 2000
            }
        ], {
            "USGS:3": {
                id: "USGS:3", name: "Test Gauge", lat: 0, lon: 0,
                readings: [{ value: 1600, timestamp: Date.now() }] // Running according to custom limits!
            }
        });

        await apiFlow.scheduled(dummyEvent as any, mockEnv as any, mockCtx as any);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const emailArgs = vi.mocked(sendEmail).mock.calls[0][0];
        expect(emailArgs.html).toContain('Rivers that are Running');
    });
});
