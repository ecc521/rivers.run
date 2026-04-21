import { z } from "@hono/zod-openapi";

// Shared common components - now with explicit OpenAPI types
const limitString = (max: number) => z.string().max(max, `Must be under ${max} characters`).optional().nullable().openapi({ type: 'string' });
const strictString = (max: number) => z.string().max(max, `Must be under ${max} characters`).openapi({ type: 'string' });
const requiredString = (max: number) => z.string().min(1, "This field is required").max(max, `Must be under ${max} characters`).openapi({ type: 'string' });

const GenericObjectSchema = z.object({}).openapi({ type: 'object', additionalProperties: true });

export const AccessPointSchema = z.object({
  name: limitString(100),
  description: limitString(500),
  lat: z.number().min(-90).max(90).openapi({ type: 'number' }),
  lon: z.number().min(-180).max(180).openapi({ type: 'number' }),
  type: z.enum(["put-in", "take-out", "access"]).optional().default("access").openapi({ type: 'string' })
}).openapi({ type: 'object', description: 'A river access point' });

export const GaugeMappingSchema = z.object({
  id: strictString(50), 
  isPrimary: z.boolean().optional().default(false).openapi({ type: 'boolean' })
}).openapi({ type: 'object', description: 'A mapping of a river to an external gauge' });

export const FlowThresholdsSchema = z.object({
  unit: z.enum(["cfs", "ft", "cms", "m"]).openapi({ type: 'string' }),
  min: z.number().optional().nullable().openapi({ type: 'number' }),
  low: z.number().optional().nullable().openapi({ type: 'number' }),
  mid: z.number().optional().nullable().openapi({ type: 'number' }),
  high: z.number().optional().nullable().openapi({ type: 'number' }),
  max: z.number().optional().nullable().openapi({ type: 'number' })
}).openapi({ type: 'object', description: 'Flow thresholds for a river' });

export const RiverEditorPayload = z.object({
  name: requiredString(100),
  section: requiredString(100),
  altname: limitString(150),
  states: limitString(50),
  class: requiredString(20),
  skill: z.union([
    z.number().int().min(1).max(8),
    z.string().transform((val) => {
      const SKILL_MAP: Record<string, number> = { "FW": 1, "B": 2, "N": 3, "LI": 4, "I": 5, "HI": 6, "A": 7, "E": 8 };
      return SKILL_MAP[val.toUpperCase()] || null;
    })
  ]).optional().nullable().openapi({ type: 'integer' }),
  writeup: limitString(25000), 
  tags: z.array(z.string().openapi({ type: 'string' })).max(10).optional().openapi({ type: 'array' }),
  accessPoints: z.array(AccessPointSchema).max(50).optional().openapi({ type: 'array' }),
  gauges: z.array(GaugeMappingSchema).max(10).optional().openapi({ type: 'array' }),
  flow: FlowThresholdsSchema.optional().nullable(),
  aw: limitString(50)
}).openapi({ type: 'object', description: 'Payload for creating or updating a river' });

export type RiverEditInput = z.infer<typeof RiverEditorPayload>;

export const UserSettingsSchema = z.object({
  settings_json: GenericObjectSchema.optional(),
  notifications: z.object({
    enabled: z.boolean().optional().openapi({ type: 'boolean' }),
    noneUntil: z.number().int().optional().openapi({ type: 'integer' }),
    timeOfDay: z.string().optional().openapi({ type: 'string' }),
    reviewQueueAlerts: z.boolean().optional().openapi({ type: 'boolean' })
  }).optional().openapi({ type: 'object' })
}).openapi({ type: 'object', description: 'User settings' });

export const CommunityListSchema = z.object({
  id: z.string().max(50).optional().openapi({ type: 'string' }),
  title: requiredString(100),
  description: limitString(5000),
  author: requiredString(100),
  isPublished: z.boolean().optional().openapi({ type: 'boolean' }),
  rivers: z.array(z.object({
      id: z.string().openapi({ type: 'string' }),
      order: z.number().int().openapi({ type: 'integer' }),
      gaugeId: z.string().optional().nullable().openapi({ type: 'string' }),
      min: z.number().optional().nullable().openapi({ type: 'number' }),
      max: z.number().optional().nullable().openapi({ type: 'number' }),
      units: z.string().optional().nullable().openapi({ type: 'string' }),
      customMin: z.number().optional().nullable().openapi({ type: 'number' }),
      customMax: z.number().optional().nullable().openapi({ type: 'number' }),
      customUnits: z.string().optional().nullable().openapi({ type: 'string' })
  }).openapi({ type: 'object' })).optional().openapi({ type: 'array' })
}).openapi({ type: 'object', description: 'A community list' });

