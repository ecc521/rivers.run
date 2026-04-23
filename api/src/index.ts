import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { z } from "@hono/zod-openapi";
import { 
    RiverEditorPayload, checkPayloadSize, 
    UserSettingsSchema, CommunityListSchema, 
    SubscriptionPayloadSchema, AdminResolutionSchema,
    RiverSchema, UserReportPayload, RoleUpdatePayload,
    UserManagementSchema, UserSearchResponse, RiverHistoryResponseSchema
} from "./schema";
import { firebaseAuthMiddleware, requireModerator, requireAdmin, optionalFirebaseAuthMiddleware } from "./auth";
import { sendEmail } from "./email";
import { logToD1 } from "./utils/logger";


type Bindings = {
  DB: D1Database;
  FLOW_STORAGE: R2Bucket;
};

type Variables = {
  user: any;
};

const app = new OpenAPIHono<{ Bindings: Bindings, Variables: Variables }>();

const GenericObjectSchema = z.object({}).passthrough().openapi({ type: 'object' });
const GenericArraySchema = z.array(GenericObjectSchema).openapi({ type: 'array' });



// Generous CORS to permit both rivers.run, apps, and dev variants
app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
}));

// Global error handler
app.onError((err, c) => {
    if (err instanceof z.ZodError) {
         return c.json({ error: "Validation Failed", details: err.issues }, 400);
    }
    console.error(`Internal crash processing ${c.req.url}:`, err);
    return c.json({ error: "Internal Server Error" }, 500);
});

/**
 * RIVERS CORE ENDPOINTS
 */

const getRiversRoute = createRoute({
    method: 'get',
    path: '/rivers',
    summary: 'Fetch all rivers',
    description: 'Returns the full list of rivers, including tags and gauges.',
    responses: {
        200: {
            content: { 'application/json': { schema: z.array(RiverSchema).openapi({ type: 'array' }) } },
            description: 'The list of rivers',
        },
    },
});

const formatRiverRow = (row: any) => {
    let tags: string[] = [];
    try {
        if (typeof row.tags === 'string') {
            const parsed = JSON.parse(row.tags);
            if (Array.isArray(parsed)) {
                tags = parsed;
            } else if (typeof parsed === 'string') {
                // Handle double-stringified or comma-separated strings inside JSON
                tags = parsed.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
        }
    } catch (e) {
        console.warn(`Failed to parse tags for river ${row.id}:`, e);
        if (typeof row.tags === 'string') {
            tags = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
    }

    const formatted = {
        ...row,
        tags,
        gauges: [],
        accessPoints: [],
        flow: {
             unit: row.flow_unit || "cfs",
             min: row.flow_min,
             low: row.flow_low,
             mid: row.flow_mid,
             high: row.flow_high,
             max: row.flow_max
        },
        averagegradient: row.average_gradient,
        maxgradient: row.max_gradient,
        countries: row.countries || "US",
        dam: !!row.dam_released,
        aw: row.aw_id
    };

    try {
        if (typeof row.gauges === 'string' && row.gauges.trim()) {
            formatted.gauges = JSON.parse(row.gauges);
        } else if (Array.isArray(row.gauges)) {
            formatted.gauges = row.gauges;
        }
    } catch (e) {
        console.warn(`Failed to parse gauges for river ${row.id}:`, e);
    }

    try {
        if (typeof row.accessPoints === 'string' && row.accessPoints.trim()) {
            formatted.accessPoints = JSON.parse(row.accessPoints);
        } else if (Array.isArray(row.accessPoints)) {
            formatted.accessPoints = row.accessPoints;
        }
    } catch (e) {
        console.warn(`Failed to parse accessPoints for river ${row.id}:`, e);
    }
    
    // Clean up flat database columns since they are nested or renamed now
    delete formatted.flow_unit;
    delete formatted.flow_min;
    delete formatted.flow_low;
    delete formatted.flow_mid;
    delete formatted.flow_high;
    delete formatted.flow_max;
    delete formatted.average_gradient;
    delete formatted.max_gradient;

    return formatted;
};

app.openapi(getRiversRoute, async (c) => {
    const { results: riversResults } = await c.env.DB.prepare("SELECT * FROM rivers").all();

    const rivers = (riversResults as any[]).map(row => formatRiverRow(row));
    
    // Explicit aggressive caching header to push the massive load physically onto Cloudflare Edge Nodes
    // stale-while-revalidate=86400 allows serving old content while refetching in the background
    c.header("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
    
    return c.json(rivers);
});

const getRiverRoute = createRoute({
    method: 'get',
    path: '/rivers/{id}',
    summary: 'Get river by ID',
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: RiverSchema } }, description: 'The river object' },
        404: { content: { 'application/json': { schema: z.object({ error: z.string() }).openapi({ type: 'object' }) } }, description: 'River not found' }
    }
});

app.openapi(getRiverRoute, async (c) => {
    const id = c.req.param("id");
    
    // Batch retrieve the main river record and its dependencies
    const row = await c.env.DB.prepare("SELECT * FROM rivers WHERE id = ?").bind(id).first();

    if (!row) return c.json({ error: "River not found" }, 404);
    return c.json(formatRiverRow(row));
});

const getRiverHistoryRoute = createRoute({
    middleware: [optionalFirebaseAuthMiddleware], // Masking logic handles privacy
    method: 'get',
    path: '/rivers/{id}/history',
    summary: 'Get edit history for a specific river',
    request: {
        params: z.object({
            id: z.string().openapi({ param: { name: 'id', in: 'path', required: true } })
        }),
        query: z.object({
            limit: z.string().optional().openapi({ param: { name: 'limit', in: 'query' } }),
            offset: z.string().optional().openapi({ param: { name: 'offset', in: 'query' } })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: RiverHistoryResponseSchema } }, description: 'Paginated history' }
    }
});

app.openapi(getRiverHistoryRoute, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
    const offset = parseInt(c.req.query("offset") || "0");

    const isAdmin = user && user.d1Role === 'admin';

    // Join with users table to get display names and emails (for admins)
    const { results } = await c.env.DB.prepare(`
        SELECT a.history_id, a.river_id, a.action_type, a.changed_by, a.changed_at, a.diff_patch,
               u.display_name as editor_name, u.email
        FROM river_audit_log a
        LEFT JOIN users u ON a.changed_by = u.user_id
        WHERE a.river_id = ?
        ORDER BY a.changed_at DESC
        LIMIT ? OFFSET ?
    `).bind(id, limit, offset).all();

    const logs = (results as any[]).map(log => {
        const entry = { ...log };
        
        let diffObj: any = {};
        try {
            diffObj = typeof entry.diff_patch === 'string' ? JSON.parse(entry.diff_patch) : entry.diff_patch;
        } catch {}

        const originalAuthor = diffObj.original_author;
        const isAnonContributor = (originalAuthor && originalAuthor.startsWith("IP:")) || (!originalAuthor && !entry.editor_name);

        // Privacy Masking
        if (!isAdmin) {
            delete entry.changed_by;
            delete entry.email;
            
            if (isAnonContributor) {
                entry.editor_name = "Anonymous Paddler";
            } else {
                entry.editor_name = "User Hidden for Privacy";
            }
        } else {
            // Admin view: provide best available identifier
            if (originalAuthor) {
                entry.editor_name = `Contributor: ${originalAuthor}`;
            } else if (!entry.editor_name) {
                entry.editor_name = entry.email || (entry.changed_by ? `UID: ${entry.changed_by.slice(0, 10)}...` : "Anonymous Paddler");
            }
        }
        return entry;
    });

    const nextOffset = logs.length === limit ? offset + limit : null;

    return c.json({ logs, nextOffset });
});

const deleteRiverRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'delete',
    path: '/rivers/{id}',
    summary: 'Delete a river',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Deleted' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

app.openapi(deleteRiverRoute, async (c) => {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM rivers WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

const updateRiverRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator, checkPayloadSize],
    method: 'put',
    path: '/rivers/{id}',
    summary: 'Update or create a river',
    security: [{ bearerAuth: [] }],
    request: { 
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        }),
        body: { content: { 'application/json': { schema: RiverEditorPayload } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), timestamp: z.number() }).openapi({ type: 'object' }) } }, description: 'Updated' },
        400: { description: 'Validation Error' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

// 2. Direct Admin Edit Wrapper with Delta Patches
app.openapi(updateRiverRoute, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    
    const body = await c.req.json();
    const validated = RiverEditorPayload.parse(body); // Fails explicitly throwing ZodError if bloated

    // We pull original state natively to build physical diff logs safely
    const original = await c.env.DB.prepare("SELECT * FROM rivers WHERE id = ?").bind(id).first();
    let oldPayload = {};
    if (original) {
         oldPayload = formatRiverRow(original);
    }
    
    // Calculate standard JSON delta 
    // (Instead of heavy diff-match-patch we do a lightweight exact field tracker)
    const diff_patch: Record<string, { old: any, new: any }> = {};
    for (const key of Object.keys(validated)) {
         const k = key as keyof typeof validated;
         if (JSON.stringify(validated[k]) !== JSON.stringify((oldPayload as any)[k])) {
              diff_patch[key] = { old: (oldPayload as any)[k], new: validated[k] };
         }
    }

    // Prepare arrays
    const tagsStr = JSON.stringify(validated.tags || []);
    const gaugesStr = JSON.stringify(validated.gauges || []);
    const accessStr = JSON.stringify(validated.accessPoints || []);

    const flowUnit = validated.flow?.unit || "cfs";
    const flowMin = validated.flow?.min ?? null;
    const flowLow = validated.flow?.low ?? null;
    const flowMid = validated.flow?.mid ?? null;
    const flowHigh = validated.flow?.high ?? null;
    const flowMax = validated.flow?.max ?? null;

    const now = Math.floor(Date.now() / 1000);

    // Atomic Execution
    const batch = [];
    if (original) {
        batch.push(c.env.DB.prepare(`
             UPDATE rivers SET name=?, section=?, countries=?, states=?, class=?, skill=?, writeup=?, dam_released=?, aw_id=?, tags=?, gauges=?, accessPoints=?, flow_unit=?, flow_min=?, flow_low=?, flow_mid=?, flow_high=?, flow_max=?, updated_at=? WHERE id=?
        `).bind(
             validated.name, validated.section, validated.countries, validated.states, validated.class,
             validated.skill, validated.writeup, validated.dam ? 1 : 0, validated.aw, tagsStr, gaugesStr, accessStr, 
             flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax, now, id
        ));
    } else {
        batch.push(c.env.DB.prepare(`
             INSERT INTO rivers (id, name, section, countries, states, class, skill, writeup, dam_released, aw_id, tags, gauges, accessPoints, flow_unit, flow_min, flow_low, flow_mid, flow_high, flow_max, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
             id, validated.name, validated.section, validated.countries, validated.states, validated.class,
             validated.skill, validated.writeup, validated.dam ? 1 : 0, validated.aw, tagsStr, gaugesStr, accessStr,
             flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax, now
        ));
    }

    batch.push(c.env.DB.prepare(`
        INSERT INTO river_audit_log (river_id, action_type, changed_by, diff_patch, changed_at) VALUES (?, ?, ?, ?, ?)
    `).bind(
        id, original ? "UPDATE" : "INSERT", user.user_id, JSON.stringify(diff_patch), now
    ));

    await c.env.DB.batch(batch);

    return c.json({ success: true, timestamp: Date.now() });
});

const suggestRiverRoute = createRoute({
    middleware: [optionalFirebaseAuthMiddleware, checkPayloadSize],
    method: 'post',
    path: '/rivers/{id}/suggest',
    summary: 'Submit a correction suggestion',
    security: [{ bearerAuth: [] }, {}],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        }),
        body: { content: { 'application/json': { schema: RiverEditorPayload } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Suggestion submitted' }
    }
});

// 3. User Suggestions (Review Queue)
app.openapi(suggestRiverRoute, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    
    let authorId = user.user_id;
    if (authorId === "anonymous") {
        const ip = c.req.header("CF-Connecting-IP") || "Unknown IP";
        authorId = `IP: ${ip}`;
    }

    const body = await c.req.json();
    const validated = RiverEditorPayload.parse(body);

    await c.env.DB.prepare(`
        INSERT INTO river_suggestions (river_id, suggested_by, proposed_changes, status, created_at) VALUES (?, ?, ?, 'pending', ?)
    `).bind(id, authorId, JSON.stringify(validated), Math.floor(Date.now() / 1000)).run();

    const { results: admins } = await c.env.DB.prepare(`
        SELECT email FROM users 
        WHERE role IN ('admin', 'moderator') 
        AND alerts_review_queue = 1 
        AND email IS NOT NULL 
        AND email != ''
    `).all();
    const adminEmails = admins.map(a => a.email).join(', ');

    if (adminEmails) {
        c.executionCtx.waitUntil(
            sendEmail({
                env: c.env,
                to: adminEmails,
                subject: "Rivers.run: New Suggestion Submission",
                text: "A new river suggestion has been submitted to the queue. Review it here: https://rivers.run/admin",
            })
        );
    }

    return c.json({ success: true });
});

const getAdminQueueRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator],
    method: 'get',
    path: '/admin/queue',
    summary: 'Fetch pending review queue',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: GenericArraySchema } }, description: 'Admin queue' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

// 4. Admin Queue Fetch
app.openapi(getAdminQueueRoute, async (c) => {
    const { results } = await c.env.DB.prepare(`
        SELECT s.*, u.display_name as editor_name, u.email as editor_email
        FROM river_suggestions s
        LEFT JOIN users u ON s.suggested_by = u.user_id
        WHERE s.status = 'pending' 
        ORDER BY s.created_at DESC
    `).all();
    
    // Map fields so the frontend dashboard displays correct metadata
    const mapped = results.map((row: any) => {
        let proposed = {};
        try {
            proposed = typeof row.proposed_changes === 'string' ? JSON.parse(row.proposed_changes) : row.proposed_changes;
        } catch {
            console.error("Failed to parse proposed_changes for suggestion", row.suggestion_id);
        }

        return {
            ...row,
            queueId: row.suggestion_id,
            name: (proposed as any).name || "Unknown River",
            states: (proposed as any).states || "N/A",
            submittedBy: row.editor_name || row.editor_email || row.suggested_by
        };
    });

    return c.json(mapped);
});

const getMySuggestionRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/my-submissions/{id}',
    summary: 'Get your own suggestion (even if rejected) to restore progress',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ param: { name: 'id', in: 'path', required: true } })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: GenericObjectSchema } }, description: 'Suggestion details' },
        403: { description: 'Not your submission' },
        404: { description: 'Not found' }
    }
});

app.openapi(getMySuggestionRoute, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const result = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE suggestion_id = ?").bind(id).first();
    if (!result) return c.json({ error: "Submission not found" }, 404);
    
    if (result.suggested_by !== user.user_id) {
        return c.json({ error: "Access denied: You can only restore your own submissions." }, 403);
    }
    
    return c.json({
        ...result,
        proposed_changes: typeof result.proposed_changes === 'string' ? JSON.parse(result.proposed_changes) : result.proposed_changes
    });
});

const getAdminSuggestionRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator],
    method: 'get',
    path: '/admin/queue/{id}',
    summary: 'Get a specific pending suggestion',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: GenericObjectSchema } }, description: 'Suggestion details' },
        404: { description: 'Not found' }
    }
});

app.openapi(getAdminSuggestionRoute, async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE suggestion_id = ?").bind(id).first();
    if (!result) return c.json({ error: "Suggestion not found" }, 404);
    
    return c.json({
        ...result,
        proposed_changes: typeof result.proposed_changes === 'string' ? JSON.parse(result.proposed_changes) : result.proposed_changes
    });
});

const getAdminLogsRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'get',
    path: '/admin/logs',
    summary: 'Fetch admin audit logs',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            limit: z.string().optional().openapi({ param: { name: 'limit', in: 'query' } }),
            offset: z.string().optional().openapi({ param: { name: 'offset', in: 'query' } })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ results: GenericArraySchema, nextOffset: z.number().nullable() }) } }, description: 'Audit logs' }
    }
});

app.openapi(getAdminLogsRoute, async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
    const offset = parseInt(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare("SELECT * FROM river_audit_log ORDER BY changed_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    const nextOffset = results.length === limit ? offset + limit : null;
    return c.json({ results, nextOffset });
});

const getWorkerLogsRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'get',
    path: '/admin/worker-logs',
    summary: 'Fetch background worker execution logs',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            limit: z.string().optional().openapi({ param: { name: 'limit', in: 'query' } }),
            offset: z.string().optional().openapi({ param: { name: 'offset', in: 'query' } })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ results: GenericArraySchema, nextOffset: z.number().nullable() }) } }, description: 'Worker logs' }
    }
});

app.openapi(getWorkerLogsRoute, async (c) => {
    const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);
    const offset = parseInt(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare("SELECT * FROM worker_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    const nextOffset = results.length === limit ? offset + limit : null;
    return c.json({ results: results || [], nextOffset });
});

const resolveSuggestionRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator, checkPayloadSize],
    method: 'post',
    path: '/admin/queue/{id}/resolve',
    summary: 'Approve or reject a suggestion',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        }),
        body: { content: { 'application/json': { schema: AdminResolutionSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }).openapi({ type: 'object' }) } }, description: 'Resolved' },
        404: { description: 'Not found' }
    }
});

// 5. Admin Resolution of Suggestions
app.openapi(resolveSuggestionRoute, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json();
    const { action, admin_overrides, admin_notes, notify_submitter } = AdminResolutionSchema.parse(body);

    const suggestion = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE suggestion_id = ? AND status = 'pending'").bind(id).first();
    if (!suggestion || !suggestion.proposed_changes) return c.json({ error: "Suggestion not found or already resolved." }, 404);

    const proposed = typeof suggestion.proposed_changes === 'string' ? JSON.parse(suggestion.proposed_changes) : suggestion.proposed_changes;
    if (!proposed) return c.json({ error: "Proposed changes are empty or malformed." }, 400);
    const riverName = proposed.name || "Unknown River";

    const notifyUser = async (isAccepted: boolean) => {
        try {
            if (!notify_submitter) return;
            const suggestedBy = suggestion.suggested_by as string;
            if (suggestedBy.startsWith("IP:")) return;

            const userRecord = await c.env.DB.prepare("SELECT email FROM users WHERE user_id = ?").bind(suggestedBy).first() as { email: string } | null;
            if (!userRecord || !userRecord.email) return;

            const statusLabel = isAccepted ? "accepted" : "rejected";
            const subject = `Rivers.run: Your submission for ${riverName} was ${statusLabel}!`;
            
            let noteHtml = '';
            if (admin_notes && admin_notes.trim()) {
                noteHtml = `
                    <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border-left: 4px solid ${isAccepted ? '#10b981' : '#ef4444'}; color: #334155;">
                        <strong style="display: block; margin-bottom: 5px;">Moderator Note:</strong>
                        ${admin_notes.replace(/\n/g, '<br>')}
                    </div>
                `;
            }

            const restoreLink = `https://rivers.run/edit/${suggestion.river_id}?restore=${id}`;
            const footer = `
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
                <p style="font-size: 12px; color: #64748b; line-height: 1.6;">
                    <strong>Reference ID:</strong> #${id}<br>
                    This is an automated notification from Rivers.run. Responses to this message will be sent to the server administrator. 
                </p>
            `;

            const html = `
                <div style="font-family: sans-serif; max-width: 600px; line-height: 1.5; color: #1e293b;">
                    <h2 style="color: ${isAccepted ? '#059669' : '#b91c1c'};">Submission ${isAccepted ? 'Accepted' : 'Declined'}</h2>
                    <p>Hello,</p>
                    <p>Your submission for <strong>${riverName}</strong> has been <strong>${statusLabel}</strong> by a moderator.</p>
                    
                    ${noteHtml}

                    ${!isAccepted ? `
                        <p><strong>Don't want to lose your progress?</strong></p>
                        <p>You may edit and resubmit your suggestion here:</p>
                        <p><a href="${restoreLink}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Restore & Edit Submission</a></p>
                    ` : `
                        <p>Your changes are now live on <a href="https://rivers.run/river/${suggestion.river_id}">rivers.run</a>. Thank you for contributing to the community!</p>
                    `}

                    ${footer}
                </div>
            `;

            const emailPayload = {
                env: c.env,
                to: userRecord.email,
                subject,
                html
            };

            if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
                c.executionCtx.waitUntil(sendEmail(emailPayload));
            } else {
                await sendEmail(emailPayload);
            }
        } catch (e) {
            console.error("Error in notifyUser:", e);
        }
    };

    if (action === "reject") {
         await c.env.DB.batch([
            c.env.DB.prepare("UPDATE river_suggestions SET status = 'rejected', resolution_note = ? WHERE suggestion_id = ?").bind(admin_notes || null, id),
            c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(
                'REJECT_SUGGESTION', user.user_id, id, `Rejected suggestion for ${riverName}. Note: ${admin_notes || 'No note provided'}`, Math.floor(Date.now() / 1000)
            )
         ]);
         
         await notifyUser(false);
         await logToD1(c.env, "INFO", "admin", `Rejected suggestion ${id} for ${riverName}. Note: ${admin_notes}`);
         return c.json({ success: true, message: "Rejected permanently." });
    }

    // Merging logic
    // 6. Merging logic
    const finalPayload = { ...proposed, ...admin_overrides };
    const validated = RiverEditorPayload.parse(finalPayload); // Fails safely if Overrides break caps

    // Atomic promotion to rivers DB
    const batch = [];
    batch.push(c.env.DB.prepare("UPDATE river_suggestions SET status = 'resolved', resolution_note = ? WHERE suggestion_id = ?").bind(admin_notes || null, id));
    
    const tagsStr = JSON.stringify(validated.tags || []);
    const gaugesStr = JSON.stringify(validated.gauges || []);
    const accessStr = JSON.stringify(validated.accessPoints || []);

    const flowUnit = validated.flow?.unit || "cfs";
    const flowMin = validated.flow?.min ?? null;
    const flowLow = validated.flow?.low ?? null;
    const flowMid = validated.flow?.mid ?? null;
    const flowHigh = validated.flow?.high ?? null;
    const flowMax = validated.flow?.max ?? null;

    const now = Math.floor(Date.now() / 1000);

    // Check if river already exists to decide between INSERT and UPDATE
    const existingRiver = await c.env.DB.prepare("SELECT id FROM rivers WHERE id = ?").bind(suggestion.river_id).first();
    
    if (existingRiver) {
        batch.push(c.env.DB.prepare(`
             UPDATE rivers SET name=?, section=?, countries=?, states=?, class=?, skill=?, writeup=?, dam_released=?, aw_id=?, tags=?, gauges=?, accessPoints=?, flow_unit=?, flow_min=?, flow_low=?, flow_mid=?, flow_high=?, flow_max=?, updated_at=? WHERE id=?
        `).bind(
             validated.name, validated.section, validated.countries, validated.states, validated.class,
             validated.skill, validated.writeup, validated.dam ? 1 : 0, validated.aw, tagsStr, gaugesStr, accessStr, 
             flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax, now, suggestion.river_id
        ));
    } else {
        // If it doesn't exist, we must use the slug from suggestion.river_id or from the overrides
        const finalId = validated.id || suggestion.river_id;
        batch.push(c.env.DB.prepare(`
             INSERT INTO rivers (id, name, section, countries, states, class, skill, writeup, dam_released, aw_id, tags, gauges, accessPoints, flow_unit, flow_min, flow_low, flow_mid, flow_high, flow_max, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
             finalId, validated.name, validated.section, validated.countries, validated.states, validated.class,
             validated.skill, validated.writeup, validated.dam ? 1 : 0, validated.aw, tagsStr, gaugesStr, accessStr,
             flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax, now
        ));
    }

    // Calculate strict JSON delta for the audit log
    let oldPayload = {};
    if (existingRiver) {
         const fullOriginal = await c.env.DB.prepare("SELECT * FROM rivers WHERE id = ?").bind(suggestion.river_id).first();
         if (fullOriginal) oldPayload = formatRiverRow(fullOriginal);
    }

    const diff_patch: Record<string, { old: any, new: any }> = {};
    for (const key of Object.keys(validated)) {
         const k = key as keyof typeof validated;
         if (JSON.stringify(validated[k]) !== JSON.stringify((oldPayload as any)[k])) {
              diff_patch[key] = { old: (oldPayload as any)[k], new: validated[k] };
         }
    }


    
    // Preserve Author ID / IP for administrative visibility
    const cleanAuthor = (suggestion as any).suggested_by as string;

    // Log the math diff
    batch.push(c.env.DB.prepare(`
        INSERT INTO river_audit_log (river_id, action_type, changed_by, diff_patch, changed_at) VALUES (?, ?, ?, ?, ?)
    `).bind(suggestion.river_id, existingRiver ? 'UPDATE' : 'INSERT', user.user_id, JSON.stringify({ diff: diff_patch, note: admin_notes, type: "approval", original_author: cleanAuthor }), now));

    // Formal Admin Audit Log
    batch.push(c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(
        'APPROVE_SUGGESTION', user.user_id, id, `Approved and merged changes for ${riverName}. Note: ${admin_notes || 'No note provided'}`, now
    ));

    try {
        await c.env.DB.batch(batch);
    } catch (e: any) {
        console.error("Batch execution failed:", e.message);
        await logToD1(c.env, "ERROR", "admin", `Failed to resolve suggestion ${id}: ${e.message}`);
        return c.json({ error: "Database update failed", details: e.message }, 500);
    }
    
    await notifyUser(true);

    return c.json({ success: true, message: "Suggestion merged successfully." });
});

const getUserSettingsRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/user/settings',
    summary: 'Get user profile and settings',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: GenericObjectSchema } }, description: 'User settings' }
    }
});

// 6. User Profiles & Settings
app.openapi(getUserSettingsRoute, async (c) => {
    const user = c.get("user");
    const result = await c.env.DB.prepare(`
        SELECT display_name, email, role, notifications_enabled, notifications_none_until, notifications_time_of_day, alerts_review_queue, settings_json
        FROM users WHERE user_id = ?
    `).bind(user.user_id).first();
    
    if (!result) {
        // Auto-provision user record on first hit
        await c.env.DB.prepare(`
            INSERT INTO users (user_id, display_name, email, role, updated_at) 
            VALUES (?, ?, ?, 'user', ?)
        `).bind(user.user_id, user.name || "Unknown Paddler", user.email || "", Math.floor(Date.now() / 1000)).run();
        
        return c.json({
            role: "user",
            notifications: {
                enabled: true,
                noneUntil: 0,
                timeOfDay: "08:00",
                reviewQueueAlerts: false
            },
            settings_json: {}
        });
    }
    
    return c.json({
        role: result.role || "user",
        notifications: {
            enabled: result.notifications_enabled === 1,
            noneUntil: result.notifications_none_until || 0,
            timeOfDay: result.notifications_time_of_day || "08:00",
            reviewQueueAlerts: result.alerts_review_queue === 1
        },
        settings_json: typeof result.settings_json === 'string' ? JSON.parse(result.settings_json) : (result.settings_json || {})
    });
});

const updateUserSettingsRoute = createRoute({
    middleware: [firebaseAuthMiddleware, checkPayloadSize],
    method: 'patch',
    path: '/user/settings',
    summary: 'Update user settings',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: UserSettingsSchema } } } },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Updated' }
    }
});

app.openapi(updateUserSettingsRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const validated = UserSettingsSchema.parse(body);
    
    const updateFields: string[] = ["updated_at = ?"];
    const params: any[] = [Math.floor(Date.now() / 1000)];

    if (validated.notifications) {
        const n = validated.notifications;
        if (n.enabled !== undefined) {
             updateFields.push("notifications_enabled = ?");
             params.push(n.enabled ? 1 : 0);
        }
        if (n.noneUntil !== undefined) {
             updateFields.push("notifications_none_until = ?");
             params.push(n.noneUntil);
        }
        if (n.timeOfDay !== undefined) {
             updateFields.push("notifications_time_of_day = ?");
             params.push(n.timeOfDay);
        }
        if (n.reviewQueueAlerts !== undefined) {
             updateFields.push("alerts_review_queue = ?");
             params.push(n.reviewQueueAlerts ? 1 : 0);
        }
    }

    if (validated.settings_json !== undefined) {
        const existing = await c.env.DB.prepare("SELECT settings_json FROM users WHERE user_id = ?").bind(user.user_id).first();
        let currentSettings = {};
        if (existing && existing.settings_json) {
            currentSettings = typeof existing.settings_json === 'string' ? JSON.parse(existing.settings_json) : existing.settings_json;
        }
        const merged = { ...currentSettings, ...validated.settings_json };
        updateFields.push("settings_json = ?");
        params.push(JSON.stringify(merged));
    }
    
    if (updateFields.length > 1) {
        params.push(user.user_id);
        await c.env.DB.prepare(`UPDATE users SET ${updateFields.join(", ")} WHERE user_id = ?`)
            .bind(...params).run();
    }
    
    return c.json({ success: true });
});

const deleteUserRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'delete',
    path: '/user',
    summary: 'Delete your own account',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Deleted' }
    }
});

app.openapi(deleteUserRoute, async (c) => {
    const user = c.get("user");
    await c.env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(user.user_id).run();
    return c.json({ success: true });
});

const getCommunityListsRoute = createRoute({
    method: 'get',
    path: '/community/lists',
    summary: 'Get all public community lists',
    responses: {
        200: { content: { 'application/json': { schema: GenericArraySchema } }, description: 'Public lists feed' }
    }
});

app.openapi(getCommunityListsRoute, async (c) => {
    // 1. Fetch all published lists and their river mappings
    const [listsRaw, mappingRaw] = await c.env.DB.batch([
        c.env.DB.prepare("SELECT * FROM community_lists WHERE is_published = 1"),
        c.env.DB.prepare(`
            SELECT lr.* FROM community_list_rivers lr
            JOIN community_lists l ON l.id = lr.list_id
            WHERE l.is_published = 1
        `)
    ]);

    const lists = listsRaw.results as any[];
    const mappings = mappingRaw.results as any[];

    // 2. Group mapping identically to the personal /lists endpoint
    const mappingMap = new Map<string, any[]>();
    for (const m of mappings) {
        if (!mappingMap.has(m.list_id)) mappingMap.set(m.list_id, []);
        mappingMap.get(m.list_id)?.push({
            id: m.river_id,
            order: m.sort_order,
            gaugeId: m.gauge_id,
            min: m.min_val,
            max: m.max_val,
            units: m.units,
            customMin: m.custom_min,
            customMax: m.custom_max,
            customUnits: m.custom_units
        });
    }

    // 3. User privacy masking
    const ownerIds = [...new Set(lists.map(l => l.owner_id))];
    const anonMap = new Map<string, boolean>();
    
    if (ownerIds.length > 0) {
        const { results: ownerSettings } = await c.env.DB.prepare(`
            SELECT user_id, settings_json FROM users WHERE user_id IN (${ownerIds.map(() => '?').join(',')})
        `).bind(...ownerIds).all();
        
        (ownerSettings as any[]).forEach(s => {
            try {
                const settings = typeof s.settings_json === 'string' ? JSON.parse(s.settings_json) : s.settings_json;
                if (settings?.hidePublicName) anonMap.set(s.user_id, true);
            } catch {}
        });
    }

    const result = lists.map(l => ({
        ...l,
        ownerId: l.owner_id,
        author: anonMap.get(l.owner_id) ? "Anonymous Paddler" : l.author,
        isPublished: true, 
        rivers: mappingMap.get(l.id) || []
    }));

    // 4. Aggressive CDN Cache (10 min browser, 1 hour edge, 24 hour stale)
    c.header("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
    
    return c.json(result);
});

const getListsRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/lists',
    summary: 'Get your community lists',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: GenericArraySchema } }, description: 'Your lists' }
    }
});

// 7. Lists (Favorites & Community)
app.openapi(getListsRoute, async (c) => {
    const user = c.get("user");
    
    // Batch retrieve user's lists and all associated river mappings
    const [listsRaw, mappingRaw] = await c.env.DB.batch([
        c.env.DB.prepare("SELECT * FROM community_lists WHERE owner_id = ?").bind(user.user_id),
        c.env.DB.prepare(`
            SELECT lr.* FROM community_list_rivers lr
            JOIN community_lists l ON l.id = lr.list_id
            WHERE l.owner_id = ?
        `).bind(user.user_id)
    ]);

    const lists = listsRaw.results as any[];
    const mappings = mappingRaw.results as any[];

    // Group mappings by list_id
    const mappingMap = new Map<string, any[]>();
    for (const m of mappings) {
        if (!mappingMap.has(m.list_id)) mappingMap.set(m.list_id, []);
        mappingMap.get(m.list_id)?.push({
            id: m.river_id,
            order: m.sort_order,
            gaugeId: m.gauge_id,
            min: m.min_val,
            max: m.max_val,
            units: m.units,
            customMin: m.custom_min,
            customMax: m.custom_max,
            customUnits: m.custom_units
        });
    }

    return c.json(lists.map(l => ({
        ...l,
        ownerId: l.owner_id,
        isPublished: l.is_published === 1 || l.is_published === true,
        notificationsEnabled: l.notifications_enabled === 1 || l.notifications_enabled === true,
        rivers: mappingMap.get(l.id) || []
    })));
});

const createListRoute = createRoute({
    middleware: [firebaseAuthMiddleware, checkPayloadSize],
    method: 'post',
    path: '/lists',
    summary: 'Create a new list',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CommunityListSchema } } } },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Created' }
    }
});

app.openapi(createListRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const validated = CommunityListSchema.parse(body);
    const listId = validated.id || crypto.randomUUID();
    
    const queries = [
        c.env.DB.prepare(`
            INSERT INTO community_lists (id, title, description, author, owner_id, is_published, subscribes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(listId, validated.title, validated.description, validated.author, user.user_id, validated.isPublished ? 1 : 0, 0)
    ];

    if (validated.rivers && validated.rivers.length > 0) {
        validated.rivers.forEach(river => {
            queries.push(
                c.env.DB.prepare(`
                    INSERT INTO community_list_rivers (list_id, river_id, sort_order, gauge_id, min_val, max_val, units, custom_min, custom_max, custom_units)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    listId, river.id, river.order, river.gaugeId || null, 
                    river.min || null, river.max || null, river.units || null, 
                    river.customMin || null, river.customMax || null, river.customUnits || null
                )
            );
        });
    }

    await c.env.DB.batch(queries);
    return c.json({ success: true, id: listId });
});

const updateListRoute = createRoute({
    middleware: [firebaseAuthMiddleware, checkPayloadSize],
    method: 'put',
    path: '/lists/{id}',
    summary: 'Update an existing list',
    security: [{ bearerAuth: [] }],
    request: { 
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        }),
        body: { content: { 'application/json': { schema: CommunityListSchema } } } 
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Updated' }
    }
});

// @ts-expect-error Hono OpenAPI TypedResponse mismatch for multiple status codes
app.openapi(updateListRoute, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();
    const validated = CommunityListSchema.parse(body);
    
    // Check ownership
    const existing = await c.env.DB.prepare("SELECT owner_id FROM community_lists WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Not Found" }, 404);
    if (existing.owner_id !== user.user_id && user.d1Role !== 'admin') return c.json({ error: "Forbidden" }, 403);

    const queries = [
        c.env.DB.prepare(`
            UPDATE community_lists 
            SET title = ?, description = ?, author = ?, is_published = ?
            WHERE id = ?
        `).bind(validated.title, validated.description, validated.author, validated.isPublished ? 1 : 0, id),
        // Delete all existing rivers for this list
        c.env.DB.prepare("DELETE FROM community_list_rivers WHERE list_id = ?").bind(id)
    ];

    if (validated.rivers && validated.rivers.length > 0) {
        validated.rivers.forEach(river => {
            queries.push(
                c.env.DB.prepare(`
                    INSERT INTO community_list_rivers (list_id, river_id, sort_order, gauge_id, min_val, max_val, units, custom_min, custom_max, custom_units)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    id, river.id, river.order, river.gaugeId || null, 
                    river.min || null, river.max || null, river.units || null, 
                    river.customMin || null, river.customMax || null, river.customUnits || null
                )
            );
        });
    }

    await c.env.DB.batch(queries);
    return c.json({ success: true });
});

const deleteListRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'delete',
    path: '/lists/{id}',
    summary: 'Delete a list',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Deleted' }
    }
});

