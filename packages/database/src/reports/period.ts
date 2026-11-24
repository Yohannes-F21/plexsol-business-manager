import { addCalendarDays, startOfUtcDay, utcParts } from "../finance/dates.js";

export type ReportPreset = "month" | "year" | "custom";

export type ReportPeriodInput = {
  preset?: ReportPreset;
  /** YYYY-MM for month preset */
  month?: string;
  /** YYYY for year preset */
  year?: string;
  /** Inclusive start (YYYY-MM-DD) for custom */
  from?: string;
  /** Inclusive end (YYYY-MM-DD) for custom */
  to?: string;
  /** Anchor "now" for defaults (tests) */
  asOf?: Date;
};

export type ResolvedReportPeriod = {
  preset: ReportPreset;
  from: Date;
  to: Date;
  /** Exclusive end bound for SQL `lt` queries */
  toExclusive: Date;
  label: string;
  id: string;
};

function parseYmd(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid date "${value}" — expected YYYY-MM-DD`);
  }
  return startOfUtcDay(
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))),
  );
}

function monthBounds(year: number, month1to12: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, month1to12 - 1, 1));
  const to = new Date(Date.UTC(year, month1to12, 0)); // last day of month
  return { from: startOfUtcDay(from), to: startOfUtcDay(to) };
}

function yearBounds(year: number): { from: Date; to: Date } {
  return {
    from: startOfUtcDay(new Date(Date.UTC(year, 0, 1))),
    to: startOfUtcDay(new Date(Date.UTC(year, 11, 31))),
  };
}

function formatMonthLabel(year: number, month1to12: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month1to12 - 1, 1)));
}

/** Resolve monthly / yearly / custom report windows (UTC date-only). */
export function resolveReportPeriod(input: ReportPeriodInput = {}): ResolvedReportPeriod {
  const asOf = startOfUtcDay(input.asOf ?? new Date());
  const preset = input.preset ?? (input.from || input.to ? "custom" : "month");

  if (preset === "month") {
    let year: number;
    let month: number;
    if (input.month) {
      const match = /^(\d{4})-(\d{2})$/.exec(input.month.trim());
      if (!match) throw new Error(`Invalid month "${input.month}" — expected YYYY-MM`);
      year = Number(match[1]);
      month = Number(match[2]);
      if (month < 1 || month > 12) throw new Error(`Invalid month "${input.month}"`);
    } else {
      const parts = utcParts(asOf);
      year = parts.year;
      month = parts.month;
    }
    const { from, to } = monthBounds(year, month);
    return {
      preset: "month",
      from,
      to,
      toExclusive: addCalendarDays(to, 1),
      label: formatMonthLabel(year, month),
      id: `${year}-${String(month).padStart(2, "0")}`,
    };
  }

  if (preset === "year") {
    const year = input.year
      ? Number(input.year)
      : utcParts(asOf).year;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error(`Invalid year "${input.year}"`);
    }
    const { from, to } = yearBounds(year);
    return {
      preset: "year",
      from,
      to,
      toExclusive: addCalendarDays(to, 1),
      label: String(year),
      id: String(year),
    };
  }

  if (!input.from || !input.to) {
    throw new Error("Custom period requires from and to (YYYY-MM-DD)");
  }
  const from = parseYmd(input.from);
  const to = parseYmd(input.to);
  if (to.getTime() < from.getTime()) {
    throw new Error("Custom period to must be on or after from");
  }
  return {
    preset: "custom",
    from,
    to,
    toExclusive: addCalendarDays(to, 1),
    label: `${input.from} → ${input.to}`,
    id: `custom:${input.from}:${input.to}`,
  };
}

/** Last 12 calendar months + current year for UI selectors. */
export function listAvailableReportPeriods(asOf = new Date()): Array<{
  id: string;
  label: string;
  preset: ReportPreset;
  month?: string;
  year?: string;
}> {
  const anchor = startOfUtcDay(asOf);
  const { year, month } = utcParts(anchor);
  const periods: Array<{
    id: string;
    label: string;
    preset: ReportPreset;
    month?: string;
    year?: string;
  }> = [];

  periods.push({
    id: String(year),
    label: `Year ${year}`,
    preset: "year",
    year: String(year),
  });

  for (let i = 0; i < 12; i += 1) {
    const total = month - 1 - i;
    const y = year + Math.floor(total / 12);
    const m0 = ((total % 12) + 12) % 12;
    const m = m0 + 1;
    const id = `${y}-${String(m).padStart(2, "0")}`;
    periods.push({
      id,
      label: formatMonthLabel(y, m),
      preset: "month",
      month: id,
    });
  }

  return periods;
}

/** Inclusive month keys YYYY-MM from period.from through period.to. */
export function monthKeysInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let y = utcParts(from).year;
  let m = utcParts(from).month;
  const endY = utcParts(to).year;
  const endM = utcParts(to).month;
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}
