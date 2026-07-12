import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { sendEmail } from '../email';

const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-1' });

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({ sendMail: sendMailMock }))
    }
}));

describe('sendEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendMailMock.mockResolvedValue({ messageId: 'msg-1' });
    });

    it('forwards custom headers to nodemailer when provided', async () => {
        await sendEmail({
            env: { GMAIL_APP_PASSWORD: 'app-pass' },
            to: 'runner@example.com',
            subject: 'Rivers are running!',
            html: '<p>hi</p>',
            headers: {
                'List-Unsubscribe': '<https://flow.rivers.run/unsubscribe?uid=u1&iat=1&sig=abc>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        });

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const callArgs = sendMailMock.mock.calls[0][0];
        expect(callArgs.headers).toEqual({
            'List-Unsubscribe': '<https://flow.rivers.run/unsubscribe?uid=u1&iat=1&sig=abc>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        });
    });

    it('sends without a headers key when none are provided', async () => {
        await sendEmail({
            env: { GMAIL_APP_PASSWORD: 'app-pass' },
            to: 'runner@example.com',
            subject: 'Rivers are running!',
            html: '<p>hi</p>'
        });

        const callArgs = sendMailMock.mock.calls[0][0];
        expect(callArgs.headers).toBeUndefined();
    });

    it('does not attempt to send when GMAIL_APP_PASSWORD is missing', async () => {
        const result = await sendEmail({ env: {}, to: 'a@example.com', subject: 's', html: '<p></p>' });
        expect(result.success).toBe(false);
        expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('creates the transporter against Gmail SMTP', async () => {
        await sendEmail({ env: { GMAIL_APP_PASSWORD: 'app-pass' }, to: 'a@example.com', subject: 's', html: '<p></p>' });
        expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: 'smtp.gmail.com',
            port: 465
        }));
    });
});
