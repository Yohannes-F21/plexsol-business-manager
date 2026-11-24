import { Prisma, type PrismaClient } from "@prisma/client";
import { money } from "../money.js";
import { startOfUtcDay, addCalendarDays, utcParts } from "../finance/dates.js";
import {
  amountToEtbCached,
  loadEtbRateCache,
  sumDecimal,
} from "./etb.js";
import {
  listAvailableReportPeriods,
  monthKeysInRange,
  resolveReportPeriod,
  type ReportPeriodInput,
  type ResolvedReportPeriod,
} from "./period.js";

type Db = PrismaClient;

export type MonthlyCashFlowPoint = {
  month: string;
  label: string;
  incomeEtb: string;
  expensesEtb: string;
  netCashFlowEtb: string;
};

export type OutstandingClientRow = {
  clientId: string;
  clientName: string;
  projectOutstandingEtb: string;
  billingOutstandingEtb: string;
  totalOutstandingEtb: string;
};

export type RenewalForecastRow = {
  subscriptionId: string;
  name: string;
  vendor: string | null;
  expirationDate: string;
  daysRemaining: number;
  amountEtb: string;
  currencyCode: string;
  billingPeriod: string;
};

export type ProjectSummaryRow = {
  projectId: string;
  name: string;
  clientName: string;
  status: string;
  currencyCode: string;
  agreedPrice: string;
  agreedPriceEtb: string;
  amountAllocated: string;
  amountAllocatedEtb: string;
  outstandingEtb: string;
};

export type MaintenanceRecurringRow = {
  agreementId: string;
  projectName: string;
  clientName: string;
  billingFrequency: string;
  currencyCode: string;
  amount: string;
  monthlyEtb: string;
};

export type FinancialReport = {
  reportingCurrency: "ETB";
  period: {
    id: string;
    label: string;
    preset: ResolvedReportPeriod["preset"];
    from: string;
    to: string;
  };
  availablePeriods: ReturnType<typeof listAvailableReportPeriods>;
  totals: {
    incomeEtb: string;
    expensesEtb: string;
    netCashFlowEtb: string;
    recurringMaintenanceMonthlyEtb: string;
    outstandingClientsEtb: string;
  };
  monthlySeries: MonthlyCashFlowPoint[];
  outstandingBalances: OutstandingClientRow[];
  renewalForecasts: RenewalForecastRow[];
  projectSummaries: ProjectSummaryRow[];
  maintenanceRecurring: MaintenanceRecurringRow[];
};

function ymd(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function parseYearMonth(key: string): { year: number; month: number } {
  const [yearPart, monthPart] = key.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`Invalid month key "${key}"`);
  }
  return { year, month };
}

