import { describe, it, expect } from 'vitest';
import apiFlow from '../index';

const mockCtx = { waitUntil: (p: Promise<any>) => p } as any;

function createMockEnv() {
    return {
        FLOW_STORAGE: {
            get: async (_key: string, _opts?: any) => ({
                httpEtag: '"mock-etag-123"',
                body: '{"generatedAt":1700000000000}'
            })
        },
        DB: {}
    } as any;
}

// Regression test for the bug where /flowdata's ETag was set on the wire but hidden
// from JS by CORS: workbox-broadcast-update compares content-length/etag/last-modified
// between the old and new cached response to decide whether to notify open tabs that
// fresh flow data is available, and silently treats the response as "unchanged" (no
// notification, no console error) if none of those headers are exposed cross-origin.
describe('/flowdata CORS header exposure', () => {
    it('exposes ETag so cross-origin JS (and the SW cache comparison) can read it', async () => {
        const req = new Request('https://flow.rivers.run/flowdata', {
            headers: { Origin: 'https://rivers.run' }
        });
        const res = await apiFlow.fetch(req, createMockEnv(), mockCtx);

        expect(res.headers.get('etag')).toBeTruthy();

        const exposed = (res.headers.get('access-control-expose-headers') || '')
            .split(',')
            .map(h => h.trim().toLowerCase());
        expect(exposed).toContain('etag');
    });
});
