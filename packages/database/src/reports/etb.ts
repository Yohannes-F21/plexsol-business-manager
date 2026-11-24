import type { Prisma, PrismaClient } from "@prisma/client";
import { convertAmount, money } from "../money.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type EtbRateCache = Map<string, Prisma.Decimal>;

/**
 * Prefetch latest USD/EUR/… → ETB rates at or before `asOf` into a cache
 * so report builders avoid N+1 exchange-rate queries.
 */
export async function loadEtbRateCache(
  db: Db,
  asOf: Date,
  currencyCodes: string[],
): Promise<EtbRateCache> {
  const cache: EtbRateCache = new Map();
  const unique = [...new Set(currencyCodes.filter((code) => code !== "ETB"))];

  await Promise.all(
    unique.map(async (code) => {
      const rate = await db.exchangeRate.findFirst({
        where: {
          fromCurrencyCode: code,
          toCurrencyCode: "ETB",
          effectiveAt: { lte: asOf },
        },
        orderBy: { effectiveAt: "desc" },
      });
      if (rate) {
        cache.set(code, money(rate.rate));
      }
    }),
  );

  return cache;
}

export function amountToEtbCached(
  cache: EtbRateCache,
  input: {
    amount: string | Prisma.Decimal;
    currencyCode: string;
  },
): Prisma.Decimal {
  const amount = money(input.amount);
  if (input.currencyCode === "ETB") {
    return amount;
  }
  const rate = cache.get(input.currencyCode);
  if (!rate) {
    throw new Error(
      `No historical ${input.currencyCode}→ETB rate available for reporting`,
    );
  }
  return convertAmount(amount, rate);
}

/**
 * Convert an amount to ETB using the latest historical rate at or before `asOf`.
 * Prefer stored `amountEtb` snapshots on payments/expenses when available.
 */
export async function amountToEtb(
  db: Db,
  input: {
    amount: string | Prisma.Decimal;
    currencyCode: string;
    asOf: Date;
  },
): Promise<Prisma.Decimal> {
  const cache = await loadEtbRateCache(db, input.asOf, [input.currencyCode]);
  return amountToEtbCached(cache, input);
}

export function sumDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, value) => acc.add(value), money(0));
}
