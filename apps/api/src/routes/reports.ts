import { Router } from "express";
import {
  buildFinancialReport,
  prisma,
  reportInputFromPeriodId,
} from "@plexsol/database";
import { reportQuerySchema, type ApiEnv } from "@plexsol/shared";
import { asyncHandler, HttpError, parseQuery } from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createReportsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(reportQuerySchema, req.query);

      try {
        const input = query.period
          ? reportInputFromPeriodId(query.period)
          : {
              preset: query.preset,
              month: query.month,
              year: query.year,
              from: query.from,
              to: query.to,
            };

        const report = await buildFinancialReport(prisma, input);
        res.json({ data: report });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Report failed";
        if (/Invalid|requires|must be/i.test(message)) {
          throw new HttpError(message, 400, "validation_error");
        }
        throw error;
      }
    }),
  );

  return router;
}
