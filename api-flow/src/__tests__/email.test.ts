import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail, EMAIL_FROM } from '../email';

const sendMock = vi.fn();

function makeEnv() {
    return {
        EMAIL: { send: sendMock },
        DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn().mockResolvedValue({}) })) })) }
    };
}

describe('sendEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendMock.mockResolvedValue({ messageId: 'msg-1' });
    });

    it('sends from notifications@rivers.run and forwards custom headers', async () => {
        const headers = {
            'List-Unsubscribe': '<https://flow.rivers.run/unsubscribe?uid=u1&iat=1&sig=abc>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        };
        const result = await sendEmail({ env: makeEnv(), to: 'runner@example.com', subject: 'Rivers are running!', html: '<p>hi</p>', headers });

        expect(result).toEqual({ success: true, messageId: 'msg-1' });
        expect(sendMock).toHaveBeenCalledWith({
            from: EMAIL_FROM, to: 'runner@example.com', subject: 'Rivers are running!', html: '<p>hi</p>', headers
        });
        expect(EMAIL_FROM.email).toBe('notifications@rivers.run');
    });

    it('does not attempt to send when the EMAIL binding is missing', async () => {
        const result = await sendEmail({ env: { DB: makeEnv().DB }, to: 'a@example.com', subject: 's', html: '<p></p>' });
        expect(result.success).toBe(false);
        expect(sendMock).not.toHaveBeenCalled();
    });

    it('returns the error code when the send throws', async () => {
        sendMock.mockRejectedValue(Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' }));
        const result = await sendEmail({ env: makeEnv(), to: 'a@example.com', subject: 's', html: '<p></p>' });
        expect(result).toEqual({ success: false, error: 'suppressed', code: 'E_RECIPIENT_SUPPRESSED' });
    });
});
