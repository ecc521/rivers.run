import type { Env } from "../index";
import { sendEmail } from "../email";

export async function processNotifications(env: Env, mergedData: Record<string, any>, ctx: ExecutionContext) {
    console.log("Processing Daily Digest Notifications...");
    try {
        const nowMs = Date.now();
        const currentTime = Math.floor(nowMs / 1000);

        const digestQuery = `
            SELECT 
                l.owner_id as user_id, 
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
            FROM community_lists l
            JOIN community_list_rivers c ON l.id = c.list_id
            JOIN rivers r ON c.river_id = r.id
            JOIN users u ON l.owner_id = u.user_id
            WHERE l.notifications_enabled = 1 
              AND u.notifications_enabled = 1 
              AND u.email IS NOT NULL AND u.email != ''
              AND u.notifications_none_until <= ?
        `;
        const { results: listeningRows } = await env.DB.prepare(digestQuery).bind(currentTime).all();

        const usersMap = new Map<string, { email: string, timeOfDay: string, rivers: any[] }>();
        for (const row of (listeningRows || [])) {
            if (!usersMap.has(row.user_id as string)) {
                usersMap.set(row.user_id as string, {
                    email: row.email as string,
                    timeOfDay: row.notifications_time_of_day as string || "10:00",
                    rivers: []
                });
            }
            usersMap.get(row.user_id as string)!.rivers.push({
                name: row.name,
                section: row.section,
                min: row.custom_min !== null ? row.custom_min : row.flow_min,
                max: row.custom_max !== null ? row.custom_max : row.flow_max,
                gauges: typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || [])
            });
        }

        const updates: any[] = [];
        const emailsPromises: Promise<any>[] = [];

        for (const [userId, userObj] of usersMap.entries()) {
            const high: string[] = [];
            const running: string[] = [];
            const low: string[] = [];

            for (const river of userObj.rivers) {
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

            const totalActive = high.length + running.length;

            // Legacy behavior: Only email if something is active
            if (totalActive > 0) {
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

                emailsPromises.push(
                    sendEmail({ env, to: userObj.email, subject, html })
                );
            }

            // Compute NEXT trigger time
            const [hh, mm] = userObj.timeOfDay.split(':').map(Number);
            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 10, mm || 0, 0, 0);
            
            if (target.getTime() <= nowMs) {
                target.setTime(target.getTime() + 24 * 60 * 60 * 1000);
            }
            
            const nextTimestamp = Math.floor(target.getTime() / 1000);
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
