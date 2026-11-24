import { Router } from "express";
import { prisma } from "@plexsol/database";
import {
  notificationListQuerySchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseQuery,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createNotificationsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(notificationListQuerySchema, req.query);
      const userId = req.user!.id;
      const where = {
        OR: [{ userId }, { userId: null }],
        ...(query.isRead === undefined ? {} : { isRead: query.isRead }),
      };

      const [total, unreadCount, items] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { OR: [{ userId }, { userId: null }], isRead: false },
        }),
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      res.json({
        data: items,
        meta: {
          total,
          page: query.page,
          pageSize: query.pageSize,
          unreadCount,
        },
      });
    }),
  );

  router.post(
    "/read-all",
    asyncHandler(async (req, res) => {
      const userId = req.user!.id;
      const result = await prisma.notification.updateMany({
        where: {
          OR: [{ userId }, { userId: null }],
          isRead: false,
        },
        data: { isRead: true },
      });
      res.json({ data: { updated: result.count } });
    }),
  );

  router.post(
    "/:id/read",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.notification.findUnique({ where: { id } });
      if (!existing) {
        throw new HttpError("Notification not found", 404, "not_found");
      }
      if (existing.userId && existing.userId !== req.user!.id) {
        throw new HttpError("Notification not found", 404, "not_found");
      }

      const item = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
      res.json({ data: item });
    }),
  );

  return router;
}
