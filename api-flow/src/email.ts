import nodemailer from 'nodemailer';
import { logToD1 } from './utils/logger';

export async function sendEmail({ env, to, subject, html }: { env: any, to: string, subject: string, html: string }) {
    if (!env || !env.GMAIL_APP_PASSWORD) {
        await logToD1(env, "WARN", "email", "Emails not configured: Missing GMAIL_APP_PASSWORD secret.");
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
            html
        });
        await logToD1(env, "INFO", "email", `Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (e: any) {
        await logToD1(env, "ERROR", "email", `Nodemailer failure to ${to}`, e.message);
        console.error("Nodemailer routing failure on Cloudflare Worker:", e);
        return { success: false, error: e.message };
    }
}
