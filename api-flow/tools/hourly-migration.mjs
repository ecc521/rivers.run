#!/usr/bin/env node
// Production: --remote --paused --account ID --database ID --oauth-config PATH --report PATH
// Local: --local-file PATH --report PATH (the legacy schema/data must already exist).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const migration = readFileSync(new URL('../migrations/2026-10-02_hourly_flow_history.sql', import.meta.url), 'utf8');
const section = name => migration.match(new RegExp(`-- BEGIN ${name}\\n([\\s\\S]*?)-- END ${name}`))[1];
/** Migration SQL has no semicolons inside literals; discard comments before splitting. */
export const splitStatements = sql => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
    .split(';').map(s => s.trim()).filter(Boolean);
export const prepareSQL = migration.replace(/-- BEGIN (COPY|COVERAGE)\n[\s\S]*?-- END \1/g, '');
const range = (lo, hi) => {
    if (![lo, hi].every(Number.isSafeInteger) || lo < 0 || hi < lo) throw new Error('Invalid gauge range');
    return `${lo} AND ${hi}`;
};
export function copySQL(lo, hi) {
    return section('COPY').replace('FROM gauge_readings WHERE ts >=',
        `FROM gauge_readings WHERE gauge_key BETWEEN ${range(lo, hi)} AND ts >=`);
}
export function coverageSQL(lo, hi) {
    return section('COVERAGE').replace('WHERE coverage_start <',
        `WHERE gauge_key BETWEEN ${range(lo, hi)} AND (coverage_start <`).replace(/;\s*$/, ');');
}
const columns = 'gauge_key,slot,ts,off,cfs,ft,cms,m,temp_f,precip_in';
export function verifySQL(lo, hi) {
    const bounds = range(lo, hi);
    return `WITH expected AS (
        SELECT ${columns} FROM gauge_readings
        WHERE gauge_key BETWEEN ${bounds} AND ts >= (SELECT v FROM sync_meta WHERE k='hourly_seed_from')
    ), actual AS (
        SELECT ${columns} FROM gauge_reading_slots WHERE gauge_key BETWEEN ${bounds}
    ), missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
       extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT (SELECT COUNT(*) FROM missing) AS missing,
           (SELECT COUNT(*) FROM extra) AS extra,
           (SELECT COUNT(*) FROM expected) AS quarters,
           (SELECT COUNT(*) FROM gauge_reading_hours WHERE gauge_key BETWEEN ${bounds}) AS hours`;
}

/** Each verified batch is checkpointed. Coverage changes only after the full verification pass. */
export async function runMigration(query, { batchSize = 20, onProgress = () => {} } = {}) {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Batch size must be 1..100');
    const initialState = await query('SELECT * FROM gauge_sync_state ORDER BY gauge_key');
    const sourceSQL = "SELECT k,v FROM sync_meta WHERE k NOT LIKE 'hourly_%' ORDER BY k";
    const sourceMeta = (await query(sourceSQL)).results;
    await query(prepareSQL);
    const seedFrom = (await query("SELECT v FROM sync_meta WHERE k='hourly_seed_from'")).results[0].v;
    const gauges = (await query('SELECT gauge_key FROM gauges ORDER BY gauge_key')).results.map(r => r.gauge_key);
    // A dangling legacy gauge must never be silently omitted by the gauge batches.
    const orphan = await query('SELECT gauge_key FROM gauge_readings WHERE gauge_key NOT IN (SELECT gauge_key FROM gauges) LIMIT 1');
    if (orphan.results.length) throw new Error('Legacy readings have an unregistered gauge');
    const batches = [];
    for (let i = 0; i < gauges.length; i += batchSize) batches.push([gauges[i], gauges[Math.min(i + batchSize, gauges.length) - 1]]);
    let checkpoint = (await query("SELECT v FROM sync_meta WHERE k='hourly_copy_through'")).results[0]?.v ?? -1;
    let rowsWritten = 0;
    for (const [lo, hi] of batches) {
        if (hi <= checkpoint) continue;
        const copy = await query(copySQL(lo, hi));
        rowsWritten += copy.meta?.rows_written ?? copy.meta?.changes ?? 0;
        const checked = (await query(verifySQL(lo, hi))).results[0];
        if (checked.missing || checked.extra) throw new Error(`Copy verification failed for ${lo}..${hi}: ${JSON.stringify(checked)}`);
        await query(`INSERT INTO sync_meta(k,v) VALUES('hourly_copy_through',${hi}) ON CONFLICT(k) DO UPDATE SET v=excluded.v WHERE v!=excluded.v`);
        checkpoint = hi;
        onProgress({ stage: 'copy', through: hi, totalGauges: gauges.length, rowsWritten });
    }
    let quarters = 0, hours = 0;
    for (const [lo, hi] of batches) {
        const checked = (await query(verifySQL(lo, hi))).results[0];
        if (checked.missing || checked.extra) throw new Error(`Final verification failed for ${lo}..${hi}: ${JSON.stringify(checked)}`);
        quarters += checked.quarters; hours += checked.hours;
        onProgress({ stage: 'verify', through: hi, quarters, hours });
    }
    if (JSON.stringify((await query(sourceSQL)).results) !== JSON.stringify(sourceMeta))
        throw new Error('Ingest metadata changed during migration; confirm ingest is paused before resuming');
    for (const [lo, hi] of batches) await query(coverageSQL(lo, hi));
    const coverage = (await query("SELECT COUNT(*) AS n FROM gauge_sync_state WHERE coverage_start < (SELECT v FROM sync_meta WHERE k='hourly_seed_from') OR repair_from < (SELECT v FROM sync_meta WHERE k='hourly_seed_from')")).results[0];
    if (coverage.n !== 0) throw new Error('Coverage verification failed');
    await query("INSERT INTO sync_meta(k,v) VALUES('hourly_migration_complete',unixepoch('now')*1000) ON CONFLICT(k) DO NOTHING");
    return { seedFrom, gauges: gauges.length, quarters, hours, rowsWritten, sourceMeta, initialSyncState: initialState.results };
}

