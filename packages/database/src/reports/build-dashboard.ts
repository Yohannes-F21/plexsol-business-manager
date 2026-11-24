import type { PrismaClient } from "@prisma/client";
import { money } from "../money.js";
import { startOfUtcDay, addCalendarDays } from "../finance/dates.js";
import {
  buildFinancialReport,
  reportInputFromPeriodId,
} from "./build-report.js";

export type DashboardSnapshotPayload = {
  source: "api";
  reportingCurrency: "ETB";
  period: { id: string; label: string };
  availablePeriods: Array<{ id: string; label: string }>;
  kpis: Array<{
    id: "total_income" | "total_expenses" | "net_cash_flow" | "recurring_maintenance";
    label: string;
    value: { amount: string; currency: "ETB" };
    suffix?: string;
    footnote?: string;
    trend?: {
      direction: "up" | "down" | "flat";
      label: string;
      comparisonLabel: string;
      sentiment: "positive" | "negative" | "neutral";
    };
  }>;
  monthlyOverview: Array<{
    month: string;
    income: string;
    expenses: string;
    netCashFlow: string;
  }>;
  attentionItems: Array<{
    id: string;
    category: string;
    title: string;
    detail: string;
    severity: "action" | "pending" | "retrying";
  }>;
  summaries: Array<{
    id: "subscriptions" | "maintenance" | "projects";
    title: string;
    rows: Array<{
      label: string;
      count: number;
      tone: "default" | "warning" | "danger" | "success";
    }>;
  }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    type: "income" | "expense";
    amount: { amount: string; currency: "ETB" };
  }>;
  upcomingRenewals: Array<{
    id: string;
    name: string;
    vendorKey: "google" | "github" | "figma" | "other";
    expiresOn: string;
    daysRemaining: number;
    amount: { amount: string; currency: "ETB" };
    billingPeriod: "yearly" | "monthly";
  }>;
};

function pctChange(current: string, previous: string): {
  direction: "up" | "down" | "flat";
  label: string;
  sentiment: "positive" | "negative" | "neutral";
} {
  const cur = money(current);
  const prev = money(previous);
  if (prev.eq(0)) {
    return { direction: "flat", label: "—", sentiment: "neutral" };
  }
  const delta = cur.sub(prev).div(prev).mul(100);
  const abs = delta.abs().toFixed(1);
  if (delta.gt(0)) {
    return {
      direction: "up",
      label: `+${abs}%`,
      sentiment: "positive",
    };
  }
  if (delta.lt(0)) {
    return {
      direction: "down",
      label: `-${abs}%`,
      sentiment: "negative",
    };
  }
  return { direction: "flat", label: "0%", sentiment: "neutral" };
}

function vendorKey(vendor: string | null): "google" | "github" | "figma" | "other" {
  const value = (vendor ?? "").toLowerCase();
  if (value.includes("google")) return "google";
  if (value.includes("github")) return "github";
  if (value.includes("figma")) return "figma";
  return "other";
}