// @ts-expect-error Hono OpenAPI TypedResponse mismatch for multiple status codes
app.openapi(deleteListRoute, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    
    const existing = await c.env.DB.prepare("SELECT owner_id FROM community_lists WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Not Found" }, 404);
    if (existing.owner_id !== user.user_id && user.d1Role !== 'admin') return c.json({ error: "Forbidden" }, 403);
    
    await c.env.DB.prepare("DELETE FROM community_lists WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

const getListByIdRoute = createRoute({
    method: 'get',
    path: '/lists/{id}',
    summary: 'Get a specific list by ID',
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: GenericObjectSchema } }, description: 'List object' },
        404: { description: 'Not found' }
    }
});

app.openapi(getListByIdRoute, async (c) => {
    const id = c.req.param("id");
    
    // Batch retrieve list metadata and pinned rivers
    const [listRaw, riversRaw] = await c.env.DB.batch([
        c.env.DB.prepare("SELECT * FROM community_lists WHERE id = ?").bind(id),
        c.env.DB.prepare("SELECT * FROM community_list_rivers WHERE list_id = ?").bind(id)
    ]);

    const list = listRaw.results[0] as any;
    if (!list) return c.json({ error: "List not found" }, 404);
    
    const ownerSettings = await c.env.DB.prepare("SELECT settings_json FROM users WHERE user_id = ?").bind(list.owner_id).first();
    if (ownerSettings && ownerSettings.settings_json) {
        try {
            const s = typeof ownerSettings.settings_json === 'string' ? JSON.parse(ownerSettings.settings_json) : ownerSettings.settings_json;
            if (s.hidePublicName) list.author = "Anonymous Paddler";
        } catch {}
    }
    
    const rivers = (riversRaw.results as any[]).map(rv => ({
        id: rv.river_id,
        order: rv.sort_order,
        gaugeId: rv.gauge_id,
        min: rv.min_val,
        max: rv.max_val,
        units: rv.units,
        customMin: rv.custom_min,
        customMax: rv.custom_max,
        customUnits: rv.custom_units
    }));
    
    return c.json({
        ...list,
        rivers
    });
});

const getSubscriptionsRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/user/subscriptions',
    summary: 'Get your active list subscriptions',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: z.object({ subscriptions: z.array(z.string()) }).openapi({ type: 'object' }) } }, description: 'Subscriptions' }
    }
});

app.openapi(getSubscriptionsRoute, async (c) => {
    const user = c.get("user");
    const { results } = await c.env.DB.prepare("SELECT list_id FROM user_subscriptions WHERE user_id = ?").bind(user.user_id).all();
    return c.json({ subscriptions: (results || []).map(r => r.list_id as string) });
});

const updateSubscriptionsRoute = createRoute({
    middleware: [firebaseAuthMiddleware, checkPayloadSize],
    method: 'put',
    path: '/user/subscriptions',
    summary: 'Bulk update subscriptions',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: SubscriptionPayloadSchema } } } },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Updated' }
    }
});

app.openapi(updateSubscriptionsRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const { subscriptions } = SubscriptionPayloadSchema.parse(body);
    
    const batch = [];
    batch.push(c.env.DB.prepare("DELETE FROM user_subscriptions WHERE user_id = ?").bind(user.user_id));
    for (const listId of subscriptions) {
        batch.push(c.env.DB.prepare("INSERT INTO user_subscriptions (user_id, list_id) VALUES (?, ?)").bind(user.user_id, listId));
    }
    
    await c.env.DB.batch(batch);
    return c.json({ success: true });
});

