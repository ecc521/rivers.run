import { z } from "@hono/zod-openapi";
import { normalizeGaugeId } from "./utils/formatting";
import { validateCountries, validateStates } from "./utils/regions";

// Shared schemas; Hono infers OpenAPI types from their Zod definitions.
const limitString = (max: number) => z.string().max(max, `Must be under ${max} characters`).optional().nullable();
const strictString = (max: number) => z.string().max(max, `Must be under ${max} characters`);
const requiredString = (max: number) => z.string().min(1, "This field is required").max(max, `Must be under ${max} characters`);

const GenericObjectSchema = z.object({}).openapi({ additionalProperties: true });

export const AccessPointSchema = z.object({
  name: limitString(100),
  description: limitString(500),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  type: z.enum(["put-in", "take-out", "access"]).optional().default("access")
}).openapi({ description: 'A river access point' });

export const GaugeMappingSchema = z.object({
  id: strictString(50).transform((val) => normalizeGaugeId(val)), 
  isPrimary: z.boolean().optional().default(false)
}).openapi({ description: 'A mapping of a river to an external gauge' });

export const FlowThresholdsSchema = z.object({
  unit: z.enum(["cfs", "ft", "cms", "m"]),
  min: z.number().optional().nullable(),
  low: z.number().optional().nullable(),
  mid: z.number().optional().nullable(),
  high: z.number().optional().nullable(),
  max: z.number().optional().nullable()
}).openapi({ description: 'Flow thresholds for a river' });

export const RiverEditorPayload = z.object({
  id: limitString(100),
  name: requiredString(100),
  section: requiredString(100),
  countries: requiredString(50),
  states: limitString(50),
  class: requiredString(20),
  skill: z.union([
    z.number().int().min(1).max(8),
    z.string().transform((val) => {
      const SKILL_MAP: Record<string, number> = { "FW": 1, "B": 2, "N": 3, "LI": 4, "I": 5, "HI": 6, "A": 7, "E": 8 };
      return SKILL_MAP[val.toUpperCase()] || null;
    })
  ]).optional().nullable(),
  writeup: limitString(25000), 
  tags: z.array(z.string()).max(10).optional(),
  accessPoints: z.array(AccessPointSchema).max(50).optional(),
  gauges: z.array(GaugeMappingSchema).max(10).optional(),
  flow: FlowThresholdsSchema.optional().nullable(),
  dam: z.boolean().optional().nullable(),
  aw: limitString(50),
  submitterEmail: z.string().email("Invalid email").optional().nullable()
}).superRefine((data, ctx) => {
  if (!validateCountries(data.countries)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["countries"], message: "Must be a comma-separated list of known country codes" });
  }
  if (!validateStates(data.states, data.countries)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["states"], message: "Each state must be a valid subdivision of one of the selected countries" });
  }
}).openapi({ description: 'Payload for creating or updating a river' });

export type RiverEditInput = z.infer<typeof RiverEditorPayload>;

export const UserSettingsSchema = z.object({
  displayName: z.string().max(100).optional().nullable(),
  settings_json: GenericObjectSchema.optional(),
  notifications: z.object({
    enabled: z.boolean().optional(),
    noneUntil: z.number().int().optional(),
    timeOfDay: z.string().optional(),
    reviewQueueAlerts: z.boolean().optional()
  }).optional()
}).openapi({ description: 'User settings' });

export const CommunityListSchema = z.object({
  id: z.string().max(50).optional(),
  title: requiredString(100),
  description: limitString(5000),
  isPublished: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  rivers: z.array(z.object({
      id: z.string(),
      order: z.number().int(),
      gaugeId: z.string().optional().nullable(),
      min: z.number().optional().nullable(),
      max: z.number().optional().nullable(),
      units: z.string().optional().nullable(),
      customMin: z.number().optional().nullable(),
      customMax: z.number().optional().nullable(),
      customUnits: z.string().optional().nullable()
  })).max(500, "A list can contain at most 500 rivers").optional()
}).openapi({ description: 'A community list' });

