import { toHex } from "./hex";

const HEX_SIG_RE = /^[0-9a-f]{64}$/i;

function payloadFor(userId: string, iat: number): Uint8Array {
    return new TextEncoder().encode(`unsubscribe:${userId}:${iat}`);
}

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// Importing an HMAC key is the expensive part of signing/verifying (the actual sign/verify
// call is cheap once keyed). The digest cron can sign a token per recipient in a single run,
// so cache the derived key per secret instead of re-importing it on every call.
const keyCache = new Map<string, Promise<CryptoKey>>();

function importHmacKey(secret: string): Promise<CryptoKey> {
    let cached = keyCache.get(secret);
    if (!cached) {
        cached = crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"]
        );
        keyCache.set(secret, cached);
    }
    return cached;
}

/**
 * Signs `unsubscribe:{userId}:{iat}` with HMAC-SHA256. The "unsubscribe:" purpose
 * prefix keeps tokens from this secret from being replayable against any future
 * signed-link feature that might reuse UNSUBSCRIBE_SECRET with a different prefix.
 * Tokens intentionally never expire (iat is carried for logging only, not enforced) -
 * an old digest email should still be able to unsubscribe its recipient.
 */
export async function signUnsubscribeToken(secret: string, userId: string, iat: number): Promise<string> {
    const key = await importHmacKey(secret);
    const sig = await crypto.subtle.sign("HMAC", key, payloadFor(userId, iat));
    return toHex(sig);
}

export async function verifyUnsubscribeToken(secret: string, userId: string, iat: number, sig: string): Promise<boolean> {
    if (!userId || !Number.isInteger(iat) || !HEX_SIG_RE.test(sig)) return false;
    const key = await importHmacKey(secret);
    return crypto.subtle.verify("HMAC", key, fromHex(sig), payloadFor(userId, iat));
}

export function buildUnsubscribeUrl(baseUrl: string, userId: string, iat: number, sig: string): string {
    const url = new URL("/unsubscribe", baseUrl);
    url.searchParams.set("uid", userId);
    url.searchParams.set("iat", String(iat));
    url.searchParams.set("sig", sig);
    return url.toString();
}
