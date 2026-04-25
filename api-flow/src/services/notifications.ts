import type { Env } from "../index";
import { sendEmail } from "../email";

export interface RiverCondition {
    name: string;
    section: string | null;
    min: number | null;
    max: number | null;
    gauges: any[];
}

export interface UserSubscriptionInfo {
    email: string;
    timeOfDay: string;
    rivers: RiverCondition[];
}

export interface DigestSummary {
    high: string[];
    running: string[];
    low: string[];
}

export async function fetchSubscribedUsers(env: Env, currentTime: number): Promise<Map<string, UserSubscriptionInfo>> {
    const digestQuery = `
        SELECT 
            target_user.user_id, 
            u.email, 
            u.notifications_time_of_day,
            c.river_id, 
            r.name, 
            r.section,
            r.flow_min, 
            r.flow_max, 
            r.gauges, 
            c.custom_min, 
            c.custom_max
        FROM (
            -- Owners of active lists
            SELECT owner_id as user_id, id as list_id FROM community_lists WHERE notifications_enabled = 1
            UNION
            -- Subscribers to active lists
            SELECT s.user_id, s.list_id FROM user_subscriptions s 
            JOIN community_lists l ON s.list_id = l.id 
            WHERE l.notifications_enabled = 1
        ) as target_user
        JOIN community_list_rivers c ON target_user.list_id = c.list_id
        JOIN rivers r ON c.river_id = r.id
        JOIN users u ON target_user.user_id = u.user_id
        WHERE u.notifications_enabled = 1 
          AND u.email IS NOT NULL AND u.email != ''
          AND u.notifications_none_until <= ?
    `;
    const { results: listeningRows } = await env.DB.prepare(digestQuery).bind(currentTime).all();

    const usersMap = new Map<string, UserSubscriptionInfo>();
    for (const row of (listeningRows || [])) {
        if (!usersMap.has(row.user_id as string)) {
            usersMap.set(row.user_id as string, {
                email: row.email as string,
                timeOfDay: (row.notifications_time_of_day as string) || "10:00",
                rivers: []
            });
        }
        usersMap.get(row.user_id as string)!.rivers.push({
            name: row.name as string,
            section: row.section as string | null,
            min: row.custom_min !== null ? (row.custom_min as number) : (row.flow_min as number | null),
            max: row.custom_max !== null ? (row.custom_max as number) : (row.flow_max as number | null),
            gauges: typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || [])
        });
    }
    return usersMap;
}

export function evaluateRiverConditions(rivers: RiverCondition[], mergedData: Record<string, any>): DigestSummary {
    const high: string[] = [];
    const running: string[] = [];
    const low: string[] = [];

    for (const river of rivers) {
        if (!river.gauges || river.gauges.length === 0) continue;
        const primaryGaugeId = river.gauges[0].id;
        const match = mergedData[primaryGaugeId];
        if (!match || !match.readings || match.readings.length === 0) continue;
        
        const reading = match.readings[0].value;
        const displayName = river.name + (river.section ? ` (${river.section})` : '');

        if (river.min !== null && river.max !== null) {
            if (reading > river.max) high.push(`<li>${displayName}: ${reading} (Too High)</li>`);
            else if (reading >= river.min) running.push(`<li>${displayName}: ${reading}</li>`);
            else low.push(`<li>${displayName}: ${reading} (Too Low)</li>`);
        } else if (river.min !== null) {
            if (reading >= river.min) running.push(`<li>${displayName}: ${reading}</li>`);
            else low.push(`<li>${displayName}: ${reading} (Too Low)</li>`);
        } else if (river.max !== null) {
            if (reading <= river.max) running.push(`<li>${displayName}: ${reading}</li>`);
            else high.push(`<li>${displayName}: ${reading} (Too High)</li>`);
        }
    }
    return { high, running, low };
}

export function buildDigestEmailBody(summary: DigestSummary): { subject: string, html: string } | null {
    const { high, running, low } = summary;
    const totalActive = high.length + running.length;

    // Legacy behavior: Only email if something is active
    if (totalActive === 0) {
        return null;
    }

    let subject = "Rivers are running!";
    if (running.length === 1 && high.length === 0) {
        const rName = running[0].split(':')[0].replace('<li>', '').trim();
        subject = (rName.endsWith('Creek') ? '' : 'The ') + rName + " is running!";
    } else if (running.length > 1) {
        subject = `${running.length} rivers are running!`;
    }

    let html = `<html><body>`;
    if (high.length > 0) html += `<h3>Rivers that are Too High:</h3><ul>${high.join('')}</ul>`;
    if (running.length > 0) html += `<h3>Rivers that are Running:</h3><ul>${running.join('')}</ul>`;
    if (low.length > 0) html += `<h3>Rivers that are Too Low:</h3><ul>${low.join('')}</ul>`;
    
    html += `<p><a href="https://rivers.run/favorites">View All Favorites on rivers.run</a></p>`;
    html += `<p>Click <a href="https://rivers.run/favorites">here</a> to manage your subscription.</p></body></html>`;

    return { subject, html };
}

export function calculateNextTriggerTime(timeOfDay: string, nowMs: number): number {
    const [hh, mm] = timeOfDay.split(':').map(Number);
    const now = new Date(nowMs);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 10, mm || 0, 0, 0);
    
    if (target.getTime() <= nowMs) {
        target.setTime(target.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return Math.floor(target.getTime() / 1000);
}

export async function processNotifications(env: Env, mergedData: Record<string, any>, ctx: ExecutionContext) {
    console.log("Processing Daily Digest Notifications...");
    try {
        const nowMs = Date.now();
        const currentTime = Math.floor(nowMs / 1000);

        const usersMap = await fetchSubscribedUsers(env, currentTime);
        
        const updates: any[] = [];
        const emailsPromises: Promise<any>[] = [];

        for (const [userId, userObj] of usersMap.entries()) {
            const summary = evaluateRiverConditions(userObj.rivers, mergedData);
            const emailData = buildDigestEmailBody(summary);
            
            if (emailData) {
                emailsPromises.push(
                    sendEmail({ env, to: userObj.email, subject: emailData.subject, html: emailData.html })
                );
            }

            const nextTimestamp = calculateNextTriggerTime(userObj.timeOfDay, nowMs);
            updates.push(env.DB.prepare("UPDATE users SET notifications_none_until = ? WHERE user_id = ?").bind(nextTimestamp, userId));
        }

        if (emailsPromises.length > 0) {
            ctx.waitUntil(Promise.all(emailsPromises));
        }
        
        if (updates.length > 0) {
            // Throttle maximum batches to 100 sequentially to prevent hitting maximum statement limits on massive D1 runs
            for (let i = 0; i < updates.length; i += 100) {
                const chunk = updates.slice(i, i + 100);
                await env.DB.batch(chunk);
            }
        }
    } catch (e) {
        console.error("Notifications processing failed:", e);
    }
}