export const SubscriptionPayloadSchema = z.object({
  subscriptions: z.array(z.string()).max(500)
});

export const AdminResolutionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  admin_notes: limitString(5000),
  admin_overrides: GenericObjectSchema.optional(),
  notify_submitter: z.boolean().optional().default(true)
});

export const UserRoleSchema = z.enum(["user", "moderator", "admin", "super-admin", "banned"]);

export const RoleUpdatePayload = z.object({
  role: UserRoleSchema,
  reason: limitString(500)
});

export const UserManagementSchema = z.object({
  user_id: z.string(),
  display_name: z.string().nullable(),
  email: z.string().nullable().transform(v => v?.toLowerCase() || null),
  role: UserRoleSchema,
  updated_at: z.number().optional()
});

export const UserSearchResponse = z.array(UserManagementSchema);

export const UserReportPayload = z.object({
  target_id: requiredString(50),
  type: z.enum(["river", "list"]),
  reason: requiredString(1000),
  email: limitString(255).transform(v => v?.toLowerCase() || null)
});

export const RiverSchema = z.object({
  id: z.string().openapi({ example: "1L4pDt-EWGv6Z8V1SlOSGG6QIO4l2ZVof" }),
  name: z.string().openapi({ example: "French Broad" }),
  section: z.string().openapi({ example: "Section 9" }),
  countries: z.string(),
  states: z.string().optional().nullable(),
  class: z.string().openapi({ example: "III-IV" }),
  skill: z.number().optional().nullable().openapi({ example: 5 }),
  writeup: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().openapi({ example: ["classic", "busy"] }),
  gauges: z.array(GaugeMappingSchema).optional(),
  accessPoints: z.array(AccessPointSchema).optional(),
  flow: FlowThresholdsSchema.optional().nullable(),
  dam: z.boolean().optional().nullable(),
  averagegradient: z.number().optional().nullable(),
  maxgradient: z.number().optional().nullable(),
  aw: z.string().optional().nullable().openapi({ example: "129" }),
  updated_at: z.number().optional().openapi({ example: 1713214540 })
}).openapi({ description: 'Full river record' });

export const RiverHistoryRecordSchema = z.object({
    history_id: z.number(),
    river_id: z.string(),
    action_type: z.string(),
    changed_by: z.string().optional().nullable(),
    editor_name: z.string(),
    email: z.string().optional().nullable(),
    changed_at: z.number(),
    diff_patch: z.string().openapi({ description: 'JSON stringified diff_patch object' })
}).openapi({ description: 'A single river edit history record' });

export const RiverHistoryResponseSchema = z.object({
    logs: z.array(RiverHistoryRecordSchema),
    nextOffset: z.number().optional().nullable()
}).openapi({ description: 'Paginated history response' });

export const ApiKeyCreateInput = z.object({
    name: requiredString(100)
}).openapi({ description: 'Payload for generating a new developer API key' });

export const ApiKeySchema = z.object({
    key_hash: z.string(),
    key_prefix: z.string(),
    user_id: z.string(),
    name: z.string(),
    status: z.enum(["active", "suspended", "revoked"]),
    tier: z.enum(["free", "commercial", "internal"]),
    created_at: z.number(),
    last_used_at: z.number().optional().nullable(),
    daily_limit: z.number()
}).openapi({ description: 'A developer API key record' });

export const ApiUsageSchema = z.object({
    key_hash: z.string(),
    date: z.string(),
    endpoint_type: z.enum(["metadata", "gauge-flow"]),
    request_count: z.number()
}).openapi({ description: 'API usage counter logs' });

export const checkPayloadSize = async (c: any, next: any) => {
    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > 100 * 1024) {
         return c.json({ error: "Payload exceeds absolute 100KB limit." }, 413);
    }
    await next();
};
