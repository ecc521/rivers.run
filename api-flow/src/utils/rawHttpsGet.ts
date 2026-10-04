import { connect } from 'cloudflare:sockets';

const MAX_BODY_BYTES = 8 * 1024 * 1024;

function concat(chunks: Uint8Array[], total: number): Uint8Array {
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
}

function indexOfCrlfCrlf(buf: Uint8Array): number {
    for (let i = 0; i + 3 < buf.length; i++) {
        if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
    }
    return -1;
}

function decodeChunked(body: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];
    let total = 0;
    let pos = 0;
    const decoder = new TextDecoder();
    while (pos < body.length) {
        let eol = pos;
        while (eol + 1 < body.length && !(body[eol] === 13 && body[eol + 1] === 10)) eol++;
        const size = parseInt(decoder.decode(body.subarray(pos, eol)).split(';')[0].trim(), 16);
        if (!Number.isFinite(size)) throw new Error('Malformed chunked response');
        if (size === 0) break;
        const start = eol + 2;
        parts.push(body.subarray(start, start + size));
        total += size;
        pos = start + size + 2;
    }
    return concat(parts, total);
}

/**
 * GET over a raw TLS socket, returning a Response. Unlike fetch(), the edge adds
 * no headers of its own (notably `X-Forwarded-Proto`), so only `headers` is sent.
 * Uses `Connection: close` and identity encoding to keep response framing simple.
 */
export async function rawHttpsGet(
    hostname: string,
    path: string,
    headers: Record<string, string> = {},
    timeoutMs = 60000
): Promise<Response> {
    const socket = connect({ hostname, port: 443 }, { secureTransport: 'on', allowHalfOpen: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Raw GET timed out after ${timeoutMs}ms: https://${hostname}${path}`)), timeoutMs);
    });

    const run = async (): Promise<Response> => {
        const lines = [`GET ${path} HTTP/1.1`, `Host: ${hostname}`, 'Accept-Encoding: identity', 'Connection: close'];
        for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
        const writer = socket.writable.getWriter();
        await writer.write(new TextEncoder().encode(lines.join('\r\n') + '\r\n\r\n'));
        writer.releaseLock();

        const reader = socket.readable.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.length;
            if (total > MAX_BODY_BYTES) throw new Error(`Raw GET response exceeds ${MAX_BODY_BYTES} bytes`);
        }

        const raw = concat(chunks, total);
        const headEnd = indexOfCrlfCrlf(raw);
        if (headEnd < 0) throw new Error('Raw GET: incomplete response headers');
        const [statusLine, ...headerLines] = new TextDecoder().decode(raw.subarray(0, headEnd)).split('\r\n');
        const status = parseInt(statusLine.split(' ')[1], 10);
        if (!Number.isFinite(status)) throw new Error(`Raw GET: bad status line "${statusLine}"`);

        const resHeaders = new Headers();
        for (const line of headerLines) {
            const i = line.indexOf(':');
            if (i > 0) resHeaders.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
        }

        let body = raw.subarray(headEnd + 4);
        if (/chunked/i.test(resHeaders.get('transfer-encoding') ?? '')) body = decodeChunked(body);
        resHeaders.delete('transfer-encoding');
        resHeaders.delete('content-length');
        return new Response(status === 204 || status === 304 ? null : body, { status, headers: resHeaders });
    };

    try {
        return await Promise.race([run(), timeout]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
        try { await socket.close(); } catch { /* already closed */ }
    }
}
