import { fetchWithTimeout, DEFAULT_HEADERS } from './timeout';

/**
 * Upstream JSON shared through the Cloudflare cache, per location. A clean copy is
 * stored explicitly because some upstreams set cookies that stop Cloudflare caching
 * the subrequest itself. Callers should keep URLs stable (e.g. rounded time windows)
 * so concurrent requests hit the same key. The body is held as text and as a parsed
 * object, so large responses cost twice; see "Memory budget" in api-flow/AGENTS.md.
 */
export async function edgeCachedJson(
    url: string,
    opts: { timeoutMs: number; ttlSeconds: number; label: string }
): Promise<any> {
    const cache: Cache | undefined = (globalThis as any).caches?.default;
    const hit = cache ? await cache.match(url) : undefined;
    if (hit) return hit.json();
    const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, opts.timeoutMs);
    if (!res.ok) throw new Error(`${opts.label} API error ${res.status} for ${url}`);
    const body = await res.text();
    if (cache) {
        await cache.put(url, new Response(body, {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${opts.ttlSeconds}` },
        }));
    }
    return JSON.parse(body);
}
