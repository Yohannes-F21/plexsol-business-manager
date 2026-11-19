import { Prisma } from "@prisma/client";

/** Decimal money helper — never use JS number arithmetic for finances. */
export type Money = Prisma.Decimal;

export function money(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function assertPositiveMoney(value: Prisma.Decimal, label = "amount"): void {
  if (value.lte(0)) {
    throw new Error(`${label} must be greater than zero`);
  }
}

export function assertMoneyNotExceeding(
  allocated: Prisma.Decimal,
  limit: Prisma.Decimal,
  label = "allocation",
): void {
  if (allocated.gt(limit)) {
    throw new Error(`${label} exceeds available amount (${allocated} > ${limit})`);
  }
}

/**
 * Convert an amount using a stored exchange rate.
 * `rate` means: 1 unit of fromCurrency = `rate` units of toCurrency.
 */
export function convertAmount(
  amount: Prisma.Decimal,
  rate: Prisma.Decimal,
): Prisma.Decimal {
  assertPositiveMoney(amount, "amount");
  assertPositiveMoney(rate, "rate");
  return amount.mul(rate).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}
