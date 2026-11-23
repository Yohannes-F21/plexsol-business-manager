import { Router } from "express";
import { prisma } from "@plexsol/database";
import {
  paginationSchema,
  paymentMethodCreateSchema,
  paymentMethodUpdateSchema,
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

export function createPaymentMethodsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(paginationSchema, req.query);
      const where = query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {};
      const [total, items] = await Promise.all([
        prisma.paymentMethod.count({ where }),
        prisma.paymentMethod.findMany({
          where,
          orderBy: { name: "asc" },
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

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.paymentMethod.findUnique({ where: { id } });
      if (!item) throw new HttpError("Payment method not found", 404, "not_found");
      res.json({ data: item });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(paymentMethodCreateSchema, req.body);
      const item = await prisma.paymentMethod.create({ data: body });
      res.status(201).json({ data: item });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(paymentMethodUpdateSchema, req.body);
      const existing = await prisma.paymentMethod.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Payment method not found", 404, "not_found");
      const item = await prisma.paymentMethod.update({ where: { id }, data: body });
      res.json({ data: item });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.paymentMethod.findUnique({
        where: { id },
        include: {
          _count: { select: { expenses: true, clientPayments: true } },
        },
      });
      if (!existing) throw new HttpError("Payment method not found", 404, "not_found");
      if (existing._count.expenses > 0 || existing._count.clientPayments > 0) {
        await prisma.paymentMethod.update({
          where: { id },
          data: { isActive: false },
        });
        res.status(200).json({
          data: { id, deactivated: true },
          message: "Payment method deactivated because it is in use",
        });
        return;
      }
      await prisma.paymentMethod.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  return router;
}
