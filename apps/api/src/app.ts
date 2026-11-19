import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { ApiEnv } from "@plexsol/shared";
import { healthRouter } from "./routes/health.js";

export function createApp(env: ApiEnv): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use(healthRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: "not_found",
      message: "Route not found",
    });
  });

  return app;
}
