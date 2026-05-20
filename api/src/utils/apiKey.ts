/**
 * Generates a cryptographically secure random API key prefixed with 'rr_live_'.
 * Length of random portion: 48 hex characters (24 bytes).
 */
export function generateRawKey(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    return `rr_live_${hex}`;
}

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
