import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connect } from 'cloudflare:sockets';
import { rawHttpsGet } from '../rawHttpsGet';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const enc = new TextEncoder();

function fakeSocket(response: string | Uint8Array[], written: string[] = []) {
    const parts = typeof response === 'string' ? [enc.encode(response)] : response;
    const socket = {
        writable: new WritableStream<Uint8Array>({ write(c) { written.push(new TextDecoder().decode(c)); } }),
        readable: new ReadableStream<Uint8Array>({
            start(controller) { parts.forEach(p => controller.enqueue(p)); controller.close(); },
        }),
        close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(connect).mockReturnValue(socket as never);
    return socket;
}

describe('rawHttpsGet', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sends only the given headers, with no X-Forwarded-Proto', async () => {
        const written: string[] = [];
        fakeSocket('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}', written);
        await rawHttpsGet('waterlevel.ie', '/geojson/latest/', { 'User-Agent': 'Test', Accept: 'application/json' });

        expect(connect).toHaveBeenCalledWith({ hostname: 'waterlevel.ie', port: 443 }, expect.objectContaining({ secureTransport: 'on' }));
        const req = written.join('');
        expect(req.startsWith('GET /geojson/latest/ HTTP/1.1\r\nHost: waterlevel.ie\r\n')).toBe(true);
        expect(req).toContain('User-Agent: Test');
        expect(req).toContain('Connection: close');
        expect(req.toLowerCase()).not.toContain('x-forwarded');
        expect(req.endsWith('\r\n\r\n')).toBe(true);
    });

    it('returns status, headers and body split across reads', async () => {
        const body = JSON.stringify({ features: [1, 2, 3] });
        const raw = enc.encode(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nServer: nginx\r\n\r\n${body}`);
        fakeSocket([raw.subarray(0, 20), raw.subarray(20, 60), raw.subarray(60)]);
        const res = await rawHttpsGet('waterlevel.ie', '/x');

        expect(res.status).toBe(200);
        expect(res.ok).toBe(true);
        expect(res.headers.get('content-type')).toBe('application/json');
        expect(await res.json()).toEqual({ features: [1, 2, 3] });
    });

    it('decodes chunked bodies', async () => {
        fakeSocket('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n');
        const res = await rawHttpsGet('waterlevel.ie', '/x');
        expect(await res.text()).toBe('hello world');
    });

    it('surfaces non-200 statuses and bodies', async () => {
        fakeSocket('HTTP/1.1 400 Bad Request\r\n\r\nContradictory scheme headers');
        const res = await rawHttpsGet('waterlevel.ie', '/x');
        expect(res.ok).toBe(false);
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('Contradictory scheme headers');
    });

    it('rejects a response with no header terminator', async () => {
        fakeSocket('HTTP/1.1 200 OK\r\nContent-Le');
        await expect(rawHttpsGet('waterlevel.ie', '/x')).rejects.toThrow('incomplete response headers');
    });

    it('times out and closes the socket', async () => {
        const socket = {
            writable: new WritableStream<Uint8Array>(),
            readable: new ReadableStream<Uint8Array>({ start() { /* never ends */ } }),
            close: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(connect).mockReturnValue(socket as never);
        await expect(rawHttpsGet('waterlevel.ie', '/x', {}, 20)).rejects.toThrow('timed out');
        expect(socket.close).toHaveBeenCalled();
    });
});
