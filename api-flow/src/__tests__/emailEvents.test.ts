import { describe, it, expect, vi } from 'vitest';
import { handleEmailEvents, shouldDisableRecipient, type EmailSendingEvent } from '../services/emailEvents';

const bounced = (type: 'hard' | 'soft', recipient = 'Gone@Example.com'): EmailSendingEvent =>
    ({ type: 'cf.email.sending.message.bounced', payload: { eventId: 'e1', recipient, bounce: { type } } });
const complained: EmailSendingEvent = { type: 'cf.email.sending.message.complained', payload: { eventId: 'e2', recipient: 'spam@example.com' } };

function makeBatch(events: EmailSendingEvent[]) {
    const messages = events.map(body => ({ body, ack: vi.fn(), retry: vi.fn() }));
    return { batch: { messages } as any, messages };
}

function makeEnv(changes = 1) {
    const run = vi.fn().mockResolvedValue({ meta: { changes } });
    const bind = vi.fn((..._args: unknown[]) => ({ run }));
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

    it('leaves users alone on soft bounces', async () => {
        const { batch, messages } = makeBatch([bounced('soft')]);
        const { env, prepare } = makeEnv();
        await handleEmailEvents(batch, env);

        expect(prepare).not.toHaveBeenCalled();
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
