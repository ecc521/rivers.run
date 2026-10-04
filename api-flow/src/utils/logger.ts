import type { Env } from "../index";

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// JSON.stringify turns an Error into {}, so keep its fields.
function errorReplacer(_key: string, value: unknown) {
    return value instanceof Error ? { name: value.name, message: value.message, cause: value.cause } : value;
}

export async function logToD1(
    env: Env, 
    level: LogLevel, 
    component: string, 
    message: string, 
    details?: any
) {
    const timestamp = Math.floor(Date.now() / 1000);
    let detailsStr: string | null = null;
    if (details) {
        detailsStr = typeof details === 'string' ? details : JSON.stringify(details, errorReplacer);
    }

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
 * Default cap is 30,000 entries.
 */
export async function pruneLogs(env: Env, cap: number = 30000) {
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
