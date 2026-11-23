import { Router } from "express";
import { prisma } from "@plexsol/database";
import {
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  paginationSchema,
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

export function createExpenseCategoriesRouter(env: ApiEnv): Router {
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
        prisma.expenseCategory.count({ where }),
        prisma.expenseCategory.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { _count: { select: { expenses: true } } },
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
      const item = await prisma.expenseCategory.findUnique({
        where: { id },
        include: { _count: { select: { expenses: true } } },
      });
      if (!item) throw new HttpError("Category not found", 404, "not_found");
      res.json({ data: item });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(expenseCategoryCreateSchema, req.body);
      const item = await prisma.expenseCategory.create({
        data: { ...body, isSystem: false },
      });
      res.status(201).json({ data: item });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(expenseCategoryUpdateSchema, req.body);
      const existing = await prisma.expenseCategory.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Category not found", 404, "not_found");
      if (existing.isSystem && body.slug && body.slug !== existing.slug) {
        throw new HttpError("Cannot change system category slug", 409, "conflict");
      }
      const item = await prisma.expenseCategory.update({ where: { id }, data: body });
      res.json({ data: item });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.expenseCategory.findUnique({
        where: { id },
        include: { _count: { select: { expenses: true } } },
      });
      if (!existing) throw new HttpError("Category not found", 404, "not_found");
      if (existing.isSystem) {
        throw new HttpError("Cannot delete system category", 409, "conflict");
      }
      if (existing._count.expenses > 0) {
        throw new HttpError("Cannot delete category with expenses", 409, "conflict");
      }
      await prisma.expenseCategory.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  return router;
}