export const SubscriptionPayloadSchema = z.object({
  subscriptions: z.array(z.string().openapi({ type: 'string' })).max(500).openapi({ type: 'array' })
}).openapi({ type: 'object' });

export const AdminResolutionSchema = z.object({
  action: z.enum(["approve", "reject"]).openapi({ type: 'string' }),
  admin_notes: limitString(5000),
  admin_overrides: GenericObjectSchema.optional()
}).openapi({ type: 'object' });

export const UserRoleSchema = z.enum(["user", "moderator", "admin", "super-admin", "banned"]).openapi({ type: 'string' });

export const RoleUpdatePayload = z.object({
  role: UserRoleSchema,
  reason: limitString(500)
}).openapi({ type: 'object' });

export const UserManagementSchema = z.object({
  user_id: z.string().openapi({ type: 'string' }),
  display_name: z.string().nullable().openapi({ type: 'string' }),
  email: z.string().nullable().openapi({ type: 'string' }),
  role: UserRoleSchema,
  updated_at: z.number().optional().openapi({ type: 'number' })
}).openapi({ type: 'object' });

export const UserSearchResponse = z.array(UserManagementSchema).openapi({ type: 'array' });

export const UserReportPayload = z.object({
  target_id: requiredString(50),
  type: z.enum(["river", "list"]).openapi({ type: 'string' }),
  reason: requiredString(1000),
  email: limitString(255)
}).openapi({ type: 'object' });

export const RiverSchema = z.object({
  id: z.string().openapi({ type: 'string', example: "1L4pDt-EWGv6Z8V1SlOSGG6QIO4l2ZVof" }),
  name: z.string().openapi({ type: 'string', example: "French Broad" }),
  section: z.string().openapi({ type: 'string', example: "Section 9" }),
  altname: z.string().optional().nullable().openapi({ type: 'string' }),
  states: z.string().optional().nullable().openapi({ type: 'string' }),
  class: z.string().openapi({ type: 'string', example: "III-IV" }),
  skill: z.number().optional().nullable().openapi({ type: 'number', example: 5 }),
  writeup: z.string().optional().nullable().openapi({ type: 'string' }),
  tags: z.array(z.string().openapi({ type: 'string' })).optional().openapi({ type: 'array', example: ["classic", "busy"] }),
  gauges: z.array(GaugeMappingSchema).optional().openapi({ type: 'array' }),
  accessPoints: z.array(AccessPointSchema).optional().openapi({ type: 'array' }),
  flow: FlowThresholdsSchema.optional().nullable(),
  averagegradient: z.number().optional().nullable().openapi({ type: 'number' }),
  maxgradient: z.number().optional().nullable().openapi({ type: 'number' }),
  aw: z.string().optional().nullable().openapi({ type: 'string', example: "129" }),
  updated_at: z.number().optional().openapi({ type: 'number', example: 1713214540 })
}).openapi({ type: 'object', description: 'Full river record' });

export const RiverHistoryRecordSchema = z.object({
    history_id: z.number().openapi({ type: 'integer' }),
    river_id: z.string().openapi({ type: 'string' }),
    action_type: z.string().openapi({ type: 'string' }),
    changed_by: z.string().optional().nullable().openapi({ type: 'string' }),
    editor_name: z.string().openapi({ type: 'string' }),
    email: z.string().optional().nullable().openapi({ type: 'string' }),
    changed_at: z.number().openapi({ type: 'integer' }),
    diff_patch: z.string().openapi({ type: 'string', description: 'JSON stringified diff_patch object' })
}).openapi({ type: 'object', description: 'A single river edit history record' });

export const RiverHistoryResponseSchema = z.object({
    logs: z.array(RiverHistoryRecordSchema).openapi({ type: 'array' }),
    nextOffset: z.number().optional().nullable().openapi({ type: 'integer' })
}).openapi({ type: 'object', description: 'Paginated history response' });

export const checkPayloadSize = async (c: any, next: any) => {
    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > 50 * 1024) {
         return c.json({ error: "Payload exceeds absolute 50KB limit." }, 413);
    }
    await next();
};
