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

const DAY_S = 86400;
/** A soft bounce that would pause digests longer than this turns notifications off instead. */
const MAX_PAUSE_DAYS = 45;
/** Repeat events inside this window (queue redelivery) do not count again. */
const DUPLICATE_WINDOW_S = 3600;

/** Only permanent failures and spam complaints stop mail at once. */
export function shouldDisableRecipient(event: EmailSendingEvent): boolean {
    if (event.type?.endsWith("message.complained")) return true;
    return !!event.type?.endsWith("message.bounced") && event.payload?.bounce?.type === "hard";
}

export function isSoftBounce(event: EmailSendingEvent): boolean {
    return !!event.type?.endsWith("message.bounced") && event.payload?.bounce?.type === "soft";
}

export type SoftBounceOutcome =
    | { action: "ignore" }
    | { action: "pause"; count: number; pauseS: number }
    | { action: "disable"; count: number };

/**
 * Each consecutive soft bounce doubles the pause before the next digest (1, 2, 4, ... days),
 * and the user is turned off once the pause would pass MAX_PAUSE_DAYS (about two months in).
 * A bounce long after the previous pause ended means a later digest got through, so the
 * count starts over.
 */
export function nextSoftBounceState(count: number, lastAt: number, nowS: number): SoftBounceOutcome {
    const sinceLast = nowS - lastAt;
    if (count > 0 && sinceLast < DUPLICATE_WINDOW_S) return { action: "ignore" };

    const previousPauseS = count > 0 ? 2 ** (count - 1) * DAY_S : 0;
    const consecutive = count > 0 && sinceLast <= 2 * previousPauseS + 2 * DAY_S;
    const next = consecutive ? count + 1 : 1;
    const pauseDays = 2 ** (next - 1);
    if (pauseDays > MAX_PAUSE_DAYS) return { action: "disable", count: next };
    return { action: "pause", count: next, pauseS: pauseDays * DAY_S };
}

async function applySoftBounce(env: Env, recipient: string, nowS: number): Promise<void> {
    const user = await env.DB.prepare(
        "SELECT user_id, soft_bounce_count, soft_bounce_at FROM users WHERE email = ? COLLATE NOCASE AND notifications_enabled = 1"
    ).bind(recipient).first<{ user_id: string; soft_bounce_count: number; soft_bounce_at: number }>();
    if (!user) return;

    const outcome = nextSoftBounceState(user.soft_bounce_count, user.soft_bounce_at, nowS);
    if (outcome.action === "ignore") return;

    if (outcome.action === "disable") {
        await env.DB.prepare(
            "UPDATE users SET notifications_enabled = 0, soft_bounce_count = ?, soft_bounce_at = ? WHERE user_id = ?"
        ).bind(outcome.count, nowS, user.user_id).run();
        await logToD1(env, "INFO", "email", `Disabled notifications after ${outcome.count} consecutive soft bounces for ${recipient}`);
        return;
    }

    await env.DB.prepare(
        "UPDATE users SET soft_bounce_count = ?, soft_bounce_at = ?, notifications_none_until = MAX(notifications_none_until, ?) WHERE user_id = ?"
    ).bind(outcome.count, nowS, nowS + outcome.pauseS, user.user_id).run();
    await logToD1(env, "INFO", "email", `Soft bounce ${outcome.count} for ${recipient}: pausing digests ${outcome.pauseS / DAY_S}d`);
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
            } else if (recipient && isSoftBounce(event)) {
                await applySoftBounce(env, recipient, Math.floor(Date.now() / 1000));
            }
            message.ack();
        } catch (e) {
            console.error("Email event handling failed:", e);
            message.retry();
        }
    }
}
