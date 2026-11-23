import { decimalToString } from "./http.js";

export function serializeClient<T extends Record<string, unknown>>(row: T) {
  return row;
}

export function serializeMoneyFields<T extends Record<string, unknown>>(
  row: T,
  fields: string[],
) {
  const next: Record<string, unknown> = { ...row };
  for (const field of fields) {
    if (field in next) {
      next[field] = decimalToString(
        next[field] as { toString(): string } | null | undefined,
      );
    }
  }
  return next;
}

export function serializeProject(row: Record<string, unknown>) {
  return serializeMoneyFields(row, ["agreedPrice"]);
}

export function serializeSubscription(row: Record<string, unknown>) {
  return serializeMoneyFields(row, ["amount"]);
}

export function serializeExpense(row: Record<string, unknown>) {
  return serializeMoneyFields(row, ["amount", "amountEtb"]);
}

export function serializeRenewal(row: Record<string, unknown>) {
  const next = serializeMoneyFields(row, ["amount"]);
  if (next.expense && typeof next.expense === "object") {
    next.expense = serializeExpense(next.expense as Record<string, unknown>);
  }
  return next;
}
