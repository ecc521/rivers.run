import { describe, it, expect } from 'vitest';
import { signUnsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl } from '../unsubscribeToken';

const SECRET = 'test-secret-value';

describe('signUnsubscribeToken / verifyUnsubscribeToken', () => {
    it('verifies a token signed with the same secret, user, and iat', async () => {
        const sig = await signUnsubscribeToken(SECRET, 'user_123', 1700000000);
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', 1700000000, sig)).resolves.toBe(true);
    });

    it('produces a 64-char hex signature (SHA-256)', async () => {
        const sig = await signUnsubscribeToken(SECRET, 'user_123', 1700000000);
        expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a token signed with a different secret', async () => {
        const sig = await signUnsubscribeToken('wrong-secret', 'user_123', 1700000000);
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', 1700000000, sig)).resolves.toBe(false);
    });

    it('rejects a token whose userId was tampered with', async () => {
        const sig = await signUnsubscribeToken(SECRET, 'user_123', 1700000000);
        await expect(verifyUnsubscribeToken(SECRET, 'user_456', 1700000000, sig)).resolves.toBe(false);
    });

    it('rejects a token whose iat was tampered with', async () => {
        const sig = await signUnsubscribeToken(SECRET, 'user_123', 1700000000);
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', 1700099999, sig)).resolves.toBe(false);
    });

    it('never expires: an old iat still verifies', async () => {
        const veryOldIat = 1000000000; // year 2001
        const sig = await signUnsubscribeToken(SECRET, 'user_123', veryOldIat);
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', veryOldIat, sig)).resolves.toBe(true);
    });

    it('rejects malformed signatures without throwing', async () => {
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', 1700000000, 'not-hex')).resolves.toBe(false);
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', 1700000000, '')).resolves.toBe(false);
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', 1700000000, 'ab')).resolves.toBe(false);
    });

    it('rejects a non-integer iat', async () => {
        await expect(verifyUnsubscribeToken(SECRET, 'user_123', NaN, 'a'.repeat(64))).resolves.toBe(false);
    });

    it('rejects a missing userId', async () => {
        await expect(verifyUnsubscribeToken(SECRET, '', 1700000000, 'a'.repeat(64))).resolves.toBe(false);
    });
});

describe('buildUnsubscribeUrl', () => {
    it('encodes uid, iat, and sig as query params', () => {
        const url = buildUnsubscribeUrl('https://flow.rivers.run', 'user 123', 1700000000, 'deadbeef');
        const parsed = new URL(url);
        expect(parsed.origin + parsed.pathname).toBe('https://flow.rivers.run/unsubscribe');
        expect(parsed.searchParams.get('uid')).toBe('user 123');
        expect(parsed.searchParams.get('iat')).toBe('1700000000');
        expect(parsed.searchParams.get('sig')).toBe('deadbeef');
    });
});
