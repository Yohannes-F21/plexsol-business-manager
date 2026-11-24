import { Router } from "express";
import { buildDashboardSnapshot, prisma } from "@plexsol/database";
import { dashboardQuerySchema, type ApiEnv } from "@plexsol/shared";
import { asyncHandler, parseQuery } from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createDashboardRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(dashboardQuerySchema, req.query);
      const snapshot = await buildDashboardSnapshot(prisma, query.period);
      res.json(snapshot);
    }),
  );

  return router;
}
