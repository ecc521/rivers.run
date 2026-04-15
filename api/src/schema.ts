import { z } from "zod";

// Shared common components
const limitString = (max: number) => z.string().max(max, `Must be under ${max} characters`).optional().nullable();
const strictString = (max: number) => z.string().max(max, `Must be under ${max} characters`);
const requiredString = (max: number) => z.string().min(1, "This field is required").max(max, `Must be under ${max} characters`);

export const AccessPointSchema = z.object({
  name: limitString(100),
  description: limitString(500),
  location: z.object({ lat: z.number(), lon: z.number() }).optional(),
  type: limitString(50)
});

export const GaugeMappingSchema = z.object({
  id: strictString(50), // "USGS:12345"
  isPrimary: z.boolean().optional(),
  name: limitString(100)
});

// The strict PUT payload validator mapping exact database column caps
export const RiverEditorPayload = z.object({
  name: requiredString(100),
  section: requiredString(100),
  altname: limitString(150),
  states: limitString(50),
  class: requiredString(20),
  skill: z.number().int().min(1).max(8).optional().nullable(),
  writeup: limitString(25000), // Our primary protection against massive text bomb bloat
  tags: z.array(strictString(20)).max(10, "Cannot exceed 10 tags").optional(),
  accessPoints: z.array(AccessPointSchema).max(50, "Cannot exceed 50 access points").optional(),
  gauges: z.array(GaugeMappingSchema).max(10, "Cannot exceed 10 gauges").optional()
});

export type RiverEditInput = z.infer<typeof RiverEditorPayload>;

// NEW: User Settings validation
export const UserSettingsSchema = z.object({
  settings_json: z.record(z.any()).refine(v => JSON.stringify(v).length <= 2500, "Settings exceeded 2500 character limit").optional(),
  notifications: z.object({
    enabled: z.boolean().optional(),
    noneUntil: z.number().int().optional(),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, "Must be in HH:mm format").optional(),
    reviewQueueAlerts: z.boolean().optional()
  }).optional()
});

// NEW: Community List validation
export const CommunityListSchema = z.object({
  id: z.string().max(50).optional(), // Client usually generates UUID
  title: requiredString(100),
  description: limitString(5000),
  author: requiredString(100),
  isPublished: z.boolean().optional()
});

// NEW: Subscriptions validation
export const SubscriptionPayloadSchema = z.object({
  subscriptions: z.array(z.string().max(100)).max(500, "Cannot exceed 500 subscriptions")
});

export const AdminResolutionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  admin_notes: limitString(5000),
  admin_overrides: RiverEditorPayload.partial().optional()
});

// Response Schemas for Documentation
export const RiverSchema = z.object({
  id: z.string().openapi({ example: "1L4pDt-EWGv6Z8V1SlOSGG6QIO4l2ZVof" }),
  name: z.string().openapi({ example: "French Broad" }),
  section: z.string().openapi({ example: "Section 9" }),
  altname: z.string().optional().nullable(),
  states: z.string().optional().nullable(),
  class: z.string().openapi({ example: "III-IV" }),
  skill: z.number().optional().nullable().openapi({ example: 5 }),
  writeup: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().openapi({ example: ["classic", "busy"] }),
  gauges: z.array(GaugeMappingSchema).optional(),
  accessPoints: z.array(AccessPointSchema).optional(),
  updated_at: z.number().optional().openapi({ example: 1713214540 })
});

// Reusable payload size middleware checking raw length 
export const checkPayloadSize = async (c: any, next: any) => {
    const contentLength = Number(c.req.header("content-length") || 0);
    // Hard check 50KB total body
    if (contentLength > 50 * 1024) {
         return c.json({ error: "Payload exceeds absolute 50KB limit." }, 413);
    }
    await next();
};
