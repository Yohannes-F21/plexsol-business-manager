import { Router } from "express";
import { prisma, type Prisma } from "@plexsol/database";
import {
  exchangeRateCreateSchema,
  exchangeRateListQuerySchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseBody,
  parseQuery,
  decimalToString,
  toDate,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth, requireRole } from "../middleware/auth.js";

export function createExchangeRatesRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(exchangeRateListQuerySchema, req.query);
      const where: Prisma.ExchangeRateWhereInput = {
        ...(query.fromCurrencyCode
          ? { fromCurrencyCode: query.fromCurrencyCode }
          : {}),
        ...(query.toCurrencyCode
          ? { toCurrencyCode: query.toCurrencyCode }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.exchangeRate.count({ where }),
        prisma.exchangeRate.findMany({
          where,
          orderBy: { effectiveAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      res.json({
        data: items.map((item) => ({
          ...item,
          rate: decimalToString(item.rate),
        })),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.exchangeRate.findUnique({ where: { id } });
      if (!item) throw new HttpError("Exchange rate not found", 404, "not_found");
      res.json({
        data: {
          ...item,
          rate: decimalToString(item.rate),
        },
      });
    }),
  );

  /**
   * Insert a new historical rate snapshot. Never updates an existing row —
   * uniqueness on (from, to, effectiveAt) preserves auditability.
   */
  router.post(
    "/",
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const body = parseBody(exchangeRateCreateSchema, req.body);
      const effectiveAt = toDate(body.effectiveAt);
      if (!effectiveAt) {
        throw new HttpError("effectiveAt is required", 400, "validation_error");
      }

      const [fromCurrency, toCurrency] = await Promise.all([
        prisma.currency.findUnique({ where: { code: body.fromCurrencyCode } }),
        prisma.currency.findUnique({ where: { code: body.toCurrencyCode } }),
      ]);
      if (!fromCurrency) {
        throw new HttpError(
          `Unknown currency ${body.fromCurrencyCode}`,
          400,
          "validation_error",
        );
      }
      if (!toCurrency) {
        throw new HttpError(
          `Unknown currency ${body.toCurrencyCode}`,
          400,
          "validation_error",
        );
      }

      try {
        const item = await prisma.exchangeRate.create({
          data: {
            fromCurrencyCode: body.fromCurrencyCode,
            toCurrencyCode: body.toCurrencyCode,
            rate: body.rate,
            effectiveAt,
            source: body.source ?? "manual",
          },
        });

        await prisma.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: "CREATE",
            entityType: "ExchangeRate",
            entityId: item.id,
            after: item,
            reason: "Historical exchange rate snapshot",
          },
        });

        res.status(201).json({
          data: {
            ...item,
            rate: decimalToString(item.rate),
          },
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          throw new HttpError(
            "An exchange rate already exists for this currency pair and effectiveAt — insert a new effective date instead of overwriting",
            409,
            "conflict",
          );
        }
        throw error;
      }
    }),
  );

  return router;
}
