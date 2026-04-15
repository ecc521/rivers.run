import { z } from "zod";

// Shared common components
const limitString = (max: number) => z.string().max(max, `Must be under ${max} characters`).optional();
const strictString = (max: number) => z.string().max(max, `Must be under ${max} characters`);

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
  name: limitString(100),
  section: limitString(100),
  altname: limitString(150),
  states: limitString(50),
  class: limitString(20),
  skill: z.number().int().min(1).max(8).optional(),
  writeup: limitString(25000), // Our primary protection against massive text bomb bloat
  tags: z.array(strictString(20)).max(10, "Cannot exceed 10 tags").optional(),
  accessPoints: z.array(AccessPointSchema).max(50, "Cannot exceed 50 access points").optional(),
  gauges: z.array(GaugeMappingSchema).max(10, "Cannot exceed 10 gauges").optional()
});

export type RiverEditInput = z.infer<typeof RiverEditorPayload>;

// Reusable payload size middleware checking raw length 
export const checkPayloadSize = async (c: any, next: any) => {
    const contentLength = Number(c.req.header("content-length") || 0);
    // Hard check 50KB total body
    if (contentLength > 50 * 1024) {
         return c.json({ error: "Payload exceeds absolute 50KB limit." }, 413);
    }
    await next();
};
