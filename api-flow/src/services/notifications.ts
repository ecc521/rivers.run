import type { Env } from "../index";
import { sendEmail } from "../email";
import { normalizeGaugeId } from "../utils/formatting";
import { signUnsubscribeToken, buildUnsubscribeUrl } from "../utils/unsubscribeToken";
import { logToD1 } from "../utils/logger";

export interface RiverCondition {
    id: string;
    name: string;
    section: string | null;
    min: number | null;
    max: number | null;
    unit: string | null;
    gauges: any[];
}

function slugify(text: string): string {
    if (!text) return '';
    const cleaned = text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
    return cleaned.split('-').filter(Boolean).join('-');
}

function getRiverUrl(id: string, name: string, section: string | null): string {
    let slug = slugify(name);
    if (section) slug += '-' + slugify(section);
    return `https://rivers.run/river/${id}/${slug}`;
}

export interface ListGroup {
    listId: string;
    listTitle: string;
    rivers: RiverCondition[];
}

export interface UserSubscriptionInfo {
    email: string;
    timeOfDay: string;
    lists: ListGroup[];
}

export interface ListSummary {
    listId: string;
    listTitle: string;
    high: string[];
    running: string[];
    runningNames: string[];
    low: string[];
}

export interface DigestSummary {
    lists: ListSummary[];
}

