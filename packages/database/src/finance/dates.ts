/** UTC date-only helpers for billing periods (no local TZ drift). */

export function utcDateOnly(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day));
}

export function utcParts(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * Add calendar months while clamping the day to the last day of the target month.
 * Anchor day preserves activation on 29/30/31 across shorter months.
 */
export function addMonthsClamped(
  base: Date,
  months: number,
  anchorDay: number,
): Date {
  const { year, month } = utcParts(base);
  const total = month - 1 + months;
  const nextYear = year + Math.floor(total / 12);
  const nextMonth0 = ((total % 12) + 12) % 12;
  const dim = daysInMonth(nextYear, nextMonth0 + 1);
  const day = Math.min(anchorDay, dim);
  return new Date(Date.UTC(nextYear, nextMonth0, day));
}

export function addCalendarDays(date: Date, days: number): Date {
  const { year, month, day } = utcParts(date);
  return new Date(Date.UTC(year, month - 1, day + days));
}

export function dayBefore(date: Date): Date {
  return addCalendarDays(date, -1);
}

export function isBeforeOrEqual(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

export function startOfUtcDay(date: Date): Date {
  const { year, month, day } = utcParts(date);
  return utcDateOnly(year, month, day);
}
