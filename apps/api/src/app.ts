import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { ApiEnv } from "@plexsol/shared";
import { HttpError } from "./lib/http.js";
import { createAuthRouter } from "./routes/auth.js";
import { createBalancesRouter } from "./routes/balances.js";
import { createClientsRouter } from "./routes/clients.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createEmailJobsRouter } from "./routes/email-jobs.js";
import { createExchangeRatesRouter } from "./routes/exchange-rates.js";
import { createExpenseCategoriesRouter } from "./routes/expense-categories.js";
import { createExpensesRouter } from "./routes/expenses.js";
import { createJobLogsRouter } from "./routes/job-logs.js";
import { createMaintenanceRouter } from "./routes/maintenance.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createPaymentMethodsRouter } from "./routes/payment-methods.js";
import { createPaymentsRouter } from "./routes/payments.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createProtectedDemoRouter } from "./routes/protected-demo.js";
import { createReportsRouter } from "./routes/reports.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createSubscriptionCategoriesRouter } from "./routes/subscription-categories.js";
import { createSubscriptionsRouter } from "./routes/subscriptions.js";
import { healthRouter } from "./routes/health.js";

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
  app.use("/api/dashboard", createDashboardRouter(env));
  app.use("/api/reports", createReportsRouter(env));
  app.use("/api/clients", createClientsRouter(env));
  app.use("/api/projects", createProjectsRouter(env));
  app.use("/api/subscriptions", createSubscriptionsRouter(env));
  app.use(
    "/api/subscription-categories",
    createSubscriptionCategoriesRouter(env),
  );
  app.use("/api/expenses", createExpensesRouter(env));
  app.use("/api/expense-categories", createExpenseCategoriesRouter(env));
  app.use("/api/payment-methods", createPaymentMethodsRouter(env));
  app.use("/api/exchange-rates", createExchangeRatesRouter(env));
  app.use("/api/payments", createPaymentsRouter(env));
  app.use("/api/maintenance", createMaintenanceRouter(env));
  app.use("/api/balances", createBalancesRouter(env));
  app.use("/api/notifications", createNotificationsRouter(env));
  app.use("/api/email-jobs", createEmailJobsRouter(env));
  app.use("/api/job-logs", createJobLogsRouter(env));
  app.use("/api/settings", createSettingsRouter(env));

  app.use((_req, res) => {
    res.status(404).json({
      error: "not_found",
      message: "Route not found",
    });
  });

  app.use(
    (
      error: Error & { status?: number; code?: string; details?: unknown },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const status =
        error instanceof HttpError
          ? error.status
          : (error.status ?? 500);
      const code =
        error instanceof HttpError
          ? error.code
          : (error.code ??
            (status === 403
              ? "forbidden"
              : status === 404
                ? "not_found"
                : "internal_error"));

      if (status >= 500) {
        console.error("[api] Unhandled error:", error);
      }

      res.status(status).json({
        error: code,
        message:
          status >= 500 ? "Internal server error" : error.message || "Request failed",
        ...(error instanceof HttpError && error.details
          ? { details: error.details }
          : {}),
      });
    },
  );

  return app;
}
