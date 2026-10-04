import type { Env } from "../index";
import { logToD1 } from "../utils/logger";

/** Event published by Cloudflare Email Sending to the `email-events` queue. */
export interface EmailSendingEvent {
    type: string;
    payload: {
        eventId?: string;
        recipient?: string;
        bounce?: { type?: "hard" | "soft" };
    };
}

/** Only permanent failures and spam complaints stop mail; soft bounces retry on their own. */
export function shouldDisableRecipient(event: EmailSendingEvent): boolean {
    if (event.type?.endsWith("message.complained")) return true;
    return !!event.type?.endsWith("message.bounced") && event.payload?.bounce?.type === "hard";
}

export async function handleEmailEvents(batch: MessageBatch<EmailSendingEvent>, env: Env): Promise<void> {
    for (const message of batch.messages) {
        try {
            const event = message.body;
            const recipient = event.payload?.recipient;
            if (recipient && shouldDisableRecipient(event)) {
                const result = await env.DB.prepare(
                    "UPDATE users SET notifications_enabled = 0 WHERE email = ? COLLATE NOCASE AND notifications_enabled = 1"
                ).bind(recipient).run();
                if (result.meta?.changes) {
                    await logToD1(env, "INFO", "email", `Disabled notifications after ${event.type} for ${recipient}`);
                }
            }
            message.ack();
        } catch (e) {
            console.error("Email event handling failed:", e);
            message.retry();
        }
    }
}
