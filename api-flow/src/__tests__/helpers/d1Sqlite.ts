import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * A D1Database implementation backed by an in-memory `node:sqlite` database.
 *
 * The store layer leans on non-obvious SQLite behavior — `json_each` unpacking,
 * WITHOUT ROWID clustering, `ON CONFLICT DO UPDATE` with COALESCE preservation,
 * and `IN (subquery)` compiling to index seeks. Mocking those out would test
 * nothing, so tests run the real SQL against real SQLite instead.
 *
 * This is a test double for D1's *interface*, not a claim that D1 and SQLite
 * are identical. It deliberately enforces D1's 100-bound-parameter limit so a
 * query that would fail in production fails here too.
 */

const D1_MAX_BOUND_PARAMS = 100;

const MIGRATION = (() => {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(here, "../../../migrations/2026-08-01_flow_history_store.sql"), "utf8");
})();

class SqliteStatement {
    constructor(
        private db: DatabaseSync,
        private sql: string,
        private params: unknown[] = []
    ) {}

    bind(...args: unknown[]): SqliteStatement {
        if (args.length > D1_MAX_BOUND_PARAMS) {
            throw new Error(
                `D1 limit exceeded: ${args.length} bound parameters (max ${D1_MAX_BOUND_PARAMS})`
            );
        }
        return new SqliteStatement(this.db, this.sql, args);
    }

    private normalized(): unknown[] {
        // node:sqlite rejects `undefined` and booleans; D1 coerces them.
        return this.params.map(p => {
            if (p === undefined) return null;
            if (typeof p === "boolean") return p ? 1 : 0;
            return p;
        });
    }

    async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: any }> {
        const stmt = this.db.prepare(this.sql);
        const results = stmt.all(...(this.normalized() as any[])) as T[];
        return { results, success: true, meta: { changes: 0, rows_read: results.length } };
    }

    async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
        const { results } = await this.all<any>();
        const row = results[0];
        if (row === undefined) return null;
        return (col ? row[col] : row) as T;
    }

    async run(): Promise<{ success: true; meta: any }> {
        const stmt = this.db.prepare(this.sql);
        const info = stmt.run(...(this.normalized() as any[]));
        return {
            success: true,
            meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
        };
    }

    async raw<T = unknown[]>(): Promise<T[]> {
        const { results } = await this.all<Record<string, unknown>>();
        return results.map(r => Object.values(r)) as T[];
    }
}

export interface TestD1 extends D1Database {
    /** Escape hatch for assertions that need raw SQL. */
    exec_(sql: string): void;
    query<T = any>(sql: string, ...params: unknown[]): T[];
    close(): void;
}

export function createTestD1(): TestD1 {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(MIGRATION);

    const api = {
        prepare(sql: string) {
            return new SqliteStatement(db, sql) as unknown as D1PreparedStatement;
        },
        async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
            const out: D1Result<T>[] = [];
            db.exec("BEGIN");
            try {
                for (const s of statements) {
                    out.push((await (s as any).run()) as D1Result<T>);
                }
                db.exec("COMMIT");
            } catch (e) {
                db.exec("ROLLBACK");
                throw e;
            }
            return out;
        },
        async exec(sql: string) {
            db.exec(sql);
            return { count: 0, duration: 0 };
        },
        async dump(): Promise<ArrayBuffer> {
            throw new Error("dump() not supported in tests");
        },
        withSession() {
            throw new Error("withSession() not supported in tests");
        },
        exec_(sql: string) {
            db.exec(sql);
        },
        query<T = any>(sql: string, ...params: unknown[]): T[] {
            return db.prepare(sql).all(...(params as any[])) as T[];
        },
        close() {
            db.close();
        },
    };

    return api as unknown as TestD1;
}