/** All migration writes are idempotent; transient API responses can safely retry. */
export function remoteQuery({ endpoint, token, fetcher = fetch,
    wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now,
    onRetry = () => {} }) {
    let previousRequest = -Infinity;
    return async sql => {
        let result;
        for (const statement of splitStatements(sql)) {
            for (let attempt = 0; attempt < 5; attempt++) {
                await wait(Math.max(0, previousRequest + 350 - now()));
                previousRequest = now();
                const credential = token();
                if (!credential) throw new Error('No Cloudflare credential; refresh Wrangler OAuth before running');
                const response = await fetcher(endpoint, {
                    method: 'POST', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql: statement }), signal: AbortSignal.timeout(90000),
                });
                if ((response.status === 429 || response.status >= 500) && attempt < 4) {
                    const delay = Math.max(1000, Number(response.headers.get('retry-after') ?? 2 ** attempt) * 1000);
                    onRetry({ status: response.status, delayMs: delay, attempt: attempt + 1 });
                    await response.body?.cancel();
                    await wait(delay);
                    continue;
                }
                const body = await response.json();
                if (!response.ok || !body.success || body.result.some(r => !r.success))
                    throw new Error(`D1 HTTP ${response.status}: ${JSON.stringify(body.errors ?? body.result)}`);
                result = body.result.at(-1);
                break;
            }
        }
        return result;
    };
}

async function main() {
    const { values } = parseArgs({ options: {
        remote: { type: 'boolean' }, paused: { type: 'boolean' }, account: { type: 'string' }, database: { type: 'string' },
        'oauth-config': { type: 'string' }, 'local-file': { type: 'string' }, report: { type: 'string' },
        'batch-size': { type: 'string', default: '20' },
    } });
    if (!values.report) throw new Error('--report is required to save rollback state and verification');
    let query, close = () => {};
    if (values.remote) {
        if (!values.paused || !values.account || !values.database) throw new Error('Remote migration requires --paused, --account and --database');
        query = remoteQuery({
            endpoint: `https://api.cloudflare.com/client/v4/accounts/${values.account}/d1/database/${values.database}/query`,
            token: () => values['oauth-config']
                ? readFileSync(values['oauth-config'], 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1]
                : process.env.CLOUDFLARE_API_TOKEN,
            onRetry: retry => console.log(JSON.stringify({ stage: 'retry', ...retry })),
        });
    } else {
        if (!values['local-file']) throw new Error('Choose --remote or --local-file');
        const { DatabaseSync } = await import('node:sqlite');
        const db = new DatabaseSync(values['local-file']);
        close = () => db.close();
        query = async sql => {
            if (/^\s*(SELECT|WITH expected)/.test(sql)) return { results: db.prepare(sql).all() };
            const before = db.prepare('SELECT total_changes() AS n').get().n;
            db.exec(sql);
            return { results: [], meta: { changes: db.prepare('SELECT total_changes() AS n').get().n - before } };
        };
    }
    try {
        const rollback = (await query('SELECT * FROM gauge_sync_state ORDER BY gauge_key')).results;
        if (!existsSync(values.report + '.rollback.json')) writeFileSync(values.report + '.rollback.json', JSON.stringify(rollback));
        const result = await runMigration(query, { batchSize: Number(values['batch-size']), onProgress: p => console.log(JSON.stringify(p)) });
        writeFileSync(values.report, JSON.stringify({ completedAt: new Date().toISOString(), ...result }, null, 2));
        console.log(JSON.stringify({ complete: true, ...result, initialSyncState: undefined }));
    } finally { close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
