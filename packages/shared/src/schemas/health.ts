import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  checks: z.object({
    database: z.enum(["up", "down"]),
  }),
  detail: z.string().optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
