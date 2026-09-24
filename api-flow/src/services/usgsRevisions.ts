import { fetchOGCFeatures, USGS_API_BASE } from "./usgs";
import { RETENTION_MS } from "./flowStore";

/**
 * Daily cross-check against USGS's formal revision ledger.
 *
 * `time-series-revisions` records post-approval corrections with a
 * human-readable note and the exact period revised, e.g.
 *
 *   "A revision to the Gage Height time series was made on March 28, 2024,
 *    when a datum correction was applied to the primary reference gage. The
 *    period to be revised is from July 7, 2017, to March 28, 2024."
 *
 * This is a *secondary* signal. The `last_modified` cursor in
 * usgsIncremental.ts is what actually keeps stored data correct, and it already
 * catches these because a revision necessarily touches the records. Two things
 * limit this collection's usefulness:
 *
 *  - There is no queryable for when a revision was *published*, only the period
 *    it covers — so new ones are detected by diffing against ids we have seen.
 *  - Most revisions are historical (1979, 2017-2024) and fall outside a 30-day
 *    retention window entirely.
 *
 * So its real value is as an audit trail, plus a forced re-fetch on the rare
 * revision that does overlap what we retain. It would become materially more
 * important if retention were ever extended.
 */

// Built lazily rather than at module load: this module sits in an import cycle
// with usgs.ts (via flowSync -> index -> usgs), and reading an imported const at
// module-init time can observe a partially-initialized namespace.
export const revisionsUrl = () =>
    `${USGS_API_BASE}/time-series-revisions/items?f=json&limit=10000`;

export const REVISION_FETCH_TIMEOUT_MS = 60_000;

export interface RevisionRecord {
    revisionId: string;
    gaugeId: string;
    beginTs: number | null;
    endTs: number | null;
    note: string;
}

export function parseRevisions(features: any[]): RevisionRecord[] {
    const out: RevisionRecord[] = [];

    for (const feature of features ?? []) {
        const props = feature?.properties ?? {};
        const revisionId = props.id ?? feature?.id;
        if (!revisionId) continue;

        const rawLocation: string = props.monitoring_location_id ?? "";
        const bare = rawLocation.replace(/^USGS-/i, "");
        if (!bare) continue;

        const toTs = (v: unknown): number | null => {
            if (typeof v !== "string" || !v) return null;
            const t = new Date(v).getTime();
            return isNaN(t) ? null : t;
        };

        out.push({
            revisionId: String(revisionId),
            gaugeId: `USGS:${bare}`,
            beginTs: toTs(props.begin),
            endTs: toTs(props.end),
            note: String(props.revision_note ?? "").slice(0, 1000),
        });
    }

    return out;
}

/** True if the revised period intersects what we still retain. */
export function overlapsRetention(rev: RevisionRecord, now: number): boolean {
    const horizon = now - RETENTION_MS;
    // An open-ended revision is treated as reaching the present.
    const begin = rev.beginTs ?? Number.NEGATIVE_INFINITY;
    const end = rev.endTs ?? now;
    return end >= horizon && begin <= now;
}

export interface RevisionPollResult {
    fetched: number;
    unseen: number;
    overlapping: RevisionRecord[];
}

/**
 * Polls the ledger, records revisions we have not seen before, and returns the
 * subset whose revised period overlaps retained data — those gauges get their
 * cursor reset so the next ingest cycle re-reads the affected range.
 */
export async function pollUsgsRevisions(
    db: D1Database,
    env: any,
    now: number = Date.now(),
    deps: { fetchFeatures?: typeof fetchOGCFeatures } = {}
): Promise<RevisionPollResult> {
    const fetchFeatures = deps.fetchFeatures ?? fetchOGCFeatures;
    const features = await fetchFeatures(revisionsUrl(), REVISION_FETCH_TIMEOUT_MS, env);
    const revisions = parseRevisions(features);

    if (revisions.length === 0) return { fetched: 0, unseen: 0, overlapping: [] };

    // Only consider revisions for gauges we actually track.
    const trackedJson = JSON.stringify([...new Set(revisions.map(r => r.gaugeId))]);
    const { results: tracked } = await db.prepare(`
        SELECT g.gauge_id AS gauge_id
          FROM gauges g
          JOIN json_each(?1) j ON g.gauge_id = j.value
    `).bind(trackedJson).all<{ gauge_id: string }>();

    const trackedSet = new Set((tracked ?? []).map(r => r.gauge_id));
    const relevant = revisions.filter(r => trackedSet.has(r.gaugeId));
    if (relevant.length === 0) return { fetched: revisions.length, unseen: 0, overlapping: [] };

    // Which of these have we already recorded?
    const idsJson = JSON.stringify(relevant.map(r => r.revisionId));
    const { results: known } = await db.prepare(`
        SELECT r.revision_id AS revision_id
          FROM usgs_revisions_seen r
          JOIN json_each(?1) j ON r.revision_id = j.value
    `).bind(idsJson).all<{ revision_id: string }>();

    const knownSet = new Set((known ?? []).map(r => r.revision_id));
    const unseen = relevant.filter(r => !knownSet.has(r.revisionId));
    if (unseen.length === 0) return { fetched: revisions.length, unseen: 0, overlapping: [] };

    const overlapping = unseen.filter(r => overlapsRetention(r, now));

    await db.prepare(`
        INSERT INTO usgs_revisions_seen
              (revision_id, gauge_id, begin_ts, end_ts, note, first_seen_at, applied_at)
        SELECT j.value->>'$.i', j.value->>'$.g', j.value->>'$.b', j.value->>'$.e',
               j.value->>'$.n', ?2, j.value->>'$.a'
          FROM json_each(?1) j
         WHERE true
        ON CONFLICT(revision_id) DO NOTHING
    `).bind(
        JSON.stringify(unseen.map(r => ({
            i: r.revisionId, g: r.gaugeId, b: r.beginTs, e: r.endTs, n: r.note,
            a: overlapsRetention(r, now) ? now : null,
        }))),
        now
    ).run();

    // Rewind the cursor to the start of the revised period so the next ingest
    // cycle re-reads it. This is the only place a cursor moves backwards.
    if (overlapping.length > 0) {
        await db.prepare(`
            UPDATE gauge_sync_state
               SET cursor_modified = NULL
             WHERE gauge_key IN (
                 SELECT g.gauge_key FROM gauges g
                   JOIN json_each(?1) j ON g.gauge_id = j.value
             )
        `).bind(JSON.stringify(overlapping.map(r => r.gaugeId))).run();
    }

    return { fetched: revisions.length, unseen: unseen.length, overlapping };
}