export async function fetchSubscribedUsers(env: Env, currentTime: number): Promise<Map<string, UserSubscriptionInfo>> {
    const digestQuery = `
        SELECT
            target_user.user_id,
            target_user.list_id,
            cl.title as list_title,
            u.email,
            u.notifications_time_of_day,
            c.river_id,
            r.name,
            r.section,
            r.flow_min,
            r.flow_max,
            r.flow_unit,
            r.gauges,
            c.custom_min,
            c.custom_max,
            c.custom_units
        FROM (
            -- Owners of active lists
            SELECT owner_id as user_id, id as list_id FROM community_lists WHERE notifications_enabled = 1
            UNION
            -- Subscribers to active lists
            SELECT s.user_id, s.list_id FROM user_subscriptions s
            WHERE s.notifications_enabled = 1
        ) as target_user
        JOIN community_lists cl ON target_user.list_id = cl.id
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
                lists: []
            });
        }
        const userObj = usersMap.get(row.user_id as string)!;
        let listGroup = userObj.lists.find(l => l.listId === (row.list_id as string));
        if (!listGroup) {
            listGroup = { listId: row.list_id as string, listTitle: row.list_title as string, rivers: [] };
            userObj.lists.push(listGroup);
        }
        listGroup.rivers.push({
            id: row.river_id as string,
            name: row.name as string,
            section: row.section as string | null,
            min: row.custom_min !== null ? (row.custom_min as number) : (row.flow_min as number | null),
            max: row.custom_max !== null ? (row.custom_max as number) : (row.flow_max as number | null),
            unit: (row.custom_min !== null || row.custom_max !== null)
                ? (row.custom_units as string | null)
                : (row.flow_unit as string | null),
            gauges: typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || [])
        });
    }
    return usersMap;
}

/**
 * Resolves the numeric reading value based on the river's unit preference,
 * converting between flow (cfs/cms) or stage (ft/m) if necessary.
 * Falls back to legacy `.value` (for test suite compatibility) or any available unit.
 */
export function getReadingValue(reading: any, unit: string | null): number | undefined {
    if (!reading) return undefined;

    // Check for mock test compatibility
    if (reading.value !== undefined && reading.value !== null) {
        return Number(reading.value);
    }

    if (!unit) {
        // Fallback: try to find any available flow or stage value in order of preference
        const val = reading.cfs ?? reading.cms ?? reading.ft ?? reading.m;
        return val !== undefined ? Number(val) : undefined;
    }

    const cleanUnit = unit.toLowerCase();

    // If the exact unit is present, return it
    if (reading[cleanUnit] !== undefined && reading[cleanUnit] !== null) {
        return Number(reading[cleanUnit]);
    }

    // Otherwise, perform conversions if possible
    if (cleanUnit === "cfs" && reading.cms !== undefined && reading.cms !== null) {
        return Math.round((Number(reading.cms) * 35.3147) * 100) / 100;
    }
    if (cleanUnit === "cms" && reading.cfs !== undefined && reading.cfs !== null) {
        return Math.round((Number(reading.cfs) * 0.0283168) * 1000) / 1000;
    }
    if (cleanUnit === "ft" && reading.m !== undefined && reading.m !== null) {
        return Math.round((Number(reading.m) * 3.28084) * 100) / 100;
    }
    if (cleanUnit === "m" && reading.ft !== undefined && reading.ft !== null) {
        return Math.round((Number(reading.ft) * 0.3048) * 1000) / 1000;
    }

    // Secondary fallback
    const val = reading.cfs ?? reading.cms ?? reading.ft ?? reading.m;
    return val !== undefined ? Number(val) : undefined;
}

export function evaluateRiverConditions(rivers: RiverCondition[], mergedData: Record<string, any>): Omit<ListSummary, 'listId' | 'listTitle'> {
    const high: string[] = [];
    const running: string[] = [];
    const runningNames: string[] = [];
    const low: string[] = [];

    for (const river of rivers) {
        if (!river.gauges || river.gauges.length === 0) continue;
        const primaryGauge = river.gauges.find((g: any) => g.isPrimary) ?? river.gauges[0];
        const primaryGaugeId = normalizeGaugeId(primaryGauge.id);
        const match = mergedData[primaryGaugeId];
        if (!match || !match.readings || match.readings.length === 0) continue;
        
        // Readings in history are sorted ascending, so the latest is at the end of the array
        const latestReading = match.readings[match.readings.length - 1];
        const reading = getReadingValue(latestReading, river.unit);
        if (reading === undefined || isNaN(reading)) continue;

        const displayName = river.name + (river.section ? ` (${river.section})` : '');
        const unitSuffix = river.unit ? ` ${river.unit}` : '';
        const riverUrl = getRiverUrl(river.id, river.name, river.section);
        const link = `<a href="${riverUrl}">${displayName}</a>`;

        if (river.min !== null && river.max !== null) {
            if (reading > river.max) high.push(`<li>${link}: ${reading}${unitSuffix} (Too High)</li>`);
            else if (reading >= river.min) { running.push(`<li>${link}: ${reading}${unitSuffix}</li>`); runningNames.push(displayName); }
            else low.push(`<li>${link}: ${reading}${unitSuffix} (Too Low)</li>`);
        } else if (river.min !== null) {
            if (reading >= river.min) { running.push(`<li>${link}: ${reading}${unitSuffix}</li>`); runningNames.push(displayName); }
            else low.push(`<li>${link}: ${reading}${unitSuffix} (Too Low)</li>`);
        } else if (river.max !== null) {
            if (reading <= river.max) { running.push(`<li>${link}: ${reading}${unitSuffix}</li>`); runningNames.push(displayName); }
            else high.push(`<li>${link}: ${reading}${unitSuffix} (Too High)</li>`);
        }
    }
    return { high, running, runningNames, low };
}

export function buildDigestEmailBody(summary: DigestSummary, unsubscribeUrl: string | null): { subject: string, html: string } | null {
    const { lists } = summary;

    const totalRunning = lists.reduce((n, l) => n + l.running.length, 0);
    const totalHigh = lists.reduce((n, l) => n + l.high.length, 0);

    if (totalRunning + totalHigh === 0) return null;

    let subject = "Rivers are running!";
    if (totalRunning === 1 && totalHigh === 0) {
        const listWithRun = lists.find(l => l.running.length === 1);
        const rName = (listWithRun?.runningNames[0] ?? '').split(':')[0].trim();
        subject = (rName.endsWith('Creek') ? '' : 'The ') + rName + " is running!";
    } else if (totalRunning > 1) {
        subject = `${totalRunning} rivers are running!`;
    }

    let html = `<html><body>`;
    for (const list of lists) {
        const listUrl = `https://rivers.run/?list=${list.listId}`;
        html += `<h3><a href="${listUrl}">${list.listTitle}</a></h3>`;
        if (list.high.length > 0) html += `<strong>Too High:</strong><ul>${list.high.join('')}</ul>`;
        if (list.running.length > 0) html += `<strong>Running:</strong><ul>${list.running.join('')}</ul>`;
        if (list.low.length > 0) html += `<strong>Too Low:</strong><ul>${list.low.join('')}</ul>`;
    }
    html += `<p><a href="https://rivers.run/lists">View Your Lists on rivers.run</a></p>`;

    // Two distinct footer links, matching the two things a recipient might actually want:
    // fine-tune (which lists/times) vs. get off this list entirely. "Manage" always works
    // since it just points at the (login-gated) app; "Unsubscribe" only renders when we
    // have a signed token to offer - see the UNSUBSCRIBE_SECRET guard in processNotifications.
    html += `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">`;
    html += `<a href="https://rivers.run/lists" style="color:#3b82f6;text-decoration:none;">Manage your notifications</a>`;
    if (unsubscribeUrl) {
        html += ` &nbsp;·&nbsp; <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:none;">Unsubscribe from all notifications</a>`;
    }
    html += `</p></body></html>`;

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

        if (!env.UNSUBSCRIBE_SECRET) {
            await logToD1(env, "WARN", "email", "Digest emails sending without List-Unsubscribe headers: Missing UNSUBSCRIBE_SECRET secret.");
        }

        const updates: any[] = [];
        const emailsPromises: Promise<any>[] = [];

        for (const [userId, userObj] of usersMap.entries()) {
            const listSummaries: ListSummary[] = [];
            for (const list of userObj.lists) {
                const result = evaluateRiverConditions(list.rivers, mergedData);
                if (result.high.length + result.running.length + result.low.length > 0) {
                    listSummaries.push({ listId: list.listId, listTitle: list.listTitle, ...result });
                }
            }
            let unsubscribeUrl: string | null = null;
            let headers: Record<string, string> | undefined;
            if (env.UNSUBSCRIBE_SECRET) {
                const sig = await signUnsubscribeToken(env.UNSUBSCRIBE_SECRET, userId, currentTime);
                unsubscribeUrl = buildUnsubscribeUrl("https://flow.rivers.run", userId, currentTime, sig);
                headers = {
                    "List-Unsubscribe": `<${unsubscribeUrl}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                };
            }

            const emailData = buildDigestEmailBody({ lists: listSummaries }, unsubscribeUrl);

            if (emailData) {
                emailsPromises.push(
                    sendEmail({ env, to: userObj.email, subject: emailData.subject, html: emailData.html, headers })
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
