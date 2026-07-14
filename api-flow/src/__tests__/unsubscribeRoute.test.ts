import { describe, it, expect } from 'vitest';
import apiFlow from '../index';
import { signUnsubscribeToken } from '../utils/unsubscribeToken';

const SECRET = 'test-secret-value';
const mockCtx = { waitUntil: (p: Promise<any>) => p } as any;

function createMockEnv(users: Record<string, { email: string }>, secret: string | undefined = SECRET) {
    const updateCalls: string[] = [];
    const logMessages: string[] = [];
    return {
        env: {
            UNSUBSCRIBE_SECRET: secret,
            DB: {
                prepare: (query: string) => ({
                    bind: (...args: any[]) => ({
                        first: async () => {
                            if (query.includes('SELECT email FROM users')) {
                                const uid = args[0] as string;
                                return users[uid] ? { email: users[uid].email } : null;
                            }
                            return null;
                        },
                        run: async () => {
                            if (query.includes('UPDATE users SET notifications_enabled')) {
                                updateCalls.push(args[0] as string);
                            }
                            if (query.includes('INSERT INTO worker_logs')) {
                                logMessages.push(args[3] as string); // (timestamp, level, component, message, details)
                            }
                            return { success: true };
                        }
                    })
                })
            }
        },
        updateCalls,
        logMessages
    };
}

async function requestUnsubscribe(env: any, params: Record<string, string>, method: 'GET' | 'POST' = 'GET') {
    const url = `https://flow.rivers.run/unsubscribe?${new URLSearchParams(params).toString()}`;
    return apiFlow.fetch(new Request(url, { method }), env, mockCtx);
}

describe('GET /unsubscribe', () => {
    it('renders a confirm prompt for a valid link without touching the database', async () => {
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'GET');

        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain('Unsubscribe from rivers.run emails?');
        expect(body).toContain('<form method="POST"');
        expect(updateCalls).toEqual([]);
    });

    it('the rendered form posts back to the same signed URL', async () => {
        const { env } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'GET');
        const body = await res.text();

        expect(body).toContain(`action="https://flow.rivers.run/unsubscribe?uid=user_1&amp;iat=${iat}&amp;sig=${sig}"`);
    });

    it('rejects a tampered signature without touching the database', async () => {
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_2', iat: String(iat), sig }, 'GET');

        expect(res.status).toBe(400);
        const body = await res.text();
        expect(body).toContain("This link isn't valid");
        expect(updateCalls).toEqual([]);
    });
});

describe('POST /unsubscribe', () => {
    it('flips notifications_enabled on a valid one-click request (Gmail-style)', async () => {
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'POST');

        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain('paddler@example.com');
        expect(body).toContain("You're unsubscribed");
        expect(updateCalls).toEqual(['user_1']);
    });

    it('flips notifications_enabled when the confirm page\'s own form is submitted', async () => {
        // Simulates a human clicking "Confirm unsubscribe" on the GET-rendered prompt,
        // which POSTs back to the exact same signed URL.
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'POST');

        expect(res.status).toBe(200);
        expect(updateCalls).toEqual(['user_1']);
    });

    it('rejects a tampered iat and does not touch the database', async () => {
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat + 1), sig }, 'POST');

        expect(res.status).toBe(400);
        expect(updateCalls).toEqual([]);
    });

    it('logs the unsubscribe with the signed link\'s age', async () => {
        const { env, logMessages } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const iat = Math.floor(Date.now() / 1000) - 5 * 86400; // signed 5 days ago
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'POST');

        expect(res.status).toBe(200);
        const entry = logMessages.find(m => m.includes('Unsubscribed user_1'));
        expect(entry).toBeDefined();
        expect(entry).toContain('5d old');
    });

    it('rejects a well-signed token for a user that no longer exists', async () => {
        const { env, updateCalls } = createMockEnv({});
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'ghost_user', iat);

        const res = await requestUnsubscribe(env, { uid: 'ghost_user', iat: String(iat), sig }, 'POST');

        expect(res.status).toBe(400);
        const body = await res.text();
        expect(body).toContain("This link isn't valid");
        expect(updateCalls).toEqual([]);
    });

    it('rejects requests missing query params without crashing', async () => {
        const { env } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        const res = await requestUnsubscribe(env, {}, 'POST');
        expect(res.status).toBe(400);
    });

    it('fails closed when UNSUBSCRIBE_SECRET is not configured', async () => {
        // Note: pass '' rather than undefined - createMockEnv's `secret` param has a default
        // value, and JS default parameters also kick in for an explicit `undefined` argument.
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } }, '');
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'POST');

        expect(res.status).toBe(400);
        expect(updateCalls).toEqual([]);
    });

    it('does not crash when the D1 update throws, and shows the error page', async () => {
        const { env, updateCalls } = createMockEnv({ user_1: { email: 'paddler@example.com' } });
        env.DB.prepare = (query: string) => ({
            bind: () => ({
                first: async () => (query.includes('SELECT email FROM users') ? { email: 'paddler@example.com' } : null),
                run: async () => { throw new Error('D1 connection reset'); }
            })
        });
        const iat = 1700000000;
        const sig = await signUnsubscribeToken(SECRET, 'user_1', iat);

        const res = await requestUnsubscribe(env, { uid: 'user_1', iat: String(iat), sig }, 'POST');

        expect(res.status).toBe(500);
        const body = await res.text();
        // A transient DB failure must NOT tell the user their link is invalid — it's a
        // server error and the link is fine, so they should be prompted to retry.
        expect(body).toContain("Something went wrong");
        expect(body).not.toContain("This link isn't valid");
        expect(updateCalls).toEqual([]);
    });
});
