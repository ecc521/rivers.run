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

// Caches Google's public JWKs efficiently
let cachedKeys: any = null;
let cachedKeyTime = 0;

async function getGooglePublicKeys() {
    if (cachedKeys && Date.now() - cachedKeyTime < 1000 * 60 * 60 * 6) { // Cache for 6 hours natively
         return cachedKeys;
    }
    const res = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    const data = await res.json() as { keys: any[] };
    cachedKeys = data.keys;
    cachedKeyTime = Date.now();
    return cachedKeys;
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

// Main Verification Middleware wrapper
export const firebaseAuthMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return c.json({ error: "Unauthorized. Include Firebase ID Token." }, 401);
    }
    
    const token = authHeader.split("Bearer ")[1];
    const header = decodeJwtHeader(token);
    const payload = decodeJwtPayload(token);
    
    if (!header || !payload || !header.kid) {
         return c.json({ error: "Malformed ID Token." }, 401);
    }
    
    // Check expiration natively
    if (Date.now() / 1000 > payload.exp) {
         return c.json({ error: "Token expired." }, 401);
    }

    // Explicit projectId check enforcing bounds
    if (payload.aud !== "rivers-run" || payload.iss !== "https://securetoken.google.com/rivers-run") {
         return c.json({ error: "Invalid token issuer mapping." }, 401);
    }

    try {
         const keys = await getGooglePublicKeys();
         const keyData = keys.find((k: any) => k.kid === header.kid);
         if (!keyData) return c.json({ error: "Signature key not resolved." }, 401);

         const cryptoKey = await importJwk(keyData);
         
         const tokenParts = token.split('.');
         const signatureStr = tokenParts[2];
         const dataStr = tokenParts[0] + "." + tokenParts[1];
         
         const signature = b64ToUrlSafe(signatureStr);
         const data = new TextEncoder().encode(dataStr);
         
         const isValid = await crypto.subtle.verify(
             "RSASSA-PKCS1-v1_5",
             cryptoKey,
             signature,
             data
         );

         if (!isValid) return c.json({ error: "Invalid signature verification." }, 401);

         // Passed! Attach to request context
         // Dynamically drop Firebase Custom Claims and poll pure D1 SQL Live State
         const uid = payload.sub || payload.user_id;
         const dbUser: any = await (c.env as any).DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(uid).first();
         
         c.set("user", {
              ...payload, 
              user_id: uid,
              d1Role: (dbUser && dbUser.role) ? dbUser.role : "user"
         });
         
         return await next();
         
    } catch (e: unknown) {
         console.error("Auth middleware internal crash:", e);
         return c.json({ error: "Auth execution failure.", details: String(e) }, 500);
    }
};

// Simple explicit gatekeepers executing natively using D1 role states
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
    
    // Default fallback
    const fallbackUser = { user_id: "anonymous", d1Role: "anonymous" };

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
         c.set("user", fallbackUser);
         return await next();
    }
    
    const token = authHeader.split("Bearer ")[1];
    
    const header = decodeJwtHeader(token);
    const payload = decodeJwtPayload(token);
    
    if (!header || !payload || !header.kid) {
         c.set("user", fallbackUser);
         return await next();
    }
    
    if (Date.now() / 1000 > payload.exp) {
         c.set("user", fallbackUser);
         return await next();
    }

    if (payload.aud !== "rivers-run" || payload.iss !== "https://securetoken.google.com/rivers-run") {
         c.set("user", fallbackUser);
         return await next();
    }

    try {
         const keys = await getGooglePublicKeys();
         const keyData = keys.find((k: any) => k.kid === header.kid);
         if (!keyData) {
              c.set("user", fallbackUser);
              return await next();
         }

         const cryptoKey = await importJwk(keyData);
         const tokenParts = token.split('.');
         const signatureStr = tokenParts[2];
         const dataStr = tokenParts[0] + "." + tokenParts[1];
         
         const signature = b64ToUrlSafe(signatureStr);
         const data = new TextEncoder().encode(dataStr);
         
         const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);

         if (!isValid) {
              c.set("user", fallbackUser);
              return await next();
         }

         const uid = payload.sub || payload.user_id;
         const dbUser: any = await (c.env as any).DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(uid).first();
         
         c.set("user", {
              ...payload, 
              user_id: uid,
              d1Role: (dbUser && dbUser.role) ? dbUser.role : "user"
         });
         
         return await next();
         
    } catch (e: unknown) {
         console.warn("Optional auth middleware internal crash fallback:", e);
         c.set("user", fallbackUser);
         return await next();
    }
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

