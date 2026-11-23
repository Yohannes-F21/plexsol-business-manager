import { Router } from "express";
import {
  confirmSubscriptionRenewal,
  prisma,
  type Prisma,
} from "@plexsol/database";
import {
  subscriptionCreateSchema,
  subscriptionListQuerySchema,
  subscriptionRenewalCreateSchema,
  subscriptionUpdateSchema,
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
import { serializeRenewal, serializeSubscription } from "../lib/serialize.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

function mapRenewalHttpError(error: unknown): HttpError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  const message = error instanceof Error ? error.message : "Renewal failed";

  if (code === "P2025" || /No .* found|not found/i.test(message)) {
    return new HttpError("Subscription not found", 404, "not_found");
  }

  if (
    /amountEtb or exchangeRateId|Exchange rate must|Missing system expense|positive/i.test(
      message,
    )
  ) {
    return new HttpError(message, 400, "validation_error");
  }

  return new HttpError(message, 400, "renewal_error");
}

export function createSubscriptionsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(subscriptionListQuerySchema, req.query);
      const where: Prisma.SubscriptionWhereInput = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { vendor: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [total, items] = await Promise.all([
        prisma.subscription.count({ where }),
        prisma.subscription.findMany({
          where,
          orderBy: { expirationDate: "asc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { category: true },
        }),
      ]);
      res.json({
        data: items.map((item) =>
          serializeSubscription(item as unknown as Record<string, unknown>),
        ),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.subscription.findUnique({
        where: { id },
        include: {
          category: true,
          renewals: { orderBy: { renewedAt: "desc" }, include: { expense: true } },
        },
      });
      if (!item) throw new HttpError("Subscription not found", 404, "not_found");
      res.json({
        data: {
          ...serializeSubscription(item as unknown as Record<string, unknown>),
          renewals: item.renewals.map((renewal) =>
            serializeRenewal(renewal as unknown as Record<string, unknown>),
          ),
        },
      });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(subscriptionCreateSchema, req.body);
      if (body.categoryId) {
        const category = await prisma.subscriptionCategory.findUnique({
          where: { id: body.categoryId },
        });
        if (!category) throw new HttpError("Category not found", 404, "not_found");
      }

      const startDate = toDate(body.startDate);
      const expirationDate = toDate(body.expirationDate);
      if (!startDate || !expirationDate) {
        throw new HttpError("startDate and expirationDate are required", 400, "validation_error");
      }

      const item = await prisma.subscription.create({
        data: {
          name: body.name,
          vendor: body.vendor ?? null,
          categoryId: body.categoryId ?? null,
          amount: body.amount,
          currencyCode: body.currencyCode ?? "ETB",
          billingPeriod: body.billingPeriod,
          startDate,
          expirationDate,
          status: body.status ?? "ACTIVE",
          reminderDaysBefore: body.reminderDaysBefore ?? [30, 14, 7, 1],
          url: body.url ?? null,
          notes: body.notes,
        },
        include: { category: true },
      });

      res.status(201).json({
        data: serializeSubscription(item as unknown as Record<string, unknown>),
      });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(subscriptionUpdateSchema, req.body);
      const existing = await prisma.subscription.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Subscription not found", 404, "not_found");

      const item = await prisma.subscription.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.vendor !== undefined ? { vendor: body.vendor } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.currencyCode !== undefined ? { currencyCode: body.currencyCode } : {}),
          ...(body.billingPeriod !== undefined ? { billingPeriod: body.billingPeriod } : {}),
          ...(body.startDate !== undefined
            ? { startDate: toDate(body.startDate) ?? undefined }
            : {}),
          ...(body.expirationDate !== undefined
            ? { expirationDate: toDate(body.expirationDate) ?? undefined }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.reminderDaysBefore !== undefined
            ? { reminderDaysBefore: body.reminderDaysBefore }
            : {}),
          ...(body.url !== undefined ? { url: body.url } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
        include: { category: true },
      });

      res.json({
        data: serializeSubscription(item as unknown as Record<string, unknown>),
      });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.subscription.findUnique({
        where: { id },
        include: { _count: { select: { renewals: true } } },
      });
      if (!existing) throw new HttpError("Subscription not found", 404, "not_found");
      if (existing._count.renewals > 0) {
        throw new HttpError(
          "Cannot delete subscription with renewals — mark CANCELLED instead",
          409,
          "conflict",
        );
      }
      await prisma.subscription.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  router.post(
    "/:id/renewals",
    asyncHandler(async (req, res) => {
      const subscriptionId = paramId(req);
      const body = parseBody(subscriptionRenewalCreateSchema, {
        ...req.body,
        subscriptionId,
      });

      const newExpirationDate = toDate(body.newExpirationDate);
      if (!newExpirationDate) {
        throw new HttpError("newExpirationDate is required", 400, "validation_error");
      }

      try {
        const renewal = await confirmSubscriptionRenewal(prisma, {
          subscriptionId,
          renewedAt: toDate(body.renewedAt) ?? undefined,
          newExpirationDate,
          amount: body.amount,
          currencyCode: body.currencyCode ?? "ETB",
          amountEtb: body.amountEtb,
          exchangeRateId: body.exchangeRateId ?? undefined,
          paymentMethodId: body.paymentMethodId ?? undefined,
          confirmedById: req.user?.id,
          notes: body.notes ?? undefined,
        });

        const full = await prisma.subscriptionRenewal.findUniqueOrThrow({
          where: { id: renewal.id },
          include: { expense: true, subscription: true },
        });

        res.status(201).json({
          data: serializeRenewal(full as unknown as Record<string, unknown>),
        });
      } catch (error) {
        throw mapRenewalHttpError(error);
      }
    }),
  );

  return router;
}
