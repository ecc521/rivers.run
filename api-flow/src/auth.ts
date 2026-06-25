import type { Context, Next } from "hono";

/**
 * Computes the SHA-256 hash of a string, returning a hex-encoded string.
 */
export async function hashKey(rawKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Middleware to authenticate requests to the flow API via developer API keys.
 * Bypasses checks for official web app origins/referers.
 */
export const apiKeyFlowMiddleware = async (c: Context, next: Next) => {
    // 1. Allow official webapp bypass (Origin & Referer check)
    const origin = c.req.header("Origin");
    const referer = c.req.header("Referer");
    const isOfficialOrigin = origin === "https://rivers.run" || 
                             (origin && (origin.endsWith(".rivers.run") || origin.startsWith("capacitor://")));
    const isOfficialReferer = referer === "https://rivers.run/" || 
                              (referer && (referer.includes(".rivers.run/") || referer.startsWith("capacitor://")));
    const isLocalDev = (origin && /^https?:\/\/localhost(:\d+)?$/.test(origin)) || 
                       (referer && /^https?:\/\/localhost(:\d+)?(\/|$)/.test(referer));

    if (isOfficialOrigin || isOfficialReferer || isLocalDev) {
        return await next();
    }

    // 2. Extract key
    const apiKey = c.req.header("x-api-key") || c.req.header("X-API-Key");
    if (!apiKey) {
        return c.json({ error: "Unauthorized. Missing API key in 'x-api-key' header." }, 401);
    }

    try {
        // 3. Compute hash
        const hashed = await hashKey(apiKey);

        // 4. Retrieve key record from D1
        const keyRecord: any = await c.env.DB.prepare(`
            SELECT * FROM api_keys WHERE key_hash = ? AND status = 'active'
        `).bind(hashed).first();

        if (!keyRecord) {
            return c.json({ error: "Unauthorized. Invalid or inactive API key." }, 403);
        }

        // 5. Daily budget verification
        const today = new Date().toISOString().split("T")[0];
        const dailyTotal: any = await c.env.DB.prepare(`
            SELECT SUM(request_count) as total FROM api_usage WHERE key_hash = ? AND date = ?
        `).bind(hashed, today).first();

        const currentTotal = (dailyTotal && dailyTotal.total) ? dailyTotal.total : 0;
        if (currentTotal >= keyRecord.daily_limit) {
            return c.json({ error: "Rate limit exceeded. Daily budget exhausted." }, 429);
        }

        // 6. Asynchronous usage log update
        if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
            c.executionCtx.waitUntil((async () => {
                try {
                    const now = Math.floor(Date.now() / 1000);
                    await c.env.DB.batch([
                        c.env.DB.prepare(`
                            INSERT INTO api_usage (key_hash, date, endpoint_type, request_count)
                            VALUES (?, ?, ?, 1)
                            ON CONFLICT(key_hash, date, endpoint_type)
                            DO UPDATE SET request_count = request_count + 1
                        `).bind(hashed, today, "gauge-flow"),
                        c.env.DB.prepare(`
                            UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?
                        `).bind(now, hashed)
                    ]);
                } catch (e) {
                    console.error("API usage log failed:", e);
                }
            })());
        } else {
            const now = Math.floor(Date.now() / 1000);
            await c.env.DB.batch([
                c.env.DB.prepare(`
                    INSERT INTO api_usage (key_hash, date, endpoint_type, request_count)
                    VALUES (?, ?, ?, 1)
                    ON CONFLICT(key_hash, date, endpoint_type)
                    DO UPDATE SET request_count = request_count + 1
                `).bind(hashed, today, "gauge-flow"),
                c.env.DB.prepare(`
                    UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?
                `).bind(now, hashed)
            ]);
        }

        c.set("apiKey", keyRecord);
        return await next();
    } catch (e: unknown) {
        console.error("API Flow middleware internal crash:", e);
        return c.json({ error: "API Key check failed.", details: String(e) }, 500);
    }
};
