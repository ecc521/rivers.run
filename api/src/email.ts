import { logToD1 } from './utils/logger';

const EMAIL_FROM = { name: 'Rivers.run', email: 'notifications@rivers.run' };

/** Sends a transactional email through the Cloudflare Email Sending binding (`EMAIL`). */
export async function sendEmail({ env, to, subject, text, html }: { env: any, to: string | string[], subject: string, text?: string, html?: string }) {
    if (!env?.EMAIL) {
        await logToD1(env, "WARN", "email", "Emails not configured: Missing EMAIL send_email binding.");
        return { success: false, error: "Missing config" };
    }

    const recipients = (Array.isArray(to) ? to : to.split(',')).map(a => a.trim()).filter(Boolean);
    try {
        const info = await env.EMAIL.send({ from: EMAIL_FROM, to: recipients, subject, text, html });
        await logToD1(env, "INFO", "email", `Email sent to ${recipients.join(', ')}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (e: any) {
        await logToD1(env, "ERROR", "email", `Email failure to ${recipients.join(', ')}`, `${e?.code ?? 'unknown'}: ${e?.message}`);
        return { success: false, error: e?.message ?? String(e) };
    }
}
