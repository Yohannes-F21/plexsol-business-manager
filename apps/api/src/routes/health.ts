import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@plexsol/database";
import {
  healthResponseSchema,
  readinessResponseSchema,
  type HealthResponse,
  type ReadinessResponse,
} from "@plexsol/shared";

const VERSION = process.env.npm_package_version ?? "0.1.0";

export const healthRouter: ExpressRouter = Router();

/** Liveness — process is up (no dependency checks). */
healthRouter.get("/health", (_req, res) => {
  const payload: HealthResponse = {
    status: "ok",
    service: "plexsol-api",
    timestamp: new Date().toISOString(),
    version: VERSION,
  };

  const parsed = healthResponseSchema.parse(payload);
  res.status(200).json(parsed);
});

/** Readiness — database reachable for traffic. */
healthRouter.get("/health/ready", async (_req, res) => {
  let database: "up" | "down" = "down";
  let detail: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch (error) {
    detail = error instanceof Error ? error.message : "Database check failed";
  }

  const payload: ReadinessResponse = {
    status: database === "up" ? "ok" : "error",
    service: "plexsol-api",
    timestamp: new Date().toISOString(),
    version: VERSION,
    checks: { database },
    ...(detail ? { detail } : {}),
  };

  const parsed = readinessResponseSchema.parse(payload);
  res.status(database === "up" ? 200 : 503).json(parsed);
});