// 8. Admin Controls (Role Management & Bans)
const updateUserRoleRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'patch',
    path: '/admin/users/{id}/role',
    summary: 'Change user role (with hierarchy protection)',
    security: [{ bearerAuth: [] }],
    request: { 
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        }),
        body: { content: { 'application/json': { schema: RoleUpdatePayload } } }
    },
    responses: { 
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Role updated' },
        403: { content: { 'application/json': { schema: z.object({ error: z.string() }).openapi({ type: 'object' }) } }, description: 'Hierarchy violation' },
        404: { content: { 'application/json': { schema: z.object({ error: z.string() }).openapi({ type: 'object' }) } }, description: 'User not found' }
    }
});

app.openapi(updateUserRoleRoute, async (c) => {
    const id = c.req.param("id");
    const caller = c.get("user");
    const body = await c.req.json();
    const { role: newRole, reason } = RoleUpdatePayload.parse(body);

    // Fetch target current state
    const target = await c.env.DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(id).first() as { role: string } | null;
    if (!target) return c.json({ error: "User not found" }, 404) as any;

    // Hierarchy Guardrails
    if (caller.d1Role === 'admin') {
        // 1. Admins cannot touch fellow Admins or Super-Admins
        if (target.role === 'admin' || target.role === 'super-admin') {
            return c.json({ error: "Insufficient permissions: Cannot modify an Admin or Super-Admin." }, 403) as any;
        }
        // 2. Admins cannot promote anyone to Admin or Super-Admin
        if (newRole === 'admin' || newRole === 'super-admin') {
            return c.json({ error: "Insufficient permissions: Cannot grant Admin or Super-Admin roles." }, 403) as any;
        }
    }

    // Atomic Update
    await c.env.DB.batch([
        c.env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE user_id = ?").bind(newRole, Math.floor(Date.now() / 1000), id),
        c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(
            'CHANGE_ROLE', caller.user_id, id, `Role changed to ${newRole}. Note: ${reason || 'No reason provided'}`, Math.floor(Date.now() / 1000)
        )
    ]);

    return c.json({ success: true }) as any;
});

const getAdminUsersRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'get',
    path: '/admin/users',
    summary: 'Search for users in D1',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            q: z.string().openapi({
                param: {
                    name: 'q',
                    in: 'query',
                    required: false
                }
            }).optional()
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: UserSearchResponse } }, description: 'Search results' }
    }
});

app.openapi(getAdminUsersRoute, async (c) => {
    const q = c.req.query("q") || "";
    const { results } = await c.env.DB.prepare(`
        SELECT user_id, display_name, email, role, updated_at 
        FROM users 
        WHERE email = ? OR user_id = ?
        LIMIT 50
    `).bind(q, q).all();
    
    return c.json(results as any);
});

const getAdminUserByIdRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'get',
    path: '/admin/users/{id}',
    summary: 'Get full user record',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: UserManagementSchema } }, description: 'User details' },
        404: { description: 'User not found' }
    }
});

app.openapi(getAdminUserByIdRoute, async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("SELECT user_id, display_name, email, role, updated_at FROM users WHERE user_id = ?").bind(id).first();
    if (!result) return c.json({ error: "User not found" }, 404);
    return c.json(result);
});

const banUserRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'put',
    path: '/admin/users/{id}/ban',
    summary: 'Legacy Ban shortcut (uses hierarchy logic)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: { 
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Banned' },
        403: { content: { 'application/json': { schema: z.object({ error: z.string() }).openapi({ type: 'object' }) } }, description: 'Hierarchy violation' }
    }
});

