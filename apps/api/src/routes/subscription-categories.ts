import { Router } from "express";
import { prisma } from "@plexsol/database";
import {
  paginationSchema,
  subscriptionCategoryCreateSchema,
  subscriptionCategoryUpdateSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseBody,
  parseQuery,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createSubscriptionCategoriesRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(paginationSchema, req.query);
      const where = query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { slug: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [total, items] = await Promise.all([
        prisma.subscriptionCategory.count({ where }),
        prisma.subscriptionCategory.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { _count: { select: { subscriptions: true } } },
        }),
      ]);
      res.json({
        data: items,
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.subscriptionCategory.findUnique({
        where: { id },
        include: { _count: { select: { subscriptions: true } } },
      });
      if (!item) throw new HttpError("Category not found", 404, "not_found");
      res.json({ data: item });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(subscriptionCategoryCreateSchema, req.body);
      const item = await prisma.subscriptionCategory.create({ data: body });
      res.status(201).json({ data: item });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(subscriptionCategoryUpdateSchema, req.body);
      const existing = await prisma.subscriptionCategory.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Category not found", 404, "not_found");
      const item = await prisma.subscriptionCategory.update({ where: { id }, data: body });
      res.json({ data: item });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.subscriptionCategory.findUnique({
        where: { id },
        include: { _count: { select: { subscriptions: true } } },
      });
      if (!existing) throw new HttpError("Category not found", 404, "not_found");
      if (existing._count.subscriptions > 0) {
        throw new HttpError(
          "Cannot delete category with subscriptions",
          409,
          "conflict",
        );
      }
      await prisma.subscriptionCategory.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  return router;
}
