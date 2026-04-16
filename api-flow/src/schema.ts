import { z } from "@hono/zod-openapi";

export const ReadingSchema = z.object({
  dateTime: z.number().openapi({ example: 1713214540, description: 'Timestamp in milliseconds' }),
  cfs: z.number().optional().openapi({ example: 1200, description: 'Flow in cubic feet per second' }),
  ft: z.number().optional().openapi({ example: 3.5, description: 'Stage in feet' }),
  cms: z.number().optional().openapi({ example: 34.2, description: 'Flow in cubic meters per second' }),
  m: z.number().optional().openapi({ example: 1.05, description: 'Stage in meters' }),
  temp_f: z.number().optional().openapi({ example: 68.5, description: 'Temperature in Fahrenheit' }),
  temp_c: z.number().optional().openapi({ example: 20.3, description: 'Temperature in Celsius' }),
  precip_in: z.number().optional().openapi({ example: 0.25, description: 'Precipitation in inches' }),
  precip_mm: z.number().optional().openapi({ example: 6.35, description: 'Precipitation in millimeters' })
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

export const ErrorSchema = z.object({
  error: z.string().openapi({ example: "Invalid Request" })
});
