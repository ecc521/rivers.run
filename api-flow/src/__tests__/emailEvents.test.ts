import { describe, it, expect, vi } from 'vitest';
import { handleEmailEvents, nextSoftBounceState, shouldDisableRecipient, type EmailSendingEvent } from '../services/emailEvents';

const DAY = 86400;
const bounced = (type: 'hard' | 'soft', recipient = 'Gone@Example.com'): EmailSendingEvent =>
    ({ type: 'cf.email.sending.message.bounced', payload: { eventId: 'e1', recipient, bounce: { type } } });
const complained: EmailSendingEvent = { type: 'cf.email.sending.message.complained', payload: { eventId: 'e2', recipient: 'spam@example.com' } };

function makeBatch(events: EmailSendingEvent[]) {
    const messages = events.map(body => ({ body, ack: vi.fn(), retry: vi.fn() }));
    return { batch: { messages } as any, messages };
}

function makeEnv(user?: { user_id: string; soft_bounce_count: number; soft_bounce_at: number }, changes = 1) {
    const run = vi.fn().mockResolvedValue({ meta: { changes } });
    const first = vi.fn().mockResolvedValue(user ?? null);
    const bind = vi.fn((..._args: unknown[]) => ({ run, first }));
    const prepare = vi.fn((_query: string) => ({ bind }));
    return { env: { DB: { prepare } } as any, prepare, bind };
}

describe('shouldDisableRecipient', () => {
    it('disables on hard bounces and complaints only', () => {
        expect(shouldDisableRecipient(bounced('hard'))).toBe(true);
        expect(shouldDisableRecipient(complained)).toBe(true);
        expect(shouldDisableRecipient({ ...bounced('hard'), type: 'message.bounced' })).toBe(true);
        expect(shouldDisableRecipient(bounced('soft'))).toBe(false);
        expect(shouldDisableRecipient({ type: 'cf.email.sending.message.deferred', payload: {} })).toBe(false);
    });
});

describe('nextSoftBounceState', () => {
    const now = 1_800_000_000;

    it('starts at a one day pause and doubles on each consecutive bounce', () => {
        let count = 0;
        let at = 0;
        const pauses: number[] = [];
        let t = now;
        for (let i = 0; i < 6; i++) {
            const out = nextSoftBounceState(count, at, t);
            if (out.action !== 'pause') throw new Error('expected pause');
            pauses.push(out.pauseS / DAY);
            count = out.count;
            at = t;
            t += out.pauseS + DAY / 2; // the next digest bounces right after the pause ends
        }
        expect(pauses).toEqual([1, 2, 4, 8, 16, 32]);
    });

    it('disables once the pause would exceed 45 days', () => {
        expect(nextSoftBounceState(6, now - 33 * DAY, now)).toEqual({ action: 'disable', count: 7 });
    });

    it('starts over when a later digest got through', () => {
        const out = nextSoftBounceState(4, now - 200 * DAY, now);
        expect(out).toEqual({ action: 'pause', count: 1, pauseS: DAY });
    });

    it('ignores a repeat event inside the duplicate window', () => {
        expect(nextSoftBounceState(2, now - 60, now)).toEqual({ action: 'ignore' });
    });
});

describe('handleEmailEvents', () => {
    it('turns notifications off for a hard-bounced recipient, case-insensitively', async () => {
        const { batch, messages } = makeBatch([bounced('hard')]);
        const { env, prepare, bind } = makeEnv();
        await handleEmailEvents(batch, env);

        expect(prepare.mock.calls[0][0]).toContain('SET notifications_enabled = 0');
        expect(prepare.mock.calls[0][0]).toContain('COLLATE NOCASE');
        expect(bind).toHaveBeenCalledWith('Gone@Example.com');
        expect(messages[0].ack).toHaveBeenCalled();
    });

    it('pauses digests for a first soft bounce without disabling the user', async () => {
        const { batch, messages } = makeBatch([bounced('soft')]);
        const { env, prepare, bind } = makeEnv({ user_id: 'u1', soft_bounce_count: 0, soft_bounce_at: 0 });
        const before = Math.floor(Date.now() / 1000);
        await handleEmailEvents(batch, env);

        const update = prepare.mock.calls.map(c => c[0]).find(q => q.startsWith('UPDATE users SET soft_bounce_count'))!;
        expect(update).toContain('MAX(notifications_none_until');
        expect(update).not.toContain('notifications_enabled = 0');
        const args = bind.mock.calls.find(c => c.length === 4)!;
        expect(args[0]).toBe(1);
        expect(args[2] as number).toBeGreaterThanOrEqual(before + DAY);
        expect(args[3]).toBe('u1');
        expect(messages[0].ack).toHaveBeenCalled();
    });

    it('disables a user whose soft bounces have run out the backoff', async () => {
        const at = Math.floor(Date.now() / 1000) - 33 * DAY;
        const { batch } = makeBatch([bounced('soft')]);
        const { env, prepare } = makeEnv({ user_id: 'u1', soft_bounce_count: 6, soft_bounce_at: at });
        await handleEmailEvents(batch, env);

        expect(prepare.mock.calls.map(c => c[0]).some(q => q.includes('SET notifications_enabled = 0, soft_bounce_count'))).toBe(true);
    });

    it('does nothing for a soft bounce to an unknown or already disabled address', async () => {
        const { batch, messages } = makeBatch([bounced('soft')]);
        const { env, prepare } = makeEnv();
        await handleEmailEvents(batch, env);

        expect(prepare.mock.calls.map(c => c[0]).some(q => q.startsWith('UPDATE'))).toBe(false);
        expect(messages[0].ack).toHaveBeenCalled();
    });

    it('retries a message when the database update fails', async () => {
        const { batch, messages } = makeBatch([complained]);
        const env = { DB: { prepare: vi.fn(() => { throw new Error('d1 down'); }) } } as any;
        await handleEmailEvents(batch, env);

        expect(messages[0].retry).toHaveBeenCalled();
        expect(messages[0].ack).not.toHaveBeenCalled();
    });
});
