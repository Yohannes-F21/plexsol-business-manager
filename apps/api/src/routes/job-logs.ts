import { Router } from "express";
import { prisma } from "@plexsol/database";
import { paginationSchema, type ApiEnv } from "@plexsol/shared";
import { asyncHandler, parseQuery } from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth, requireRole } from "../middleware/auth.js";

export function createJobLogsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);
  router.use(requireRole("ADMIN"));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(paginationSchema, req.query);
      const [total, items] = await Promise.all([
        prisma.jobExecutionLog.count(),
        prisma.jobExecutionLog.findMany({
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      res.json({
        data: items,
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  return router;
}
