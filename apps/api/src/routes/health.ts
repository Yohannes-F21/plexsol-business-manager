import { Router, type Router as ExpressRouter } from "express";
import {
  healthResponseSchema,
  type HealthResponse,
} from "@plexsol/shared";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const payload: HealthResponse = {
    status: "ok",
    service: "plexsol-api",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  };

  const parsed = healthResponseSchema.parse(payload);
  res.status(200).json(parsed);
});