app.openapi(banUserRoute, async (c) => {
    const id = c.req.param("id");
    const caller = c.get("user");
    
    const target = await c.env.DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(id).first() as { role: string } | null;
    if (target && caller.d1Role === 'admin' && (target.role === 'admin' || target.role === 'super-admin')) {
         return c.json({ error: "Cannot ban an Admin." }, 403) as any;
    }

    await c.env.DB.batch([
        c.env.DB.prepare("UPDATE users SET role = 'banned' WHERE user_id = ?").bind(id),
        c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind('BAN_USER', caller.user_id, id, 'Banned via shortcut', Math.floor(Date.now() / 1000))
    ]);
    return c.json({ success: true }) as any;
});

const unbanUserRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'put',
    path: '/admin/users/{id}/unban',
    summary: 'Legacy Unban shortcut (uses hierarchy logic)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: { 
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Unbanned' },
        403: { content: { 'application/json': { schema: z.object({ error: z.string() }).openapi({ type: 'object' }) } }, description: 'Hierarchy violation' }
    }
});

app.openapi(unbanUserRoute, async (c) => {
    const id = c.req.param("id");
    const caller = c.get("user");

    const target = await c.env.DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(id).first() as { role: string } | null;
    if (target && caller.d1Role === 'admin' && (target.role === 'admin' || target.role === 'super-admin')) {
        return c.json({ error: "Cannot modify an Admin." }, 403) as any;
    }

    await c.env.DB.batch([
        c.env.DB.prepare("UPDATE users SET role = 'user' WHERE user_id = ?").bind(id),
        c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind('UNBAN_USER', caller.user_id, id, 'Unbanned via shortcut', Math.floor(Date.now() / 1000))
    ]);
    return c.json({ success: true }) as any;
});

const deleteAdminUserRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'delete',
    path: '/admin/users/{id}',
    summary: 'Permanently delete a user and all their data (Admin only)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: { 
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Deleted' },
        403: { description: 'Hierarchy violation' },
        404: { description: 'User not found' }
    }
});

app.openapi(deleteAdminUserRoute, async (c) => {
    const id = c.req.param("id");
    const caller = c.get("user");

    const target = await c.env.DB.prepare("SELECT role FROM users WHERE user_id = ?").bind(id).first() as { role: string } | null;
    if (!target) return c.json({ error: "User not found" }, 404) as any;

    // Hierarchy Guard
    if (caller.d1Role === 'admin' && (target.role === 'admin' || target.role === 'super-admin')) {
        return c.json({ error: "Insufficient permissions: Cannot delete an Admin." }, 403) as any;
    }

    // Cascade delete via batching for safety (D1 doesn't always handle foreign key cascades as expected in all drivers)
    await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM community_lists WHERE owner_id = ?").bind(id),
        c.env.DB.prepare("DELETE FROM river_suggestions WHERE suggested_by = ?").bind(id),
        c.env.DB.prepare("DELETE FROM user_reports WHERE reported_by = ?").bind(id),
        c.env.DB.prepare("DELETE FROM user_subscriptions WHERE user_id = ?").bind(id),
        c.env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(id),
        c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(
            'DELETE_USER', caller.user_id, id, 'User and all associated data purged.', Math.floor(Date.now() / 1000)
        )
    ]);

    return c.json({ success: true }) as any;
});

const adminSendEmailRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'post',
    path: '/admin/email',
    summary: 'Send an administrative email to a user',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        to: z.string().email(),
                        subject: z.string().min(1),
                        body: z.string().min(1)
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Email sent' },
        403: { description: 'Unauthorized' }
    }
});

app.openapi(adminSendEmailRoute, async (c) => {
    const caller = c.get("user");
    const { to, subject, body } = await c.req.json();

    const adminFooterText = `\n\n---\nThis email was sent by a rivers.run admin. Views expressed in this message do not necessarily reflect those of rivers.run. Any contract express or implied is void. Responses to this message will be sent to the server administrator.`;
    const adminFooterHtml = `
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
        <p style="font-size: 12px; color: #64748b; line-height: 1.6;">
            This email was sent by a <strong>rivers.run admin</strong>. Views expressed in this message do not necessarily reflect those of rivers.run. Any contract express or implied is void. Responses to this message will be sent to the server administrator.
        </p>
    `;

    await sendEmail({
        env: c.env as any,
        to,
        subject,
        text: body + adminFooterText,
        html: `<div style="font-family: sans-serif; white-space: pre-wrap; color: #1e293b;">${body}</div>` + adminFooterHtml
    });


    c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)")
            .bind('SEND_EMAIL', caller.user_id, null, `Emailed ${to}: ${subject}`, Math.floor(Date.now() / 1000))
            .run()
    );

    return c.json({ success: true });
});

