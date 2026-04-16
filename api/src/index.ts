import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from "hono/cors";
import { z } from "zod";
import { 
    RiverEditorPayload, checkPayloadSize, 
    UserSettingsSchema, CommunityListSchema, 
    SubscriptionPayloadSchema, AdminResolutionSchema,
    RiverSchema
} from "./schema";
import { firebaseAuthMiddleware, requireModerator, requireAdmin, optionalFirebaseAuthMiddleware } from "./auth";

type Bindings = {
  DB: D1Database;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Expose OpenAPI dynamic specification directly
app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Rivers.run API', version: '1.0.0' },
    security: [{ bearerAuth: [] }]
});
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});
// Generate auto-updating Scalar interface dynamically
app.get('/docs', apiReference({
    spec: { url: '/openapi.json' },
    theme: 'purple',
    layout: 'modern',
    defaultContext: {
        baseUrl: 'https://api.rivers.run',
    }
}));

// Generous CORS to permit both rivers.run, apps, and dev variants
app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
}));

// Global error handler
app.onError((err, c) => {
    if (err instanceof z.ZodError) {
         return c.json({ error: "Validation Failed", details: err.errors }, 400);
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
            content: { 'application/json': { schema: z.array(RiverSchema) } },
            description: 'The list of rivers',
        },
    },
});

const formatRiverRow = (row: any) => {
    const formatted = {
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : [],
        gauges: typeof row.gauges === 'string' ? JSON.parse(row.gauges) : (row.gauges || []),
        accessPoints: typeof row.accessPoints === 'string' ? JSON.parse(row.accessPoints) : (row.accessPoints || []),
        flow: {
             unit: row.flow_unit || "cfs",
             min: row.flow_min,
             low: row.flow_low,
             mid: row.flow_mid,
             high: row.flow_high,
             max: row.flow_max
        }
    };
    
    // Clean up flat database columns since they are nested now
    delete formatted.flow_unit;
    delete formatted.flow_min;
    delete formatted.flow_low;
    delete formatted.flow_mid;
    delete formatted.flow_high;
    delete formatted.flow_max;

    return formatted;
};

app.openapi(getRiversRoute, async (c) => {
    const { results } = await c.env.DB.prepare(`
        SELECT 
            r.*,
            (SELECT json_group_array(json_object(
                'id', rg.gauge_id,
                'isPrimary', CASE WHEN rg.is_primary = 1 THEN json('true') ELSE json('false') END,
                'name', rg.name,
                'section', rg.section
            )) FROM river_gauges rg WHERE rg.river_id = r.id) as gauges,
            (SELECT json_group_array(json_object(
                'lat', ra.lat,
                'lon', ra.lon,
                'type', ra.type,
                'name', ra.name
            )) FROM river_access_points ra WHERE ra.river_id = r.id) as accessPoints
        FROM rivers r
    `).all();
    
    // Explicit aggressive caching header to push the massive load physically onto Cloudflare Edge Nodes
    // stale-while-revalidate=86400 allows serving old content while refetching in the background
    c.header("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
    
    const rivers = results.map(row => formatRiverRow(row));
    return c.json(rivers);
});

const getRiverRoute = createRoute({
    method: 'get',
    path: '/rivers/{id}',
    summary: 'Get river by ID',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: RiverSchema } }, description: 'The river object' },
        404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'River not found' }
    }
});

app.openapi(getRiverRoute, async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare(`
        SELECT 
            r.*,
            (SELECT json_group_array(json_object(
                'id', rg.gauge_id,
                'isPrimary', CASE WHEN rg.is_primary = 1 THEN json('true') ELSE json('false') END,
                'name', rg.name,
                'section', rg.section
            )) FROM river_gauges rg WHERE rg.river_id = r.id) as gauges,
            (SELECT json_group_array(json_object(
                'lat', ra.lat,
                'lon', ra.lon,
                'type', ra.type,
                'name', ra.name
            )) FROM river_access_points ra WHERE ra.river_id = r.id) as accessPoints
        FROM rivers r
        WHERE r.id = ?
    `).bind(id).first();
    
    if (!result) return c.json({ error: "River not found" }, 404);
    
    return c.json(formatRiverRow(result));
});

const deleteRiverRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'delete',
    path: '/rivers/{id}',
    summary: 'Delete a river',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Deleted' },
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
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: RiverEditorPayload } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), timestamp: z.number() }) } }, description: 'Updated' },
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

    // Atomic Execution
    const batch = [];
    if (original) {
        batch.push(c.env.DB.prepare(`
             UPDATE rivers SET name=?, section=?, altname=?, states=?, class=?, skill=?, writeup=?, tags=?, gauges=?, accessPoints=?, flow_unit=?, flow_min=?, flow_low=?, flow_mid=?, flow_high=?, flow_max=? WHERE id=?
        `).bind(
             validated.name, validated.section, validated.altname, validated.states, validated.class,
             validated.skill, validated.writeup, tagsStr, gaugesStr, accessStr, 
             flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax, id
        ));
    } else {
        batch.push(c.env.DB.prepare(`
             INSERT INTO rivers (id, name, section, altname, states, class, skill, writeup, tags, gauges, accessPoints, flow_unit, flow_min, flow_low, flow_mid, flow_high, flow_max) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
             id, validated.name, validated.section, validated.altname, validated.states, validated.class,
             validated.skill, validated.writeup, tagsStr, gaugesStr, accessStr,
             flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax
        ));
    }

    batch.push(c.env.DB.prepare(`
        INSERT INTO river_audit_log (river_id, action_type, changed_by, diff_patch) VALUES (?, ?, ?, ?)
    `).bind(
        id, original ? "UPDATE" : "INSERT", user.user_id, JSON.stringify(diff_patch)
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
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: RiverEditorPayload } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Suggestion submitted' }
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

    return c.json({ success: true });
});

const getAdminQueueRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator],
    method: 'get',
    path: '/admin/queue',
    summary: 'Fetch pending review queue',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: 'Admin queue' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' }
    }
});

// 4. Admin Queue Fetch
app.openapi(getAdminQueueRoute, async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE status = 'pending' ORDER BY created_at DESC").all();
    return c.json(results);
});

const getAdminSuggestionRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator],
    method: 'get',
    path: '/admin/queue/{id}',
    summary: 'Get a specific pending suggestion',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Suggestion details' },
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
    responses: {
        200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: 'Audit logs' }
    }
});

app.openapi(getAdminLogsRoute, async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM river_audit_log ORDER BY changed_at DESC LIMIT 50").all();
    return c.json(results);
});

const resolveSuggestionRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireModerator, checkPayloadSize],
    method: 'post',
    path: '/admin/queue/{id}/resolve',
    summary: 'Approve or reject a suggestion',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: AdminResolutionSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Resolved' }
    }
});

// 5. Admin Resolution of Suggestions
app.openapi(resolveSuggestionRoute, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json();
    const { action, admin_overrides, admin_notes } = AdminResolutionSchema.parse(body);

    const suggestion = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE suggestion_id = ? AND status = 'pending'").bind(id).first();
    if (!suggestion) return c.json({ error: "Suggestion not found or already resolved." }, 404);

    if (action === "reject") {
         await c.env.DB.prepare("UPDATE river_suggestions SET status = 'rejected' WHERE suggestion_id = ?").bind(id).run();
         return c.json({ success: true, message: "Rejected permanently." });
    }

    // Merging logic
    const proposed = JSON.parse(suggestion.proposed_changes as string);
    const finalPayload = { ...proposed, ...admin_overrides };
    const validated = RiverEditorPayload.parse(finalPayload); // Fails safely if Overrides break caps

    // Atomic promotion to rivers DB
    const batch = [];
    batch.push(c.env.DB.prepare("UPDATE river_suggestions SET status = 'resolved' WHERE suggestion_id = ?").bind(id));
    
    const tagsStr = JSON.stringify(validated.tags || []);
    const gaugesStr = JSON.stringify(validated.gauges || []);
    const accessStr = JSON.stringify(validated.accessPoints || []);

    const flowUnit = validated.flow?.unit || "cfs";
    const flowMin = validated.flow?.min ?? null;
    const flowLow = validated.flow?.low ?? null;
    const flowMid = validated.flow?.mid ?? null;
    const flowHigh = validated.flow?.high ?? null;
    const flowMax = validated.flow?.max ?? null;

    batch.push(c.env.DB.prepare(`
         UPDATE rivers SET name=?, section=?, altname=?, states=?, class=?, skill=?, writeup=?, tags=?, gauges=?, accessPoints=?, flow_unit=?, flow_min=?, flow_low=?, flow_mid=?, flow_high=?, flow_max=? WHERE id=?
    `).bind(
         validated.name, validated.section, validated.altname, validated.states, validated.class,
         validated.skill, validated.writeup, tagsStr, gaugesStr, accessStr, 
         flowUnit, flowMin, flowLow, flowMid, flowHigh, flowMax, suggestion.river_id
    ));

    // Calculate strict JSON delta
    const original = await c.env.DB.prepare("SELECT * FROM rivers WHERE id = ?").bind(suggestion.river_id).first();
    let oldPayload = {};
    if (original) {
         oldPayload = formatRiverRow(original);
    }

    const diff_patch: Record<string, { old: any, new: any }> = {};
    for (const key of Object.keys(validated)) {
         const k = key as keyof typeof validated;
         if (JSON.stringify(validated[k]) !== JSON.stringify((oldPayload as any)[k])) {
              diff_patch[key] = { old: (oldPayload as any)[k], new: validated[k] };
         }
    }

    // Scrub IP from the publicly-accessible history record
    const cleanAuthor = suggestion.suggested_by.startsWith("IP:") ? "Anonymous Paddler" : suggestion.suggested_by;

    // Log the math diff
    batch.push(c.env.DB.prepare(`
        INSERT INTO river_audit_log (river_id, action_type, changed_by, diff_patch, changed_at) VALUES (?, 'UPDATE', ?, ?, ?)
    `).bind(suggestion.river_id, user.user_id, JSON.stringify({ diff: diff_patch, note: admin_notes, type: "approval", original_author: cleanAuthor }), Math.floor(Date.now() / 1000)));

    await c.env.DB.batch(batch);
    return c.json({ success: true, message: "Suggestion merged successfully." });
});

const getUserSettingsRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/user/settings',
    summary: 'Get user profile and settings',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'User settings' }
    }
});

// 6. User Profiles & Settings
app.openapi(getUserSettingsRoute, async (c) => {
    const user = c.get("user");
    const result = await c.env.DB.prepare(`
        SELECT display_name, email, notifications_enabled, notifications_none_until, notifications_time_of_day, alerts_review_queue, settings_json
        FROM users WHERE user_id = ?
    `).bind(user.user_id).first();
    
    if (!result) {
        // Auto-provision user record on first hit
        await c.env.DB.prepare(`
            INSERT INTO users (user_id, display_name, email, updated_at) 
            VALUES (?, ?, ?, ?)
        `).bind(user.user_id, user.name || "Unknown Paddler", user.email || "", Math.floor(Date.now() / 1000)).run();
        
        return c.json({
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
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Updated' }
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
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Deleted' }
    }
});

app.openapi(deleteUserRoute, async (c) => {
    const user = c.get("user");
    await c.env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(user.user_id).run();
    return c.json({ success: true });
});

const getListsRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/lists',
    summary: 'Get your community lists',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: 'Your lists' }
    }
});

// 7. Lists (Favorites & Community)
app.openapi(getListsRoute, async (c) => {
    const user = c.get("user");
    const { results } = await c.env.DB.prepare(`
        SELECT l.*, json_group_array(
            json_object(
                'id', lr.river_id,
                'order', lr.sort_order,
                'gaugeId', lr.gauge_id,
                'min', lr.min_val,
                'max', lr.max_val,
                'units', lr.units,
                'customMin', lr.custom_min,
                'customMax', lr.custom_max,
                'customUnits', lr.custom_units
            )
        ) as rivers
        FROM community_lists l
        LEFT JOIN community_list_rivers lr ON l.id = lr.list_id
        WHERE l.owner_id = ?
        GROUP BY l.id
    `).bind(user.user_id).all();

    return c.json(results.map((r: any) => ({
        ...r,
        rivers: JSON.parse(r.rivers).filter((rv: any) => rv.id !== null)
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
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Created' }
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
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: CommunityListSchema } } } 
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Updated' }
    }
});

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
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Deleted' }
    }
});

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
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'List object' },
        404: { description: 'Not found' }
    }
});

app.openapi(getListByIdRoute, async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare(`
        SELECT l.*, json_group_array(
            json_object(
                'id', lr.river_id,
                'order', lr.sort_order,
                'gaugeId', lr.gauge_id,
                'min', lr.min_val,
                'max', lr.max_val,
                'units', lr.units,
                'customMin', lr.custom_min,
                'customMax', lr.custom_max,
                'customUnits', lr.custom_units
            )
        ) as rivers
        FROM community_lists l
        LEFT JOIN community_list_rivers lr ON l.id = lr.list_id
        WHERE l.id = ?
        GROUP BY l.id
    `).bind(id).first();
    
    if (!result) return c.json({ error: "List not found" }, 404);
    
    return c.json({
        ...result,
        rivers: JSON.parse(result.rivers as string).filter((rv: any) => rv.id !== null)
    });
});

const getSubscriptionsRoute = createRoute({
    middleware: [firebaseAuthMiddleware],
    method: 'get',
    path: '/user/subscriptions',
    summary: 'Get your active list subscriptions',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { content: { 'application/json': { schema: z.object({ subscriptions: z.array(z.string()) }) } }, description: 'Subscriptions' }
    }
});

app.openapi(getSubscriptionsRoute, async (c) => {
    const user = c.get("user");
    const { results } = await c.env.DB.prepare("SELECT list_id FROM user_subscriptions WHERE user_id = ?").bind(user.user_id).all();
    return c.json({ subscriptions: results.map(r => r.list_id) });
});

const updateSubscriptionsRoute = createRoute({
    middleware: [firebaseAuthMiddleware, checkPayloadSize],
    method: 'put',
    path: '/user/subscriptions',
    summary: 'Bulk update subscriptions',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: SubscriptionPayloadSchema } } } },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Updated' }
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

// 8. Admin Controls (Bans)
const banUserRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'put',
    path: '/admin/users/{id}/ban',
    summary: 'Ban a user',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Banned' } }
});

app.openapi(banUserRoute, async (c) => {
    const id = c.req.param("id");
    const admin = c.get("user");
    await c.env.DB.prepare("UPDATE users SET role = 'banned' WHERE user_id = ?").bind(id).run();
    await c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind('BAN_USER', admin.user_id, id, 'Banned by admin panel', Math.floor(Date.now() / 1000)).run();
    return c.json({ success: true });
});

const unbanUserRoute = createRoute({
    middleware: [firebaseAuthMiddleware, requireAdmin],
    method: 'put',
    path: '/admin/users/{id}/unban',
    summary: 'Unban a user',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Unbanned' } }
});

app.openapi(unbanUserRoute, async (c) => {
    const id = c.req.param("id");
    const admin = c.get("user");
    await c.env.DB.prepare("UPDATE users SET role = 'user' WHERE user_id = ?").bind(id).run();
    await c.env.DB.prepare("INSERT INTO admin_audit_log (action_type, admin_id, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind('UNBAN_USER', admin.user_id, id, 'Unbanned by admin panel', Math.floor(Date.now() / 1000)).run();
    return c.json({ success: true });
});

export default app;
