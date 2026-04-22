
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export async function logToD1(
    env: any, 
    level: LogLevel, 
    component: string, 
    message: string, 
    details?: any
) {
    const timestamp = Math.floor(Date.now() / 1000);
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;

    console.log(`[${level}] [${component}] ${message}`);

    try {
        if (env.DB) {
            await env.DB.prepare(
                "INSERT INTO worker_logs (timestamp, level, component, message, details) VALUES (?, ?, ?, ?, ?)"
            ).bind(timestamp, level, component, message, detailsStr).run();
        }
    } catch (e) {
        console.error("Failed to write log to D1:", e);
    }
}
