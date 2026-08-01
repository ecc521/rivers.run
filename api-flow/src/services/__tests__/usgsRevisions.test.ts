import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import { parseRevisions, overlapsRetention, pollUsgsRevisions } from "../usgsRevisions";
import { resolveGaugeKeys, writeSyncState, RETENTION_MS } from "../flowStore";

const NOW = 1_779_999_900_000;
const DAY = 86_400_000;

let db: TestD1;
beforeEach(() => { db = createTestD1(); });
afterEach(() => { db.close(); });

/** Shaped exactly like real time-series-revisions records. */
const revision = (id: string, site: string, begin: string, end: string, note = "Revision: ...") => ({
    properties: {
        id,
        monitoring_location_id: `USGS-${site}`,
        time_series_id: "abc123",
        revision_note: note,
        begin,
        end,
    },
});

const track = async (gaugeIds: string[]) =>
    resolveGaugeKeys(db, gaugeIds.map(gaugeId => ({
        gaugeId, provider: "USGS", tier: "linked" as const,
    })));

describe("parseRevisions", () => {
    it("parses a real ledger record", () => {
        const [rev] = parseRevisions([revision(
            "00e1dd1b-a885-4b03-a8dc-03e2f607f950", "07361500",
            "2017-07-07T16:05:00+00:00", "2024-03-28T13:00:00+00:00",
            "A datum correction was applied to the primary reference gage."
        )]);

        expect(rev.revisionId).toBe("00e1dd1b-a885-4b03-a8dc-03e2f607f950");
        expect(rev.gaugeId).toBe("USGS:07361500");
        expect(rev.beginTs).toBe(new Date("2017-07-07T16:05:00+00:00").getTime());
        expect(rev.note).toContain("datum correction");
    });

    it("skips records without an id or location", () => {
        expect(parseRevisions([
            { properties: { monitoring_location_id: "USGS-1" } },
            { properties: { id: "x" } },
            null,
        ])).toEqual([]);
    });
});

describe("overlapsRetention", () => {
    const rev = (beginTs: number | null, endTs: number | null) =>
        ({ revisionId: "r", gaugeId: "USGS:1", beginTs, endTs, note: "" });

    it("ignores revisions entirely older than the horizon", () => {
        // The common case: most USGS revisions are historical (1979, 2017-2024).
        expect(overlapsRetention(rev(NOW - 400 * DAY, NOW - 300 * DAY), NOW)).toBe(false);
    });

    it("catches a revision reaching into the retained window", () => {
        expect(overlapsRetention(rev(NOW - 400 * DAY, NOW - 5 * DAY), NOW)).toBe(true);
    });

    it("treats an open-ended revision as reaching the present", () => {
        expect(overlapsRetention(rev(NOW - 2 * DAY, null), NOW)).toBe(true);
    });

    it("sits exactly on the horizon boundary", () => {
        expect(overlapsRetention(rev(NOW - 400 * DAY, NOW - RETENTION_MS), NOW)).toBe(true);
        expect(overlapsRetention(rev(NOW - 400 * DAY, NOW - RETENTION_MS - 1), NOW)).toBe(false);
    });
});

describe("pollUsgsRevisions", () => {
    it("records unseen revisions for tracked gauges only", async () => {
        await track(["USGS:07361500"]);

        const result = await pollUsgsRevisions(db, {}, NOW, {
            fetchFeatures: async () => [
                revision("rev-1", "07361500", "2017-07-07T16:05:00Z", "2024-03-28T13:00:00Z"),
                revision("rev-2", "99999999", "2017-07-07T16:05:00Z", "2024-03-28T13:00:00Z"),
            ],
        });

        expect(result.fetched).toBe(2);
        expect(result.unseen).toBe(1);

        const rows = db.query("SELECT revision_id, gauge_id FROM usgs_revisions_seen");
        expect(rows).toHaveLength(1);
        expect(rows[0].gauge_id).toBe("USGS:07361500");
    });

    it("is idempotent across polls — a second run finds nothing new", async () => {
        await track(["USGS:07361500"]);
        const features = [revision("rev-1", "07361500", "2017-07-07T16:05:00Z", "2024-03-28T13:00:00Z")];
        const fetchFeatures = async () => features;

        expect((await pollUsgsRevisions(db, {}, NOW, { fetchFeatures })).unseen).toBe(1);
        expect((await pollUsgsRevisions(db, {}, NOW, { fetchFeatures })).unseen).toBe(0);
        expect(db.query("SELECT COUNT(*) AS n FROM usgs_revisions_seen")[0].n).toBe(1);
    });

    it("resets the cursor when a revision overlaps retained data", async () => {
        const keys = await track(["USGS:07361500"]);
        await writeSyncState(db, [{ gaugeId: "USGS:07361500", cursorModified: NOW - 60_000 }], keys);

        const result = await pollUsgsRevisions(db, {}, NOW, {
            fetchFeatures: async () => [revision(
                "rev-1", "07361500",
                new Date(NOW - 10 * DAY).toISOString(),
                new Date(NOW - DAY).toISOString()
            )],
        });

        expect(result.overlapping).toHaveLength(1);
        // A null cursor forces the next ingest cycle to re-read the window.
        expect(db.query("SELECT cursor_modified FROM gauge_sync_state")[0].cursor_modified).toBe(null);
        expect(db.query("SELECT applied_at FROM usgs_revisions_seen")[0].applied_at).toBe(NOW);
    });

    it("leaves the cursor alone for a purely historical revision", async () => {
        const keys = await track(["USGS:07361500"]);
        const cursor = NOW - 60_000;
        await writeSyncState(db, [{ gaugeId: "USGS:07361500", cursorModified: cursor }], keys);

        const result = await pollUsgsRevisions(db, {}, NOW, {
            fetchFeatures: async () => [revision("rev-1", "07361500", "1979-11-15T08:00:00Z", "1979-11-16T08:00:00Z")],
        });

        expect(result.unseen).toBe(1);
        expect(result.overlapping).toHaveLength(0);
        expect(db.query("SELECT cursor_modified FROM gauge_sync_state")[0].cursor_modified).toBe(cursor);
        // Still recorded for the audit trail, just not applied.
        expect(db.query("SELECT applied_at FROM usgs_revisions_seen")[0].applied_at).toBe(null);
    });

    it("no-ops cleanly when the ledger returns nothing", async () => {
        expect(await pollUsgsRevisions(db, {}, NOW, { fetchFeatures: async () => [] }))
            .toEqual({ fetched: 0, unseen: 0, overlapping: [] });
    });
});
