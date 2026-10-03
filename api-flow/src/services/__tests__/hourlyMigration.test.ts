import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigration, copySQL, verifySQL, prepareSQL, splitStatements, remoteQuery } from "../../../tools/hourly-migration.mjs";

function fixture() {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../migrations/2026-08-01_flow_history_store.sql"), "utf8"));
    const now = Math.floor(Date.now() / 3600000) * 3600000 + 1800000;
    const seed = now - 8 * 86400000;
    db.prepare("INSERT INTO sync_meta(k,v) VALUES ('hourly_seed_from',?)").run(seed);
    for (const key of [1, 2, 3]) {
        db.prepare("INSERT INTO gauges(gauge_key,gauge_id,provider) VALUES(?,?,?)").run(key, `USGS:${key}`, "USGS");
        db.prepare("INSERT INTO gauge_sync_state(gauge_key,coverage_start) VALUES(?,?)").run(key, now - 30 * 86400000);
        for (const ts of [seed - 900000, seed, now - 900000, now]) {
            db.prepare("INSERT INTO gauge_readings(gauge_key,slot,ts,off,cfs,ft) VALUES(?,?,?,?,?,?)")
                .run(key, Math.floor(ts / 900000) % 3072, ts, key * 60, key, null);
        }
    }
    const query = async (sql: string) => {
        if (/^\s*(SELECT|WITH expected)/.test(sql)) return { results: db.prepare(sql).all() };
        const before = db.prepare("SELECT total_changes() AS n").get()!.n as number;
        db.exec(sql);
        return { results: [], meta: { changes: (db.prepare("SELECT total_changes() AS n").get()!.n as number) - before } };
    };
    return { db, seed, query };
}

describe("batched hourly migration", () => {
    it("sends only executable schema statements, with no full-history copy", () => {
        const statements = splitStatements(prepareSQL);
        expect(statements).toHaveLength(3);
        expect(statements.map(s => s.split(" ")[0])).toEqual(["CREATE", "INSERT", "CREATE"]);
        expect(statements.join(";")).not.toContain("INSERT OR IGNORE INTO gauge_reading_hours");
        expect(splitStatements("/* comment with ; */ SELECT 1; -- only comment")).toEqual(["SELECT 1"]);
    });

    it("paces remote statements and safely retries transient API failures", async () => {
        let time = 0;
        const requests: Array<{ time: number; sql: string }> = [];
        const query = remoteQuery({ endpoint: "https://example.invalid/query", token: () => "test",
            now: () => time, wait: async ms => { time += ms; },
            fetcher: async (_url, init) => {
                requests.push({ time, sql: JSON.parse(String(init!.body)).sql });
                if (requests.length === 1) return new Response("{}", { status: 503 });
                if (requests.length === 2) return new Response("{}", { status: 429, headers: { "retry-after": "1" } });
                return new Response(JSON.stringify({ success: true, result: [{ success: true, results: [{ n: 1 }] }] }));
            },
        });
        expect((await query("SELECT 1; /* trailing ; comment */ SELECT 2;")).results).toEqual([{ n: 1 }]);
        expect(requests.map(r => r.sql)).toEqual(["SELECT 1", "SELECT 1", "SELECT 1", "SELECT 2"]);
        expect(requests.slice(1).map((r, i) => r.time - requests[i].time)).toEqual([1000, 1000, 350]);
    });

    it("resumes an interrupted copy, verifies every retained value and only then adjusts coverage", async () => {
        const { db, seed, query } = fixture();
        try {
            let interrupted = false;
            await expect(runMigration(query, { batchSize: 1, onProgress: () => { if (!interrupted) { interrupted = true; throw new Error("interrupted"); } } }))
                .rejects.toThrow("interrupted");
            expect(db.prepare("SELECT v FROM sync_meta WHERE k='hourly_copy_through'").get()).toEqual({ v: 1 });
            expect(db.prepare("SELECT MIN(coverage_start) AS c FROM gauge_sync_state").get()!.c).toBeLessThan(seed);
            const complete = await runMigration(query, { batchSize: 2 });
            expect(complete.quarters).toBe(9);
            expect(complete.hours).toBe(6);
            expect(db.prepare("SELECT DISTINCT coverage_start AS c FROM gauge_sync_state").all()).toEqual([{ c: seed }]);
            const replay = await runMigration(query, { batchSize: 1 });
            expect(replay.rowsWritten).toBe(0);
            expect(db.prepare("SELECT COUNT(*) AS n FROM gauge_readings").get()).toEqual({ n: 12 });
            const plan = db.prepare(`EXPLAIN QUERY PLAN ${copySQL(1, 1)}`).all();
            expect(JSON.stringify(plan)).toContain("SEARCH gauge_readings USING PRIMARY KEY");
        } finally { db.close(); }
    });

    it("rejects a concurrent ingest before changing coverage", async () => {
        const { db, seed, query } = fixture();
        try {
            let changed = false;
            await expect(runMigration(query, { onProgress: () => {
                if (!changed) { changed = true; db.exec("INSERT INTO sync_meta(k,v) VALUES ('usgs_window_ok_at',42)"); }
            } })).rejects.toThrow("Ingest metadata changed");
            expect(db.prepare("SELECT MIN(coverage_start) AS c FROM gauge_sync_state").get()!.c).toBeLessThan(seed);
        } finally { db.close(); }
    });

    it("rejects corrupted copied data before claiming coverage", async () => {
        const { db, seed, query } = fixture();
        try {
            await expect(runMigration(query, { batchSize: 1, onProgress: () => { throw new Error("interrupted"); } })).rejects.toThrow();
            db.exec("UPDATE gauge_reading_hours SET q0='[0,999,null,null,null,null,null]' WHERE gauge_key=1");
            const mismatch = (await query(verifySQL(1, 1))).results[0] as { extra: number };
            expect(mismatch.extra).toBeGreaterThan(0);
            await expect(runMigration(query, { batchSize: 1 })).rejects.toThrow("Final verification failed");
            expect(db.prepare("SELECT MIN(coverage_start) AS c FROM gauge_sync_state").get()!.c).toBeLessThan(seed);
            expect(db.prepare("SELECT v FROM sync_meta WHERE k='hourly_migration_complete'").get()).toBeUndefined();
        } finally { db.close(); }
    });
});
