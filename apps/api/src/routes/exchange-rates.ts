import { Router } from "express";
import { prisma, type Prisma } from "@plexsol/database";
import { exchangeRateListQuerySchema, type ApiEnv } from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseQuery,
  decimalToString,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

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

  return router;
}
