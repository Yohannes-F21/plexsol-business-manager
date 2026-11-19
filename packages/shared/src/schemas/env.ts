import { z } from "zod";

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  DIRECT_URL: z.string().url().optional(),
});

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(16).optional(),
  DATABASE_URL: z.string().url().optional(),
});

export const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  WORKER_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  DATABASE_URL: z.string().url().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
