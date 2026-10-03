#!/usr/bin/env node
// Offline verification against a capture.mjs study directory. No Cloudflare access.
// node api-flow/tools/replay-hourly-snapshots.mjs /path/to/usgs-snapshot-study
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const study = process.argv[2];
if (!study) throw new Error('Pass the snapshot study directory');
const temp = mkdtempSync(join(tmpdir(), 'rivers-hourly-replay-'));
const sqlite = new DatabaseSync(':memory:');
try {
    const compiled = join(temp, 'store.cjs');
    buildSync({ entryPoints: [fileURLToPath(new URL('../src/services/flowStore.ts', import.meta.url))],
        outfile: compiled, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
    const { upsertSlots, SLOT_MS, RETENTION_MS } = createRequire(import.meta.url)(compiled);
    const migration = name => readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');
    sqlite.exec(migration('2026-08-01_flow_history_store.sql'));
    const cohort = JSON.parse(readFileSync(join(study, 'cohort.json'))).cohort;
    const report = JSON.parse(readFileSync(join(study, 'report.json')));
    const keys = new Map(cohort.map(g => [g.gauge_id, g.gauge_key]));
    const ids = new Map(cohort.map(g => [g.gauge_key, g.gauge_id]));
    const gauge = sqlite.prepare('INSERT INTO gauges(gauge_key,gauge_id,provider) VALUES(?,?,?)');
    for (const g of cohort) gauge.run(g.gauge_key, g.gauge_id, 'USGS');
    const fields = ['gauge_key', 'slot', 'ts', 'off', 'cfs', 'ft', 'cms', 'm', 'temp_f', 'precip_in'];
    const manifest = s => JSON.parse(readFileSync(join(study, s.name, 'manifest.json')));
    const chunks = (s, c) => JSON.parse(gunzipSync(readFileSync(join(study, s.name, c.name))));
    const insert = sqlite.prepare('INSERT INTO gauge_readings (' + fields.join(',') + ') VALUES (?,?,?,?,?,?,?,?,?,?)');
    sqlite.exec('BEGIN');
    for (const c of manifest(report.snapshots[0]).chunks) for (const r of chunks(report.snapshots[0], c)) insert.run(...r);
    sqlite.exec('COMMIT');
    const seedFrom = Math.floor((Date.parse(manifest(report.snapshots[0]).finishedAt) - 8 * 86400000) / SLOT_MS) * SLOT_MS;
    sqlite.prepare("INSERT INTO sync_meta(k,v) VALUES ('hourly_seed_from',?)").run(seedFrom);
    const migrationStart = performance.now();
    sqlite.exec(migration('2026-10-02_hourly_flow_history.sql'));
    const migrationMs = performance.now() - migrationStart;
    const baselineHourlyRows = sqlite.prepare('SELECT COUNT(*) AS n FROM gauge_reading_hours').get().n;
    const db = {
        prepare(sql) {
            return { bind(...params) { return { runSync() {
                const result = sqlite.prepare(sql).run(...params);
                return { meta: { changes: Number(result.changes) } };
            } }; } };
        },
        async batch(statements) {
            sqlite.exec('BEGIN');
            try { const result = statements.map(s => s.runSync()); sqlite.exec('COMMIT'); return result; }
            catch (e) { sqlite.exec('ROLLBACK'); throw e; }
        },
    };
    const checked = [];
    function check(snapshot) {
        const m = manifest(snapshot);
        const horizon = Math.max(seedFrom, Math.floor((Date.parse(m.finishedAt) - RETENTION_MS) / SLOT_MS) * SLOT_MS);
        let count = 0;
        for (const c of m.chunks) {
            const expected = chunks(snapshot, c).filter(r => r[2] >= horizon).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const actual = sqlite.prepare('SELECT ' + fields.join(',') + ' FROM gauge_reading_slots WHERE gauge_key IN (' + c.gaugeKeys.join(',') + ') AND ts >= ? ORDER BY gauge_key,slot')
                .all(horizon).map(r => fields.map(f => r[f]));
            if (actual.length !== expected.length) throw new Error('Row count mismatch for ' + snapshot.name);
            for (let i = 0; i < actual.length; i++) if (actual[i].some((v, j) => v !== expected[i][j]))
                throw new Error('Reading mismatch: ' + JSON.stringify({ snapshot: snapshot.name, expected: expected[i], actual: actual[i] }));
            count += expected.length;
        }
        checked.push({ snapshot: snapshot.name, readingsVerified: count });
    }
    check(report.snapshots[0]);
    const results = [];
    for (const interval of report.intervals) {
        const diff = JSON.parse(gunzipSync(readFileSync(join(study, interval.diff))));
        const rows = diff.changes.filter(c => c.after[2] >= seedFrom).map(c => {
            const r = c.after;
            return { gaugeId: ids.get(r[0]), ts: r[2], off: r[3], cfs: r[4], ft: r[5], cms: r[6], m: r[7], temp_f: r[8], precip_in: r[9] };
        });
        const written = await upsertSlots(db, rows, keys);
        const replayWrites = await upsertSlots(db, rows, keys);
        if (replayWrites !== 0) throw new Error('Replay wrote ' + replayWrites + ' rows');
        const hours = new Set(rows.map(r => r.gaugeId + ':' + Math.floor(r.ts / 3600000))).size;
        if (written !== hours) throw new Error('Hourly write count mismatch');
        check(report.snapshots.find(s => s.name === interval.after));
        results.push({ interval: interval.before + ' → ' + interval.after, inputChangedReadings: rows.length,
            physicalRowsWritten: written, replayWrites, reductionPercent: 100 * (1 - written / rows.length) });
    }
    const result = { generatedAt: new Date().toISOString(), study: resolve(study), migrationMs,
        seedFrom, baselineHourlyRows,
        verifiedSnapshots: checked, intervals: results,
        note: 'Includes the separately targeted gauge. Net-diff replay coalesces each entire interval; upstream pages may cause additional writes.' };
    writeFileSync(join(study, 'hourly-storage-replay.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
} finally { sqlite.close(); rmSync(temp, { recursive: true, force: true }); }
