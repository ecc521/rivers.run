export function splitStatements(sql: string): string[];
export const prepareSQL: string;
export function copySQL(lo: number, hi: number): string;
export function coverageSQL(lo: number, hi: number): string;
export function verifySQL(lo: number, hi: number): string;
export interface QueryResult {
    results: Record<string, unknown>[];
    meta?: { rows_written?: number; changes?: number };
}
export interface MigrationResult {
    seedFrom: number;
    gauges: number;
    quarters: number;
    hours: number;
    rowsWritten: number;
    sourceMeta: Record<string, unknown>[];
    initialSyncState: Record<string, unknown>[];
}
export function runMigration(
    query: (sql: string) => Promise<QueryResult>,
    options?: { batchSize?: number; onProgress?: (progress: Record<string, number | string>) => void },
): Promise<MigrationResult>;

export function remoteQuery(options: {
    endpoint: string;
    token: () => string | undefined;
    fetcher?: typeof fetch;
    wait?: (ms: number) => Promise<void>;
    now?: () => number;
    onRetry?: (retry: { status: number; delayMs: number; attempt: number }) => void;
}): (sql: string) => Promise<QueryResult>;