export async function buildDashboardSnapshot(
  db: PrismaClient,
  periodId?: string,
): Promise<DashboardSnapshotPayload> {
  const report = await buildFinancialReport(db, reportInputFromPeriodId(periodId));

  // Prior month for KPI trends (when viewing a month).
  let priorIncome = "0.00";
  let priorExpenses = "0.00";
  let priorNet = "0.00";
  if (report.period.preset === "month" && report.monthlySeries.length >= 2) {
    const prior = report.monthlySeries.at(-2);
    if (prior) {
      priorIncome = prior.incomeEtb;
      priorExpenses = prior.expensesEtb;
      priorNet = prior.netCashFlowEtb;
    }
  }

  const incomeTrend = pctChange(report.totals.incomeEtb, priorIncome);
  const expenseTrend = pctChange(report.totals.expensesEtb, priorExpenses);
  const netTrend = pctChange(report.totals.netCashFlowEtb, priorNet);
  // Expenses rising is negative sentiment.
  if (expenseTrend.direction === "up") expenseTrend.sentiment = "negative";
  if (expenseTrend.direction === "down") expenseTrend.sentiment = "positive";

  const asOf = startOfUtcDay(new Date(report.period.to));
  const [subCounts, maintCounts, projectCounts, overdueCycles, failedEmails, awaitingApproval] =
    await Promise.all([
      db.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      db.maintenanceAgreement.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      db.project.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      db.maintenanceBillingCycle.count({
        where: { status: "OVERDUE" },
      }),
      db.emailJob.count({ where: { status: "FAILED" } }),
      db.emailJob.count({ where: { status: "AWAITING_APPROVAL" } }),
    ]);

  const countBy = (
    rows: Array<{ status: string; _count: { _all: number } }>,
    status: string,
  ) => rows.find((row) => row.status === status)?._count._all ?? 0;

  const attentionItems: DashboardSnapshotPayload["attentionItems"] = [];
  const expiringSoon = report.renewalForecasts.filter((row) => row.daysRemaining <= 7);
  if (expiringSoon.length) {
    attentionItems.push({
      id: "subs-expiring",
      category: "Subscriptions",
      title: `${expiringSoon.length} subscription${expiringSoon.length === 1 ? "" : "s"} expiring soon`,
      detail: "Due within 7 days",
      severity: "action",
    });
  }
  if (overdueCycles > 0) {
    attentionItems.push({
      id: "cycles-overdue",
      category: "Maintenance",
      title: `${overdueCycles} overdue billing cycle${overdueCycles === 1 ? "" : "s"}`,
      detail: "Outstanding maintenance balances past due",
      severity: "action",
    });
  }
  if (awaitingApproval > 0) {
    attentionItems.push({
      id: "email-approval",
      category: "Email",
      title: `${awaitingApproval} overdue email draft${awaitingApproval === 1 ? "" : "s"} awaiting approval`,
      detail: "Never sent automatically",
      severity: "pending",
    });
  }
  if (failedEmails > 0) {
    attentionItems.push({
      id: "email-failed",
      category: "Email",
      title: `${failedEmails} email delivery failure${failedEmails === 1 ? "" : "s"}`,
      detail: "Visible under Notifications → Delivery failures",
      severity: "retrying",
    });
  }

  const [recentPayments, recentExpenses] = await Promise.all([
    db.clientPayment.findMany({
      orderBy: { paidAt: "desc" },
      take: 8,
      include: { client: true },
    }),
    db.expense.findMany({
      orderBy: { incurredAt: "desc" },
      take: 8,
      include: { category: true },
    }),
  ]);

  const recentTransactions = [
    ...recentPayments.map((payment) => ({
      id: payment.id,
      date: startOfUtcDay(payment.paidAt).toISOString().slice(0, 10),
      description: `Payment — ${payment.client.name}`,
      type: "income" as const,
      amount: { amount: money(payment.amountEtb).toFixed(2), currency: "ETB" as const },
      sortAt: payment.paidAt.getTime(),
    })),
    ...recentExpenses.map((expense) => ({
      id: expense.id,
      date: startOfUtcDay(expense.incurredAt).toISOString().slice(0, 10),
      description: expense.description || expense.category.name,
      type: "expense" as const,
      amount: { amount: money(expense.amountEtb).toFixed(2), currency: "ETB" as const },
      sortAt: expense.incurredAt.getTime(),
    })),
  ]
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 10)
    .map(({ sortAt: _sortAt, ...row }) => row);

  // DEF-FS-04: UI copy is "Next 30 Days" — only include renewals within 30 days.
  const upcomingRenewals = report.renewalForecasts
    .filter((row) => row.daysRemaining >= 0 && row.daysRemaining <= 30)
    .slice(0, 8)
    .map((row) => ({
      id: row.subscriptionId,
      name: row.name,
      vendorKey: vendorKey(row.vendor),
      expiresOn: row.expirationDate,
      daysRemaining: row.daysRemaining,
      amount: { amount: row.amountEtb, currency: "ETB" as const },
      billingPeriod:
        row.billingPeriod === "MONTHLY"
          ? ("monthly" as const)
          : ("yearly" as const),
    }));

  if (!upcomingRenewals.length) {
    const soon = await db.subscription.findMany({
      where: {
        status: { not: "CANCELLED" },
        expirationDate: {
          gte: asOf,
          lte: addCalendarDays(asOf, 30),
        },
      },
      orderBy: { expirationDate: "asc" },
      take: 8,
    });
    for (const sub of soon) {
      const daysRemaining = Math.round(
        (startOfUtcDay(sub.expirationDate).getTime() - asOf.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      if (daysRemaining < 0 || daysRemaining > 30) continue;
      upcomingRenewals.push({
        id: sub.id,
        name: sub.name,
        vendorKey: vendorKey(sub.vendor),
        expiresOn: startOfUtcDay(sub.expirationDate).toISOString().slice(0, 10),
        daysRemaining,
        amount: {
          amount: money(sub.amount).toFixed(2),
          currency: "ETB",
        },
        billingPeriod:
          sub.billingPeriod === "MONTHLY" ? "monthly" : "yearly",
      });
    }
  }

  return {
    source: "api",
    reportingCurrency: "ETB",
    period: { id: report.period.id, label: report.period.label },
    availablePeriods: report.availablePeriods.map((period) => ({
      id: period.id,
      label: period.label,
    })),
    kpis: [
      {
        id: "total_income",
        label: "Total Income",
        value: { amount: report.totals.incomeEtb, currency: "ETB" },
        trend: {
          ...incomeTrend,
          comparisonLabel: "vs. prior month",
        },
      },
      {
        id: "total_expenses",
        label: "Total Expenses",
        value: { amount: report.totals.expensesEtb, currency: "ETB" },
        trend: {
          ...expenseTrend,
          comparisonLabel: "vs. prior month",
        },
      },
      {
        id: "net_cash_flow",
        label: "Net Cash Flow",
        value: { amount: report.totals.netCashFlowEtb, currency: "ETB" },
        trend: {
          ...netTrend,
          comparisonLabel: "vs. prior month",
        },
      },
      {
        id: "recurring_maintenance",
        label: "Recurring Maintenance Income",
        value: {
          amount: report.totals.recurringMaintenanceMonthlyEtb,
          currency: "ETB",
        },
        suffix: "/ mo",
        footnote: "Active maintenance agreements (ETB monthly equivalent)",
      },
    ],
    monthlyOverview: report.monthlySeries.map((point) => ({
      month: point.label.split(" ")[0] ?? point.month,
      income: point.incomeEtb,
      expenses: point.expensesEtb,
      netCashFlow: point.netCashFlowEtb,
    })),
    attentionItems,
    summaries: [
      {
        id: "subscriptions",
        title: "Subscriptions",
        rows: [
          {
            label: "Active",
            count: countBy(subCounts, "ACTIVE"),
            tone: "success",
          },
          {
            label: "Expiring soon",
            count: countBy(subCounts, "EXPIRING_SOON"),
            tone: "warning",
          },
          {
            label: "Expired",
            count: countBy(subCounts, "EXPIRED"),
            tone: "danger",
          },
        ],
      },
      {
        id: "maintenance",
        title: "Maintenance",
        rows: [
          {
            label: "Active agreements",
            count: countBy(maintCounts, "ACTIVE"),
            tone: "success",
          },
          {
            label: "Paused",
            count: countBy(maintCounts, "PAUSED"),
            tone: "warning",
          },
          {
            label: "Overdue cycles",
            count: overdueCycles,
            tone: overdueCycles ? "danger" : "default",
          },
        ],
      },
      {
        id: "projects",
        title: "Projects",
        rows: [
          {
            label: "In progress",
            count: countBy(projectCounts, "IN_PROGRESS"),
            tone: "default",
          },
          {
            label: "Completed",
            count: countBy(projectCounts, "COMPLETED"),
            tone: "success",
          },
          {
            label: "On hold",
            count: countBy(projectCounts, "ON_HOLD"),
            tone: "warning",
          },
        ],
      },
    ],
    recentTransactions,
    upcomingRenewals,
  };
}
