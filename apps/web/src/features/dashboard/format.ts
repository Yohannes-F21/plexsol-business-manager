import type { MoneyAmount } from "./types";

const etbFormatter = new Intl.NumberFormat("en-ET", {
  style: "currency",
  currency: "ETB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format reporting amounts in ETB. Do not use JS float arithmetic for business logic. */
export function formatEtb(value: MoneyAmount | string): string {
  const raw = typeof value === "string" ? value : value.amount;
  return etbFormatter.format(Number(raw));
}

export function formatCompactEtb(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "ETB 0";
  return etbFormatter.format(n);
}

export function daysRemainingLabel(days: number): string {
  if (days <= 0) return "Expired";
  if (days === 1) return "1 day";
  return `${days} days`;
}
