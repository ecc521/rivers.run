import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from "hono/cors";
import { z } from "zod";
import { RiverEditorPayload, checkPayloadSize } from "./schema";
import { firebaseAuthMiddleware, requireModerator, requireAdmin } from "./auth";

type Bindings = {
  DB: D1Database;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Expose OpenAPI dynamic specification directly
app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Rivers.run API', version: '1.0.0' }
});
// Generate auto-updating Swagger interface dynamically
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// Generous CORS to permit both rivers.run and dev variants
app.use("*", cors({
    origin: ["https://rivers.run", "https://beta.rivers.run", "http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

// 1. Unified Fetch for React Context Replacement
app.get("/rivers", async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM rivers").all();
    
    // Explicit aggressive caching header to push the massive load physically onto Cloudflare Edge Nodes
    c.header("Cache-Control", "public, max-age=300, s-maxage=300");
    
    // Natively parse the DB JSON strings back into objects perfectly matching useRivers.ts expectations
    const rivers = results.map(row => {
         return {
              ...row,
              tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : [],
              gauges: typeof row.gauges === 'string' ? JSON.parse(row.gauges) : [],
              accessPoints: typeof row.accessPoints === 'string' ? JSON.parse(row.accessPoints) : []
         };
    });
    return c.json(rivers);
});

app.get("/rivers/:id", async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("SELECT * FROM rivers WHERE id = ?").bind(id).first();
    
    if (!result) return c.json({ error: "River not found" }, 404);
    
    return c.json({
        ...result,
        tags: typeof result.tags === 'string' ? JSON.parse(result.tags) : [],
        gauges: typeof result.gauges === 'string' ? JSON.parse(result.gauges) : [],
        accessPoints: typeof result.accessPoints === 'string' ? JSON.parse(result.accessPoints) : []
    });
});

app.delete("/rivers/:id", firebaseAuthMiddleware, requireAdmin, async (c) => {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM rivers WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

// 2. Direct Admin Edit Wrapper with Delta Patches
app.put("/rivers/:id", firebaseAuthMiddleware, requireModerator, checkPayloadSize, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    
    const body = await c.req.json();
    const validated = RiverEditorPayload.parse(body); // Fails explicitly throwing ZodError if bloated

    // We pull original state natively to build physical diff logs safely
    const original = await c.env.DB.prepare("SELECT * FROM rivers WHERE id = ?").bind(id).first();
    let oldPayload = {};
    if (original) {
         oldPayload = {
              ...original,
              tags: typeof original.tags === 'string' ? JSON.parse(original.tags) : [],
              gauges: typeof original.gauges === 'string' ? JSON.parse(original.gauges) : [],
              accessPoints: typeof original.accessPoints === 'string' ? JSON.parse(original.accessPoints) : []
         };
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

    // Atomic Execution
    const batch = [];
    if (original) {
        batch.push(c.env.DB.prepare(`
             UPDATE rivers SET name=?, section=?, altname=?, states=?, class=?, skill=?, writeup=?, tags=?, gauges=?, accessPoints=? WHERE id=?
        `).bind(
             validated.name, validated.section, validated.altname, validated.states, validated.class,
             validated.skill, validated.writeup, tagsStr, gaugesStr, accessStr, id
        ));
    } else {
        batch.push(c.env.DB.prepare(`
             INSERT INTO rivers (id, name, section, altname, states, class, skill, writeup, tags, gauges, accessPoints) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
             id, validated.name, validated.section, validated.altname, validated.states, validated.class,
             validated.skill, validated.writeup, tagsStr, gaugesStr, accessStr
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

// 3. User Suggestions (Review Queue)
app.post("/rivers/:id/suggest", firebaseAuthMiddleware, checkPayloadSize, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    
    const body = await c.req.json();
    const validated = RiverEditorPayload.parse(body);

    await c.env.DB.prepare(`
        INSERT INTO river_suggestions (river_id, suggested_by, proposed_changes, status, created_at) VALUES (?, ?, ?, 'pending', ?)
    `).bind(id, user.user_id, JSON.stringify(validated), Math.floor(Date.now() / 1000)).run();

    return c.json({ success: true });
});

// 4. Admin Queue Fetch
app.get("/admin/queue", firebaseAuthMiddleware, requireModerator, async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE status = 'pending' ORDER BY created_at DESC").all();
    return c.json(results);
});

app.get("/admin/queue/:id", firebaseAuthMiddleware, requireModerator, async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("SELECT * FROM river_suggestions WHERE suggestion_id = ?").bind(id).first();
    if (!result) return c.json({ error: "Suggestion not found" }, 404);
    
    return c.json({
        ...result,
        proposed_changes: typeof result.proposed_changes === 'string' ? JSON.parse(result.proposed_changes) : result.proposed_changes
    });
});

app.get("/admin/logs", firebaseAuthMiddleware, requireAdmin, async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM river_audit_log ORDER BY changed_at DESC LIMIT 50").all();
    return c.json(results);
});

// 5. Admin Resolution of Suggestions
app.post("/admin/queue/:id/resolve", firebaseAuthMiddleware, requireModerator, async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const { action, admin_overrides, admin_notes } = await c.req.json();

    if (action !== "approve" && action !== "reject") return c.json({ error: "Invalid action" }, 400);

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
    
    // For simplicity, we assume an UPDATE here. (In production, if river doesn't exist, it should INSERT)
    const tagsStr = JSON.stringify(validated.tags || []);
    const gaugesStr = JSON.stringify(validated.gauges || []);
    const accessStr = JSON.stringify(validated.accessPoints || []);

    batch.push(c.env.DB.prepare(`
         UPDATE rivers SET name=?, section=?, altname=?, states=?, class=?, skill=?, writeup=?, tags=?, gauges=?, accessPoints=? WHERE id=?
    `).bind(
         validated.name, validated.section, validated.altname, validated.states, validated.class,
         validated.skill, validated.writeup, tagsStr, gaugesStr, accessStr, suggestion.river_id
    ));

    // Log the diff
    batch.push(c.env.DB.prepare(`
        INSERT INTO river_audit_log (river_id, action_type, changed_by, diff_patch, changed_at) VALUES (?, 'UPDATE', ?, ?, ?)
    `).bind(suggestion.river_id, user.user_id, JSON.stringify({ note: admin_notes, type: "approval", original_author: suggestion.suggested_by }), Math.floor(Date.now() / 1000)));

    await c.env.DB.batch(batch);
    return c.json({ success: true, message: "Suggestion merged successfully." });
});

// 6. User Profiles & Settings
app.get("/user/settings", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const result = await c.env.DB.prepare("SELECT settings_json FROM users WHERE user_id = ?").bind(user.user_id).first();
    
    if (!result) {
        // Auto-provision user record on first hit
        const defaultSettings = JSON.stringify({ notifications: { reviewQueueAlerts: false } });
        await c.env.DB.prepare("INSERT INTO users (user_id, display_name, email, settings_json, updated_at) VALUES (?, ?, ?, ?, ?)")
            .bind(user.user_id, user.name || "", user.email || "", defaultSettings, Math.floor(Date.now() / 1000)).run();
        return c.json({ notifications: { reviewQueueAlerts: false } });
    }
    
    return c.json(typeof result.settings_json === 'string' ? JSON.parse(result.settings_json) : result.settings_json);
});

app.patch("/user/settings", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const updates = await c.req.json();
    
    // Merge logic
    const existing = await c.env.DB.prepare("SELECT settings_json FROM users WHERE user_id = ?").bind(user.user_id).first();
    let settings = {};
    if (existing) {
        settings = typeof existing.settings_json === 'string' ? JSON.parse(existing.settings_json) : existing.settings_json;
    }
    
    const newSettings = { ...settings, ...updates };
    
    await c.env.DB.prepare("UPDATE users SET settings_json = ?, updated_at = ? WHERE user_id = ?")
        .bind(JSON.stringify(newSettings), Math.floor(Date.now() / 1000), user.user_id).run();
        
    return c.json({ success: true });
});

app.delete("/user", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    await c.env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(user.user_id).run();
    return c.json({ success: true });
});

// 7. Lists (Favorites & Community)
app.get("/lists", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const { results } = await c.env.DB.prepare("SELECT * FROM community_lists WHERE owner_id = ?").bind(user.user_id).all();
    return c.json(results);
});

app.post("/lists", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const list = await c.req.json();
    
    await c.env.DB.prepare(`
        INSERT INTO community_lists (id, title, description, author, owner_id, is_published, subscribes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(list.id, list.title, list.description, list.author, user.user_id, list.isPublished ? 1 : 0, 0).run();
    
    return c.json({ success: true });
});

app.put("/lists/:id", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const updates = await c.req.json();
    
    // Simple verification
    const existing = await c.env.DB.prepare("SELECT owner_id FROM community_lists WHERE id = ?").bind(id).first();
    if (!existing || existing.owner_id !== user.user_id) return c.json({ error: "Forbidden" }, 403);
    
    // Construct UPDATE dynamically or just pick common fields
    await c.env.DB.prepare(`
        UPDATE community_lists SET title = ?, description = ?, is_published = ? WHERE id = ?
    `).bind(updates.title, updates.description, updates.isPublished ? 1 : 0, id).run();
    
    return c.json({ success: true });
});

app.delete("/lists/:id", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    
    const existing = await c.env.DB.prepare("SELECT owner_id FROM community_lists WHERE id = ?").bind(id).first();
    if (!existing || existing.owner_id !== user.user_id) return c.json({ error: "Forbidden" }, 403);
    
    await c.env.DB.prepare("DELETE FROM community_lists WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

app.get("/lists/:id", async (c) => {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("SELECT * FROM community_lists WHERE id = ?").bind(id).first();
    
    if (!result) return c.json({ error: "List not found" }, 404);
    
    // For community lists, rivers are also JSON strings
    return c.json({
        ...result,
        rivers: typeof result.rivers === 'string' ? JSON.parse(result.rivers) : (result.rivers || [])
    });
});
app.get("/user/subscriptions", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const { results } = await c.env.DB.prepare("SELECT list_id FROM user_subscriptions WHERE user_id = ?").bind(user.user_id).all();
    return c.json({ subscriptions: results.map(r => r.list_id) });
});

app.post("/user/subscriptions", firebaseAuthMiddleware, async (c) => {
    const user = c.get("user");
    const { subscriptions } = await c.req.json();
    
    const batch = [];
    batch.push(c.env.DB.prepare("DELETE FROM user_subscriptions WHERE user_id = ?").bind(user.user_id));
    for (const listId of subscriptions) {
        batch.push(c.env.DB.prepare("INSERT INTO user_subscriptions (user_id, list_id) VALUES (?, ?)").bind(user.user_id, listId));
    }
    
    await c.env.DB.batch(batch);
    return c.json({ success: true });
});

export default app;
