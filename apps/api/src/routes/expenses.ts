import { Router } from "express";
import { money, prisma, type Prisma } from "@plexsol/database";
import {
  expenseCreateSchema,
  expenseListQuerySchema,
  expenseUpdateSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseBody,
  parseQuery,
  toDate,
} from "../lib/http.js";
import { serializeExpense } from "../lib/serialize.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createExpensesRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(expenseListQuerySchema, req.query);
      const where: Prisma.ExpenseWhereInput = {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? { description: { contains: query.search, mode: "insensitive" } }
          : {}),
      };
      const [total, items] = await Promise.all([
        prisma.expense.count({ where }),
        prisma.expense.findMany({
          where,
          orderBy: { incurredAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { category: true, paymentMethod: true },
        }),
      ]);
      res.json({
        data: items.map((item) =>
          serializeExpense(item as unknown as Record<string, unknown>),
        ),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.expense.findUnique({
        where: { id },
        include: { category: true, paymentMethod: true, renewal: true },
      });
      if (!item) throw new HttpError("Expense not found", 404, "not_found");
      res.json({
        data: serializeExpense(item as unknown as Record<string, unknown>),
      });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(expenseCreateSchema, req.body);
      const category = await prisma.expenseCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) throw new HttpError("Category not found", 404, "not_found");
      if (category.slug === "subscription_renewal") {
        throw new HttpError(
          "Use subscription renewal flow for subscription renewal expenses",
          400,
          "validation_error",
        );
      }

      const incurredAt = toDate(body.incurredAt);
      if (!incurredAt) {
        throw new HttpError("incurredAt is required", 400, "validation_error");
      }

      const amount = money(body.amount);
      const amountEtb =
        body.amountEtb != null
          ? money(body.amountEtb)
          : body.currencyCode === "ETB" || !body.currencyCode
            ? amount
            : null;
      if (!amountEtb) {
        throw new HttpError(
          "amountEtb is required for non-ETB expenses",
          400,
          "validation_error",
        );
      }

      const item = await prisma.expense.create({
        data: {
          categoryId: body.categoryId,
          amount,
          currencyCode: body.currencyCode ?? "ETB",
          amountEtb,
          exchangeRateId: body.exchangeRateId ?? null,
          description: body.description,
          incurredAt,
          paymentMethodId: body.paymentMethodId ?? null,
          isSubscriptionRenewal: false,
          createdById: req.user?.id,
        },
        include: { category: true, paymentMethod: true },
      });

      res.status(201).json({
        data: serializeExpense(item as unknown as Record<string, unknown>),
      });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(expenseUpdateSchema, req.body);
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Expense not found", 404, "not_found");
      if (existing.isSubscriptionRenewal) {
        throw new HttpError(
          "Subscription renewal expenses are immutable — correct via audit flow later",
          409,
          "conflict",
        );
      }

      const item = await prisma.expense.update({
        where: { id },
        data: {
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.currencyCode !== undefined ? { currencyCode: body.currencyCode } : {}),
          ...(body.amountEtb !== undefined ? { amountEtb: body.amountEtb } : {}),
          ...(body.exchangeRateId !== undefined
            ? { exchangeRateId: body.exchangeRateId }
            : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.incurredAt !== undefined
            ? { incurredAt: toDate(body.incurredAt) ?? undefined }
            : {}),
          ...(body.paymentMethodId !== undefined
            ? { paymentMethodId: body.paymentMethodId }
            : {}),
        },
        include: { category: true, paymentMethod: true },
      });

      res.json({
        data: serializeExpense(item as unknown as Record<string, unknown>),
      });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.expense.findUnique({
        where: { id },
        include: { renewal: true },
      });
      if (!existing) throw new HttpError("Expense not found", 404, "not_found");
      if (existing.isSubscriptionRenewal || existing.renewal) {
        throw new HttpError(
          "Cannot delete subscription renewal expense",
          409,
          "conflict",
        );
      }
      await prisma.expense.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  return router;
}
