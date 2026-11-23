import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { ApiEnv } from "@plexsol/shared";
import { createAuthRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { createProtectedDemoRouter } from "./routes/protected-demo.js";

export function createApp(env: ApiEnv): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser(env.SESSION_SECRET));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use(healthRouter);
  app.use("/api/auth", createAuthRouter(env));
  app.use("/api/secure", createProtectedDemoRouter(env));

  app.use((_req, res) => {
    res.status(404).json({
      error: "not_found",
      message: "Route not found",
    });
  });

  app.use(
    (
      error: Error & { status?: number; code?: string },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const status = error.status ?? 500;
      if (status >= 500) {
        console.error("[api] Unhandled error:", error);
      }

      res.status(status).json({
        error: error.code ?? (status === 403 ? "forbidden" : "internal_error"),
        message:
          status >= 500 ? "Internal server error" : error.message || "Request failed",
      });
    },
  );

  return app;
}
