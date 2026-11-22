import type { Context, Next } from "hono";
import { hashKey } from "./utils/apiKey";

/**
 * True if an Origin/Referer header points at localhost or a private LAN address
 * (RFC 1918). These can never be commercial third-party sites, and the header is
 * trivially forgeable anyway, so we let them bypass API-key auth for local dev.
 */
function isLocalOrPrivateOrigin(value: string | undefined): boolean {
    if (!value) return false;
    let host: string;
    try {
        host = new URL(value).hostname;
    } catch {
        return false;
    }
    if (host === "localhost") return true;

    const octets = host.split(".").map(Number);
    if (octets.length !== 4 || octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) {
        return false;
    }
    const [a, b] = octets;
    return a === 127 ||                         // 127.0.0.0/8  loopback
           a === 10 ||                          // 10.0.0.0/8   private
           (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
           (a === 192 && b === 168);            // 192.168.0.0/16 private
}

// Google's public JWKs, cached for 6 hours. An unknown kid triggers at most one
// refetch per minute, so a rotated key is picked up without letting junk tokens
// drive a fetch per request.
let cachedKeys: any[] | null = null;
let cachedKeyTime = 0;
const KEY_CACHE_MS = 1000 * 60 * 60 * 6;
const KEY_REFETCH_MIN_MS = 1000 * 60;

async function fetchGooglePublicKeys(): Promise<any[]> {
    const res = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    const data = await res.json() as { keys?: any[] };
    if (!Array.isArray(data?.keys)) throw new Error("Google JWK response had no keys");
    cachedKeys = data.keys;
    cachedKeyTime = Date.now();
    return cachedKeys;
}

async function findGooglePublicKey(kid: string): Promise<any | undefined> {
    const age = Date.now() - cachedKeyTime;
    if (!cachedKeys || age > KEY_CACHE_MS) {
        try {
            await fetchGooglePublicKeys();
        } catch (e) {
            // Keep serving the stale set rather than failing every request.
            if (!cachedKeys) throw e;
        }
    }
    let key = cachedKeys!.find((k: any) => k.kid === kid);
    if (!key && Date.now() - cachedKeyTime > KEY_REFETCH_MIN_MS) {
        key = (await fetchGooglePublicKeys()).find((k: any) => k.kid === kid);
    }
    return key;
}

/** Test hook: forget cached keys. */
export function resetGooglePublicKeyCache() {
    cachedKeys = null;
    cachedKeyTime = 0;
}

function decodeJwtHeader(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const headerRaw = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    try {
        const decoded = atob(headerRaw);
        return JSON.parse(decoded);
    } catch { return null; }
}

function decodeJwtPayload(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    try {
        const decoded = atob(raw);
        return JSON.parse(decoded);
    } catch { return null; }
}

// Convert base64url to generic Uint8Array cleanly
function b64ToUrlSafe(b64: string) {
    const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
    return arr;
}

async function importJwk(keyData: any) {
    return await crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
    );
}

const FIREBASE_PROJECT = "rivers-run";
const CLOCK_SKEW_S = 60;