// 9. API Reporting (UGC)
const createReportRoute = createRoute({
    middleware: [optionalFirebaseAuthMiddleware, checkPayloadSize],
    method: 'post',
    path: '/reports',
    summary: 'Submit a UGC report (Flag content)',
    security: [{ bearerAuth: [] }, {}],
    request: { body: { content: { 'application/json': { schema: UserReportPayload } } } },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Reported' } }
});

app.openapi(createReportRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const validated = UserReportPayload.parse(body);

    let authorId = user.user_id;
    if (authorId === "anonymous") {
        const ip = c.req.header("CF-Connecting-IP") || "Unknown IP";
        authorId = `IP: ${ip}`;
    }

    await c.env.DB.prepare(`
        INSERT INTO user_reports (target_id, type, reason, reported_by, reporter_email, status, created_at) 
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).bind(validated.target_id, validated.type, validated.reason, authorId, validated.email || null, Math.floor(Date.now() / 1000)).run();

    const { results: admins } = await c.env.DB.prepare(`
        SELECT email FROM users 
        WHERE role IN ('admin', 'moderator') 
        AND alerts_review_queue = 1 
        AND email IS NOT NULL 
        AND email != ''
    `).all();
    const adminEmails = admins.map(a => a.email).join(', ');

    if (adminEmails) {
        c.executionCtx.waitUntil(
            sendEmail({
                env: c.env,
                to: adminEmails,
                subject: "Rivers.run: New User Report",
                text: "A new user report has been submitted to the queue. Review it here: https://rivers.run/admin",
            })
        );
    }

    return c.json({ success: true });
});

const getAdminReportsRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator],
    method: 'get',
    path: '/admin/reports',
    summary: 'Fetch pending UGC reports',
    security: [{ bearerAuth: [] }],
    responses: { 200: { content: { 'application/json': { schema: GenericArraySchema } }, description: 'Admin reports queue' } }
});

app.openapi(getAdminReportsRoute, async (c) => {
    const { results } = await c.env.DB.prepare(`
        SELECT r.*, u.display_name as reporter_name
        FROM user_reports r
        LEFT JOIN users u ON r.reported_by = u.user_id
        WHERE r.status = 'pending' 
        ORDER BY r.created_at DESC
    `).all();
    return c.json(results);
});

const resolveReportRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator],
    method: 'post',
    path: '/admin/reports/{id}/resolve',
    summary: 'Resolve a user report',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({
                param: {
                    name: 'id',
                    in: 'path',
                    required: true
                }
            })
        })
    },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }).openapi({ type: 'object' }) } }, description: 'Resolved' } }
});

app.openapi(resolveReportRoute, async (c) => {
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE user_reports SET status = 'resolved' WHERE report_id = ?").bind(id).run();
    return c.json({ success: true });
});

// ==========================================
// APPLE WATCH SYNC CODES
// ==========================================
const generateSyncCodeRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'post',
    path: '/sync/generate',
    summary: 'Generate an Apple Watch sync code',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: z.object({ listId: z.string() }) } } } },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ code: z.string(), expiresAt: z.number() }).openapi({ type: 'object' }) } }, description: 'Generated' },
        404: { description: 'List not found' }
    }
});

app.openapi(generateSyncCodeRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const { listId } = body;

    // Verify user owns the list
    const list = await c.env.DB.prepare("SELECT id FROM community_lists WHERE id = ? AND owner_id = ?").bind(listId, user.user_id).first();
    if (!list) return c.json({ error: "List not found or permission denied" }, 404);

    // Generate 5-digit numeric code securely
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const code = (10000 + (randomBuffer[0] % 90000)).toString();
    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 mins

    // Clear old codes asynchronously
    c.executionCtx.waitUntil(c.env.DB.prepare("DELETE FROM watch_sync_codes WHERE expires_at < ?").bind(Math.floor(Date.now() / 1000)).run());

    await c.env.DB.prepare("INSERT INTO watch_sync_codes (code, list_id, expires_at) VALUES (?, ?, ?)").bind(code, listId, expiresAt).run();

    return c.json({ code, expiresAt });
});

const resolveSyncCodeRoute = createRoute({
    method: 'get',
    path: '/sync/{code}',
    summary: 'Resolve an Apple Watch sync code',
    request: {
        params: z.object({
            code: z.string().openapi({ param: { name: 'code', in: 'path', required: true } })
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ listId: z.string() }).openapi({ type: 'object' }) } }, description: 'Resolved' },
        404: { description: 'Invalid or expired code' }
    }
});

app.openapi(resolveSyncCodeRoute, async (c) => {
    const code = c.req.param("code");
    const now = Math.floor(Date.now() / 1000);

    const record = await c.env.DB.prepare("SELECT list_id, expires_at FROM watch_sync_codes WHERE code = ?").bind(code).first();
    if (!record || (record.expires_at as number) < now) {
        return c.json({ error: "Invalid or expired code" }, 404);
    }

    return c.json({ listId: record.list_id as string });
});

app.get('/robots.txt', async (c) => {
    // Serve a dynamic robots.txt that points to the correct sitemap
    c.header("Content-Type", "text/plain");
    return c.text("User-agent: *\nAllow: /\n\nSitemap: https://api.rivers.run/sitemap.xml");
});

app.get('/sitemap.xml', async (c) => {
    // Serve the pre-generated sitemap from R2
    // Pass the incoming request headers to R2 so it can natively process ETag conditional checks
    const object = await c.env.FLOW_STORAGE.get("sitemap.xml", {
        onlyIf: c.req.raw.headers
    });

    if (!object) {
        console.error("Sitemap file 'sitemap.xml' not found in FLOW_STORAGE (R2 bucket: flowdata)");
        c.header("Cache-Control", "no-store, max-age=0");
        return c.text("Sitemap not found", 404);
    }

    // 24-hour edge cache for the sitemap only on success
    c.header("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600");
    c.header("ETag", object.httpEtag);

    // If Cloudflare Edge sends an If-None-Match header matching the R2 object,
    // R2 returns the metadata but no body. We return a lightweight 304 Not Modified.
    if (!('body' in object)) {
        return c.body(null, 304);
    }
    c.header("Content-Type", "application/xml");
    return c.body(object.body);
});

// Register Security Schemes
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

const openApiConfig = {
    openapi: '3.0.0',
    info: { title: 'Rivers.run API', version: '1.0.0' },
    security: [{ bearerAuth: [] }],
    servers: [
        { url: 'https://api.rivers.run', description: 'Production' },
        { url: 'http://localhost:8787', description: 'Local Development' }
    ]
};

// Expose OpenAPI dynamic specification directly
app.doc('/openapi.json', openApiConfig);

// Generate auto-updating Scalar interface dynamically
app.get('/docs', apiReference({
    content: app.getOpenAPIDocument(openApiConfig),
    theme: 'purple',
    layout: 'modern'
}));

export default app;
