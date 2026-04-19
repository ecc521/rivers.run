/**
 * Timeout Utilities for Cloudflare Workers
 */

export const DEFAULT_HEADERS = {
    'User-Agent': 'Rivers.run Flow Bot (https://rivers.run; contact: support@rivers.run)',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br'
};

/**
 * Races a promise against a timeout.
 */
export async function withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number, 
    errorMessage: string = "Operation timed out"
): Promise<T> {
    let timeoutHandle: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutHandle);
    }
}

/**
 * Fetch with a built-in timeout using AbortController.
 * Default timeout is 20 seconds.
 */
export async function fetchWithTimeout(
    url: string, 
    options: RequestInit = {}, 
    timeoutMs: number = 20000
): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') {
            throw new Error(`Fetch timed out after ${timeoutMs}ms: ${url}`, { cause: e });
        }
        throw e;
    }
}
