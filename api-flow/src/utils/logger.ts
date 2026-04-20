import type { Env } from "../index";

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export async function logToD1(
    env: Env, 
    level: LogLevel, 
    component: string, 
    message: string, 
    details?: any
) {
    const timestamp = Math.floor(Date.now() / 1000);
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;

    console.log(`[${level}] [${component}] ${message}`);

    try {
        await env.DB.prepare(
            "INSERT INTO worker_logs (timestamp, level, component, message, details) VALUES (?, ?, ?, ?, ?)"
        ).bind(timestamp, level, component, message, detailsStr).run();
    } catch (e) {
        console.error("Failed to write log to D1:", e);
    }
}

/**
 * Prunes old logs to stay within reasonable storage limits.
 * Default cap is 10,000 entries.
 */
export async function pruneLogs(env: Env, cap: number = 10000) {
    try {
        await env.DB.prepare(`
            DELETE FROM worker_logs 
            WHERE id NOT IN (
                SELECT id FROM worker_logs 
                ORDER BY id DESC 
                LIMIT ?
            )
        `).bind(cap).run();
    } catch (e) {
        console.error("Log pruning failed:", e);
    }
}