/** Claim checks for a Firebase ID token payload; returns a reason when it fails. */
export function checkFirebaseClaims(payload: any, nowS: number = Date.now() / 1000): string | null {
    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") return "Token missing exp or iat.";
    if (nowS > payload.exp + CLOCK_SKEW_S) return "Token expired.";
    if (payload.iat > nowS + CLOCK_SKEW_S) return "Token issued in the future.";
    if (payload.aud !== FIREBASE_PROJECT || payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT}`) {
        return "Invalid token issuer mapping.";
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) return "Token has no subject.";
    return null;
}

type VerifyResult = { ok: true; payload: any } | { ok: false; error: string };

/** Verifies a Firebase ID token's header, claims and RS256 signature. Throws only on key fetch failure. */
async function verifyFirebaseToken(token: string): Promise<VerifyResult> {
    const header = decodeJwtHeader(token);
    const payload = decodeJwtPayload(token);
    if (!header || !payload || typeof header.kid !== "string" || header.alg !== "RS256") {
        return { ok: false, error: "Malformed ID Token." };
    }
    const claimError = checkFirebaseClaims(payload);
    if (claimError) return { ok: false, error: claimError };

    const keyData = await findGooglePublicKey(header.kid);
    if (!keyData) return { ok: false, error: "Signature key not resolved." };

    const cryptoKey = await importJwk(keyData);
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const isValid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        b64ToUrlSafe(signaturePart),
        new TextEncoder().encode(`${headerPart}.${payloadPart}`)
    );
    return isValid ? { ok: true, payload } : { ok: false, error: "Invalid signature verification." };
}

async function userFromPayload(c: Context, payload: any) {
    const uid = payload.sub;
    const dbUser: any = await (c.env as any).DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(uid).first();
    return { ...payload, user_id: uid, d1Role: (dbUser && dbUser.role) ? dbUser.role : "user" };
}

// Main Verification Middleware wrapper
export const firebaseAuthMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return c.json({ error: "Unauthorized. Include Firebase ID Token." }, 401);
    }

    try {
         const result = await verifyFirebaseToken(authHeader.slice("Bearer ".length));
         if (!result.ok) return c.json({ error: result.error }, 401);
         c.set("user", await userFromPayload(c, result.payload));
    } catch (e: unknown) {
         console.error("Auth middleware internal crash:", e);
         return c.json({ error: "Auth execution failure." }, 500);
    }
    return await next();
};

// Simple explicit gatekeepers using D1 role states
export const requireAdmin = async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user || (user.d1Role !== 'admin' && user.d1Role !== 'super-admin')) {
         return c.json({ error: "Admin role required." }, 403);
    }
    return await next();
};

export const requireModerator = async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user || (user.d1Role !== 'moderator' && user.d1Role !== 'admin' && user.d1Role !== 'super-admin')) {
         return c.json({ error: "Moderator role required." }, 403);
    }
    return await next();
};

export const requireNotBanned = async (c: Context, next: Next) => {
    const user = c.get("user");
    if (user && user.d1Role === 'banned') {
         return c.json({ error: "Your account has been restricted." }, 403);
    }
    return await next();
};

// Falls back to anonymous user instead of failing on missing/bad token
export const optionalFirebaseAuthMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    const fallbackUser = { user_id: "anonymous", d1Role: "anonymous" };

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
         c.set("user", fallbackUser);
         return await next();
    }

    try {
         const result = await verifyFirebaseToken(authHeader.slice("Bearer ".length));
         c.set("user", result.ok ? await userFromPayload(c, result.payload) : fallbackUser);
    } catch (e: unknown) {
         console.warn("Optional auth middleware internal crash fallback:", e);
         c.set("user", fallbackUser);
    }
    return await next();
};

/**
 * Higher-order middleware factory to generate key authenticators
 */
export const createApiKeyMiddleware = (endpointType: "metadata" | "gauge-flow") => {
    return async (c: Context, next: Next) => {
        // 1. Allow official webapp bypass (Origin & Referer check)
        const origin = c.req.header("Origin");
        const referer = c.req.header("Referer");
        const isOfficialOrigin = origin === "https://rivers.run" ||
                                 (origin && (origin.endsWith(".rivers.run") || origin.startsWith("capacitor://")));
        const isOfficialReferer = referer === "https://rivers.run/" ||
                                  (referer && (referer.includes(".rivers.run/") || referer.startsWith("capacitor://")));

        const isLocalDev = isLocalOrPrivateOrigin(origin) || isLocalOrPrivateOrigin(referer);

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
                    const now = Math.floor(Date.now() / 1000);
                    await c.env.DB.batch([
                        c.env.DB.prepare(`
                            INSERT INTO api_usage (key_hash, date, endpoint_type, request_count)
                            VALUES (?, ?, ?, 1)
                            ON CONFLICT(key_hash, date, endpoint_type)
                            DO UPDATE SET request_count = request_count + 1
                        `).bind(hashed, today, endpointType),
                        c.env.DB.prepare(`
                            UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?
                        `).bind(now, hashed)
                    ]);
                })());
            } else {
                // Testing environments without executionCtx fallback
                const now = Math.floor(Date.now() / 1000);
                await c.env.DB.batch([
                    c.env.DB.prepare(`
                        INSERT INTO api_usage (key_hash, date, endpoint_type, request_count)
                        VALUES (?, ?, ?, 1)
                        ON CONFLICT(key_hash, date, endpoint_type)
                        DO UPDATE SET request_count = request_count + 1
                    `).bind(hashed, today, endpointType),
                    c.env.DB.prepare(`
                        UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?
                    `).bind(now, hashed)
                ]);
            }

            c.set("apiKey", keyRecord);
            return await next();
        } catch (e: unknown) {
            console.error("API Key middleware internal crash:", e);
            return c.json({ error: "API Key check failed.", details: String(e) }, 500);
        }
    };
};

export const apiKeyMetadataMiddleware = createApiKeyMiddleware("metadata");
export const apiKeyFlowMiddleware = createApiKeyMiddleware("gauge-flow");

