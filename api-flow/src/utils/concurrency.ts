/**
 * Runs `fn` over `items` with at most `limit` in flight. Each item's result is released
 * before the next starts, so memory held at once is bounded by `limit`, not the item count.
 */
export async function forEachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let index = 0;
    const worker = async () => {
        while (index < items.length) await fn(items[index++]);
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
