import { logToD1 } from './utils/logger';

export const EMAIL_FROM = { name: 'Rivers.run', email: 'notifications@rivers.run' };

export type SendEmailResult =
    | { success: true; messageId: string }
    | { success: false; error: string; code?: string };

/** Cloudflare throws this when the recipient is on the account suppression list. */
export const RECIPIENT_SUPPRESSED = 'E_RECIPIENT_SUPPRESSED';

export async function sendEmail({ env, to, subject, html, headers }: { env: any, to: string, subject: string, html: string, headers?: Record<string, string> }): Promise<SendEmailResult> {
    if (!env?.EMAIL) {
        await logToD1(env, "WARN", "email", "Emails not configured: Missing EMAIL send_email binding.");
        return { success: false, error: "Missing config" };
    }

    try {
        const { messageId } = await env.EMAIL.send({ from: EMAIL_FROM, to, subject, html, headers });
        await logToD1(env, "INFO", "email", `Email sent to ${to}: ${messageId}`);
        return { success: true, messageId };
    } catch (e: any) {
        const code: string | undefined = e?.code;
        const level = code === RECIPIENT_SUPPRESSED ? "WARN" : "ERROR";
        await logToD1(env, level, "email", `Email failure to ${to}`, `${code ?? 'unknown'}: ${e?.message}`);
        return { success: false, error: e?.message ?? String(e), code };
    }
}
