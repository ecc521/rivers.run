import { describe, it, expect } from 'vitest';
import app from '../index';

const mockCtx = { waitUntil: (p: Promise<any>) => p } as any;

// Regression test for the class of bug fixed in api-flow (see api-flow/src/__tests__/cors.test.ts):
// an ETag set on the wire is still hidden from cross-origin JS — and from
// workbox-broadcast-update's own cache comparison — unless it's explicitly listed in
// Access-Control-Expose-Headers. This worker doesn't wire up broadcastUpdate on any of
// its cached routes today, but if it ever does, this locks in the header exposure it
// would silently need.
describe('api.rivers.run CORS header exposure', () => {
    it('exposes ETag and Content-Length for cross-origin JS', async () => {
        const req = new Request('https://api.rivers.run/robots.txt', {
            headers: { Origin: 'https://rivers.run' }
        });
        const res = await app.fetch(req, {} as any, mockCtx);

        const exposed = (res.headers.get('access-control-expose-headers') || '')
            .split(',')
            .map(h => h.trim().toLowerCase());
        expect(exposed).toContain('etag');
        expect(exposed).toContain('content-length');
    });
});
