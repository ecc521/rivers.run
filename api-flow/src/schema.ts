import { z } from "@hono/zod-openapi";

export const ReadingSchema = z.object({
  time: z.number().openapi({ example: 1713214540 }),
  cfs: z.number().optional().openapi({ example: 1200 }),
  ft: z.number().optional().openapi({ example: 3.5 }),
  cms: z.number().optional().openapi({ example: 34.2 }),
  m: z.number().optional().openapi({ example: 1.05 })
});

export const HistorySchema = z.object({
  id: z.string().openapi({ example: "USGS:03451500" }),
  name: z.string().optional().openapi({ example: "French Broad River at Marshall, NC" }),
  section: z.string().optional().openapi({ example: "Section 9" }),
  readings: z.array(ReadingSchema)
});

export const SiteSchema = z.object({
  id: z.string().openapi({ example: "USGS:03451500" }),
  name: z.string().openapi({ example: "French Broad at Marshall" }),
  lat: z.number().openapi({ example: 35.79 }),
  lon: z.number().openapi({ example: -82.68 }),
  section: z.string().optional().openapi({ example: "Section 9" })
});
