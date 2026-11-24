const moneyFormatterCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string) {
  const code = currency || "ETB";
  let formatter = moneyFormatterCache.get(code);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatterCache.set(code, formatter);
  }
  return formatter;
}

/** Display helper only — never use for money arithmetic. */
export function formatMoney(amount: string | number, currency = "ETB"): string {
  return moneyFormatter(currency).format(Number(amount));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function labelize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Whole calendar days from today (UTC date) until the given date. Display helper only. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const target = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const end = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  return Math.round((end - start) / 86_400_000);
}