function monthLabel(key: string): string {
  const { year, month } = parseYearMonth(key);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthlyEquivalent(
  amount: Prisma.Decimal,
  frequency: "MONTHLY" | "YEARLY",
): Prisma.Decimal {
  if (frequency === "YEARLY") {
    return amount.div(12).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  }
  return amount;
}

async function cashFlowForRange(
  db: Db,
  from: Date,
  toExclusive: Date,
): Promise<{ income: Prisma.Decimal; expenses: Prisma.Decimal }> {
  const [payments, expenses] = await Promise.all([
    db.clientPayment.aggregate({
      where: { paidAt: { gte: from, lt: toExclusive } },
      _sum: { amountEtb: true },
    }),
    db.expense.aggregate({
      where: { incurredAt: { gte: from, lt: toExclusive } },
      _sum: { amountEtb: true },
    }),
  ]);

  return {
    income: money(payments._sum.amountEtb ?? 0),
    expenses: money(expenses._sum.amountEtb ?? 0),
  };
}

function monthKeyFromDate(date: Date): string {
  const { year, month } = utcParts(startOfUtcDay(date));
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function monthlyCashFlowSeries(
  db: Db,
  seriesKeys: string[],
): Promise<MonthlyCashFlowPoint[]> {
  if (!seriesKeys.length) return [];
  const first = parseYearMonth(seriesKeys[0]!);
  const last = parseYearMonth(seriesKeys[seriesKeys.length - 1]!);
  const from = startOfUtcDay(new Date(Date.UTC(first.year, first.month - 1, 1)));
  const toExclusive = startOfUtcDay(
    new Date(Date.UTC(last.year, last.month, 1)),
  );

  const [payments, expenses] = await Promise.all([
    db.clientPayment.findMany({
      where: { paidAt: { gte: from, lt: toExclusive } },
      select: { paidAt: true, amountEtb: true },
    }),
    db.expense.findMany({
      where: { incurredAt: { gte: from, lt: toExclusive } },
      select: { incurredAt: true, amountEtb: true },
    }),
  ]);

  const incomeByMonth = new Map<string, Prisma.Decimal>();
  const expenseByMonth = new Map<string, Prisma.Decimal>();
  for (const key of seriesKeys) {
    incomeByMonth.set(key, money(0));
    expenseByMonth.set(key, money(0));
  }

  for (const payment of payments) {
    const key = monthKeyFromDate(payment.paidAt);
    if (!incomeByMonth.has(key)) continue;
    incomeByMonth.set(key, incomeByMonth.get(key)!.add(money(payment.amountEtb)));
  }
  for (const expense of expenses) {
    const key = monthKeyFromDate(expense.incurredAt);
    if (!expenseByMonth.has(key)) continue;
    expenseByMonth.set(
      key,
      expenseByMonth.get(key)!.add(money(expense.amountEtb)),
    );
  }

  return seriesKeys.map((key) => {
    const income = incomeByMonth.get(key) ?? money(0);
    const expensesTotal = expenseByMonth.get(key) ?? money(0);
    return {
      month: key,
      label: monthLabel(key),
      incomeEtb: income.toFixed(2),
      expensesEtb: expensesTotal.toFixed(2),
      netCashFlowEtb: income.sub(expensesTotal).toFixed(2),
    };
  });
}

/**
 * Full financial report in ETB using historical payment/expense snapshots
 * and exchange-rate lookups for outstanding / forecast balances.
 */
export async function buildFinancialReport(
  db: Db,
  input: ReportPeriodInput = {},
): Promise<FinancialReport> {
  const period = resolveReportPeriod(input);
  const asOf = period.to;
  const availablePeriods = listAvailableReportPeriods(input.asOf ?? new Date());

  const periodCash = await cashFlowForRange(db, period.from, period.toExclusive);

  // Monthly series: for month preset show trailing 6 months ending at selected month;
  // for year/custom, one point per calendar month in range.
  let seriesKeys: string[];
  if (period.preset === "month") {
    const { year: ey, month: em } = parseYearMonth(period.id);
    seriesKeys = [];
    for (let i = 5; i >= 0; i -= 1) {
      const total = em - 1 - i;
      const y = ey + Math.floor(total / 12);
      const m0 = ((total % 12) + 12) % 12;
      seriesKeys.push(`${y}-${String(m0 + 1).padStart(2, "0")}`);
    }
  } else {
    seriesKeys = monthKeysInRange(period.from, period.to);
  }

  const monthlySeries = await monthlyCashFlowSeries(db, seriesKeys);

  // Prefetch FX once for outstanding / forecasts / projects / maintenance.
  const [clients, cycles, subscriptions, projects, agreements, allocationGroups] =
    await Promise.all([
      db.client.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
          projects: { where: { status: { not: "CANCELLED" } } },
        },
      }),
      db.maintenanceBillingCycle.findMany({
        where: { status: { notIn: ["PAID", "CANCELLED"] } },
        include: {
          agreement: { include: { project: { include: { client: true } } } },
        },
      }),
      db.subscription.findMany({
        where: {
          status: { not: "CANCELLED" },
          expirationDate: { gte: asOf, lte: addCalendarDays(asOf, 90) },
        },
        orderBy: { expirationDate: "asc" },
      }),
      db.project.findMany({
        where: { status: { not: "CANCELLED" } },
        include: { client: true },
        orderBy: { name: "asc" },
      }),
      db.maintenanceAgreement.findMany({
        where: { status: "ACTIVE" },
        include: { project: { include: { client: true } } },
      }),
      db.paymentAllocation.groupBy({
        by: ["projectId"],
        where: { projectId: { not: null } },
        _sum: { amount: true },
      }),
    ]);

  const allocatedByProject = new Map(
    allocationGroups
      .filter((row) => row.projectId)
      .map((row) => [row.projectId!, money(row._sum.amount ?? 0)]),
  );

  const currencies = [
    ...clients.flatMap((client) =>
      client.projects.map((project) => project.currencyCode),
    ),
    ...cycles.map((cycle) => cycle.currencyCode),
    ...subscriptions.map((sub) => sub.currencyCode),
    ...projects.map((project) => project.currencyCode),
    ...agreements.map((agreement) => agreement.currencyCode),
  ];
  const rateCache = await loadEtbRateCache(db, asOf, currencies);

  const outstandingBalances: OutstandingClientRow[] = [];
  for (const client of clients) {
    let projectOut = money(0);
    for (const project of client.projects) {
      const allocated = allocatedByProject.get(project.id) ?? money(0);
      const outstanding = money(project.agreedPrice).sub(allocated);
      if (outstanding.lte(0)) continue;
      projectOut = projectOut.add(
        amountToEtbCached(rateCache, {
          amount: outstanding,
          currencyCode: project.currencyCode,
        }),
      );
    }

    let cycleOut = money(0);
    for (const cycle of cycles) {
      if (cycle.agreement.project.clientId !== client.id) continue;
      const outstanding = money(cycle.amount).sub(money(cycle.amountAllocated));
      if (outstanding.lte(0)) continue;
      cycleOut = cycleOut.add(
        amountToEtbCached(rateCache, {
          amount: outstanding,
          currencyCode: cycle.currencyCode,
        }),
      );
    }

    const total = projectOut.add(cycleOut);
    if (total.lte(0)) continue;
    outstandingBalances.push({
      clientId: client.id,
      clientName: client.name,
      projectOutstandingEtb: projectOut.toFixed(2),
      billingOutstandingEtb: cycleOut.toFixed(2),
      totalOutstandingEtb: total.toFixed(2),
    });
  }

  const outstandingClientsEtb = sumDecimal(
    outstandingBalances.map((row) => money(row.totalOutstandingEtb)),
  );

  const renewalForecasts: RenewalForecastRow[] = subscriptions.map((sub) => {
    const amountEtb = amountToEtbCached(rateCache, {
      amount: sub.amount,
      currencyCode: sub.currencyCode,
    });
    const daysRemaining = Math.round(
      (startOfUtcDay(sub.expirationDate).getTime() - asOf.getTime()) /
        (24 * 60 * 60 * 1000),
    );
    return {
      subscriptionId: sub.id,
      name: sub.name,
      vendor: sub.vendor,
      expirationDate: ymd(sub.expirationDate),
      daysRemaining,
      amountEtb: amountEtb.toFixed(2),
      currencyCode: sub.currencyCode,
      billingPeriod: sub.billingPeriod,
    };
  });

  const projectSummaries: ProjectSummaryRow[] = projects.map((project) => {
    const allocated = allocatedByProject.get(project.id) ?? money(0);
    const outstanding = money(project.agreedPrice).sub(allocated);
    const agreedEtb = amountToEtbCached(rateCache, {
      amount: project.agreedPrice,
      currencyCode: project.currencyCode,
    });
    const allocatedEtb = amountToEtbCached(rateCache, {
      amount: allocated,
      currencyCode: project.currencyCode,
    });
    const outstandingEtb = outstanding.lte(0)
      ? money(0)
      : amountToEtbCached(rateCache, {
          amount: outstanding,
          currencyCode: project.currencyCode,
        });

    return {
      projectId: project.id,
      name: project.name,
      clientName: project.client.name,
      status: project.status,
      currencyCode: project.currencyCode,
      agreedPrice: project.agreedPrice.toString(),
      agreedPriceEtb: agreedEtb.toFixed(2),
      amountAllocated: allocated.toString(),
      amountAllocatedEtb: allocatedEtb.toFixed(2),
      outstandingEtb: outstandingEtb.toFixed(2),
    };
  });

  const maintenanceRecurring: MaintenanceRecurringRow[] = [];
  let recurringTotal = money(0);
  for (const agreement of agreements) {
    const etb = amountToEtbCached(rateCache, {
      amount: agreement.amount,
      currencyCode: agreement.currencyCode,
    });
    const monthly = monthlyEquivalent(
      etb,
      agreement.billingFrequency === "YEARLY" ? "YEARLY" : "MONTHLY",
    );
    recurringTotal = recurringTotal.add(monthly);
    maintenanceRecurring.push({
      agreementId: agreement.id,
      projectName: agreement.project.name,
      clientName: agreement.project.client.name,
      billingFrequency: agreement.billingFrequency,
      currencyCode: agreement.currencyCode,
      amount: agreement.amount.toString(),
      monthlyEtb: monthly.toFixed(2),
    });
  }

  return {
    reportingCurrency: "ETB",
    period: {
      id: period.id,
      label: period.label,
      preset: period.preset,
      from: ymd(period.from),
      to: ymd(period.to),
    },
    availablePeriods,
    totals: {
      incomeEtb: periodCash.income.toFixed(2),
      expensesEtb: periodCash.expenses.toFixed(2),
      netCashFlowEtb: periodCash.income.sub(periodCash.expenses).toFixed(2),
      recurringMaintenanceMonthlyEtb: recurringTotal.toFixed(2),
      outstandingClientsEtb: outstandingClientsEtb.toFixed(2),
    },
    monthlySeries,
    outstandingBalances,
    renewalForecasts,
    projectSummaries,
    maintenanceRecurring,
  };
}

/** Convenience for dashboard period id like "2026-11" or "2026". */
export function reportInputFromPeriodId(
  periodId?: string,
  asOf?: Date,
): ReportPeriodInput {
  if (!periodId) {
    const parts = utcParts(startOfUtcDay(asOf ?? new Date()));
    return {
      preset: "month",
      month: `${parts.year}-${String(parts.month).padStart(2, "0")}`,
      asOf,
    };
  }
  if (/^\d{4}$/.test(periodId)) {
    return { preset: "year", year: periodId, asOf };
  }
  if (/^\d{4}-\d{2}$/.test(periodId)) {
    return { preset: "month", month: periodId, asOf };
  }
  if (periodId.startsWith("custom:")) {
    const [, from, to] = periodId.split(":");
    return { preset: "custom", from, to, asOf };
  }
  return { preset: "month", asOf };
}
