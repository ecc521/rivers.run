import nodemailer from 'nodemailer';

/**
 * Sends a generic transactional email using the dedicated rivers.run Gmail account.
 * Cloudflare Workers must be running with `nodejs_compat` enabled to access net/tls required by nodemailer.
 */
export async function sendEmail({ env, to, subject, text, html }: { env: any, to: string, subject: string, text?: string, html?: string }) {
    if (!env || !env.GMAIL_APP_PASSWORD) {
        console.warn("Emails not configured: Missing GMAIL_APP_PASSWORD secret in Cloudflare environment.");
        return { success: false, error: "Missing config" };
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'email.rivers.run@gmail.com',
            pass: env.GMAIL_APP_PASSWORD
        }
    });

    try {
        const info = await transporter.sendMail({
            from: '"Rivers.run" <email.rivers.run@gmail.com>',
            to,
            subject,
            text,
            html
        });
        console.log(`Email sent from NodeMailer to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (e: any) {
        console.error("Nodemailer routing failure on Cloudflare Worker:", e);
        return { success: false, error: e.message };
    }
}
