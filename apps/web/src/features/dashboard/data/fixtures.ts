import type { DashboardPeriod, DashboardSnapshot } from "../types";

const AVAILABLE_PERIODS: DashboardPeriod[] = [
  { id: "2025-01", label: "Jan 2025" },
  { id: "2024-12", label: "Dec 2024" },
  { id: "2024-11", label: "Nov 2024" },
];

type FixtureBundle = Omit<
  DashboardSnapshot,
  "source" | "reportingCurrency" | "period" | "availablePeriods"
>;

/**
 * Labeled development fixtures for UI layout verification.
 * NOT live production metrics — payloads vary by period so the selector is honest.
 */
const FIXTURES_BY_PERIOD: Record<string, FixtureBundle> = {
  "2025-01": {
    kpis: [
      {
        id: "total_income",
        label: "Total Income",
        value: { amount: "4250.00", currency: "ETB" },
        trend: {
          direction: "up",
          label: "+12.5%",
          comparisonLabel: "vs. Dec 2024",
          sentiment: "positive",
        },
      },
      {
        id: "total_expenses",
        label: "Total Expenses",
        value: { amount: "1320.00", currency: "ETB" },
        trend: {
          direction: "up",
          label: "+8.1%",
          comparisonLabel: "vs. Dec 2024",
          sentiment: "negative",
        },
      },
      {
        id: "net_cash_flow",
        label: "Net Cash Flow",
        value: { amount: "2930.00", currency: "ETB" },
        trend: {
          direction: "up",
          label: "+14.6%",
          comparisonLabel: "vs. Dec 2024",
          sentiment: "positive",
        },
      },
      {
        id: "recurring_maintenance",
        label: "Recurring Maintenance Income",
        value: { amount: "1650.00", currency: "ETB" },
        suffix: "/ mo",
        footnote: "From maintenance agreements",
      },
    ],
    monthlyOverview: [
      { month: "Aug", income: "3200.00", expenses: "1100.00", netCashFlow: "2100.00" },
      { month: "Sep", income: "2800.00", expenses: "1500.00", netCashFlow: "1300.00" },
      { month: "Oct", income: "4100.00", expenses: "1200.00", netCashFlow: "2900.00" },
      { month: "Nov", income: "3600.00", expenses: "1800.00", netCashFlow: "1800.00" },
      { month: "Dec", income: "3900.00", expenses: "1400.00", netCashFlow: "2500.00" },
      { month: "Jan", income: "4250.00", expenses: "1320.00", netCashFlow: "2930.00" },
    ],
    attentionItems: [
      {
        id: "att-1",
        category: "Subscriptions",
        title: "3 subscriptions expiring soon",
        detail: "Due within 7 days",
        severity: "action",
      },
      {
        id: "att-2",
        category: "Maintenance",
        title: "2 maintenance payments due tomorrow",
        detail: "Total: ETB 400.00",
        severity: "action",
      },
      {
        id: "att-3",
        category: "Approvals",
        title: "2 overdue payment emails",
        detail: "Awaiting administrator approval",
        severity: "pending",
      },
      {
        id: "att-4",
        category: "Delivery",
        title: "1 failed email (retrying)",
        detail: "Temporary failure — attempt 2 of 3",
        severity: "retrying",
      },
    ],
    summaries: [
      {
        id: "subscriptions",
        title: "Subscriptions",
        rows: [
          { label: "Active", count: 12, tone: "default" },
          { label: "Expiring Soon", count: 3, tone: "warning" },
          { label: "Expired", count: 1, tone: "danger" },
        ],
      },
      {
        id: "maintenance",
        title: "Maintenance",
        rows: [
          { label: "Active Agreements", count: 8, tone: "default" },
          { label: "Payment Due", count: 2, tone: "warning" },
          { label: "Overdue", count: 1, tone: "danger" },
        ],
      },
      {
        id: "projects",
        title: "Projects",
        rows: [
          { label: "In Progress", count: 4, tone: "default" },
          { label: "Completed (This Month)", count: 2, tone: "success" },
          { label: "On Hold", count: 1, tone: "danger" },
        ],
      },
    ],
    recentTransactions: [
      {
        id: "tx-1",
        date: "Jan 15",
        description: "Payment — PT Alpha",
        type: "income",
        amount: { amount: "800.00", currency: "ETB" },
      },
      {
        id: "tx-2",
        date: "Jan 14",
        description: "Adobe Creative Cloud",
        type: "expense",
        amount: { amount: "54.99", currency: "ETB" },
      },
      {
        id: "tx-3",
        date: "Jan 12",
        description: "Maintenance — PT Beta",
        type: "income",
        amount: { amount: "400.00", currency: "ETB" },
      },
      {
        id: "tx-4",
        date: "Jan 10",
        description: "Domain Renewal",
        type: "expense",
        amount: { amount: "12.00", currency: "ETB" },
      },
    ],
    upcomingRenewals: [
      {
        id: "ren-1",
        name: "Google Workspace",
        vendorKey: "google",
        expiresOn: "Jan 21, 2025",
        daysRemaining: 6,
        amount: { amount: "144.00", currency: "ETB" },
        billingPeriod: "yearly",
      },
      {
        id: "ren-2",
        name: "GitHub Pro",
        vendorKey: "github",
        expiresOn: "Jan 28, 2025",
        daysRemaining: 13,
        amount: { amount: "48.00", currency: "ETB" },
        billingPeriod: "yearly",
      },
      {
        id: "ren-3",
        name: "Figma Professional",
        vendorKey: "figma",
        expiresOn: "Feb 02, 2025",
        daysRemaining: 18,
        amount: { amount: "180.00", currency: "ETB" },
        billingPeriod: "yearly",
      },
    ],
  },
  "2024-12": {
    kpis: [
      {
        id: "total_income",
        label: "Total Income",
        value: { amount: "3900.00", currency: "ETB" },
        trend: {
          direction: "up",
          label: "+8.3%",
          comparisonLabel: "vs. Nov 2024",
          sentiment: "positive",
        },
      },
      {
        id: "total_expenses",
        label: "Total Expenses",
        value: { amount: "1400.00", currency: "ETB" },
        trend: {
          direction: "down",
          label: "−22.2%",
          comparisonLabel: "vs. Nov 2024",
          sentiment: "positive",
        },
      },
      {
        id: "net_cash_flow",
        label: "Net Cash Flow",
        value: { amount: "2500.00", currency: "ETB" },
        trend: {
          direction: "up",
          label: "+38.9%",
          comparisonLabel: "vs. Nov 2024",
          sentiment: "positive",
        },
      },
      {
        id: "recurring_maintenance",
        label: "Recurring Maintenance Income",
        value: { amount: "1650.00", currency: "ETB" },
        suffix: "/ mo",
        footnote: "From maintenance agreements",
      },
    ],
    monthlyOverview: [
      { month: "Jul", income: "3000.00", expenses: "1000.00", netCashFlow: "2000.00" },
      { month: "Aug", income: "3200.00", expenses: "1100.00", netCashFlow: "2100.00" },
      { month: "Sep", income: "2800.00", expenses: "1500.00", netCashFlow: "1300.00" },
      { month: "Oct", income: "4100.00", expenses: "1200.00", netCashFlow: "2900.00" },
      { month: "Nov", income: "3600.00", expenses: "1800.00", netCashFlow: "1800.00" },
      { month: "Dec", income: "3900.00", expenses: "1400.00", netCashFlow: "2500.00" },
    ],
    attentionItems: [
      {
        id: "att-d1",
        category: "Subscriptions",
        title: "1 subscription expiring soon",
        detail: "Due within 14 days",
        severity: "action",
      },
      {
        id: "att-d2",
        category: "Maintenance",
        title: "1 maintenance payment due",
        detail: "Total: ETB 200.00",
        severity: "pending",
      },
    ],
    summaries: [
      {
        id: "subscriptions",
        title: "Subscriptions",
        rows: [
          { label: "Active", count: 13, tone: "default" },
          { label: "Expiring Soon", count: 1, tone: "warning" },
          { label: "Expired", count: 0, tone: "danger" },
        ],
      },
      {
        id: "maintenance",
        title: "Maintenance",
        rows: [
          { label: "Active Agreements", count: 8, tone: "default" },
          { label: "Payment Due", count: 1, tone: "warning" },
          { label: "Overdue", count: 0, tone: "danger" },
        ],
      },
      {
        id: "projects",
        title: "Projects",
        rows: [
          { label: "In Progress", count: 5, tone: "default" },
          { label: "Completed (This Month)", count: 1, tone: "success" },
          { label: "On Hold", count: 1, tone: "danger" },
        ],
      },
    ],
    recentTransactions: [
      {
        id: "tx-d1",
        date: "Dec 28",
        description: "Payment — PT Gamma",
        type: "income",
        amount: { amount: "600.00", currency: "ETB" },
      },
      {
        id: "tx-d2",
        date: "Dec 20",
        description: "Cloud hosting",
        type: "expense",
        amount: { amount: "220.00", currency: "ETB" },
      },
      {
        id: "tx-d3",
        date: "Dec 12",
        description: "Maintenance — PT Alpha",
        type: "income",
        amount: { amount: "450.00", currency: "ETB" },
      },
    ],
    upcomingRenewals: [
      {
        id: "ren-d1",
        name: "Google Workspace",
        vendorKey: "google",
        expiresOn: "Jan 21, 2025",
        daysRemaining: 24,
        amount: { amount: "144.00", currency: "ETB" },
        billingPeriod: "yearly",
      },
      {
        id: "ren-d2",
        name: "GitHub Pro",
        vendorKey: "github",
        expiresOn: "Jan 28, 2025",
        daysRemaining: 31,
        amount: { amount: "48.00", currency: "ETB" },
        billingPeriod: "yearly",
      },
    ],
  },
  "2024-11": {
    kpis: [
      {
        id: "total_income",
        label: "Total Income",
        value: { amount: "3600.00", currency: "ETB" },
        trend: {
          direction: "down",
          label: "−12.2%",
          comparisonLabel: "vs. Oct 2024",
          sentiment: "negative",
        },
      },
      {
        id: "total_expenses",
        label: "Total Expenses",
        value: { amount: "1800.00", currency: "ETB" },
        trend: {
          direction: "up",
          label: "+50.0%",
          comparisonLabel: "vs. Oct 2024",
          sentiment: "negative",
        },
      },
      {
        id: "net_cash_flow",
        label: "Net Cash Flow",
        value: { amount: "1800.00", currency: "ETB" },
        trend: {
          direction: "down",
          label: "−37.9%",
          comparisonLabel: "vs. Oct 2024",
          sentiment: "negative",
        },
      },
      {
        id: "recurring_maintenance",
        label: "Recurring Maintenance Income",
        value: { amount: "1500.00", currency: "ETB" },
        suffix: "/ mo",
        footnote: "From maintenance agreements",
      },
    ],
    monthlyOverview: [
      { month: "Jun", income: "2900.00", expenses: "900.00", netCashFlow: "2000.00" },
      { month: "Jul", income: "3000.00", expenses: "1000.00", netCashFlow: "2000.00" },
      { month: "Aug", income: "3200.00", expenses: "1100.00", netCashFlow: "2100.00" },
      { month: "Sep", income: "2800.00", expenses: "1500.00", netCashFlow: "1300.00" },
      { month: "Oct", income: "4100.00", expenses: "1200.00", netCashFlow: "2900.00" },
      { month: "Nov", income: "3600.00", expenses: "1800.00", netCashFlow: "1800.00" },
    ],
    attentionItems: [
      {
        id: "att-n1",
        category: "Delivery",
        title: "1 failed email (retrying)",
        detail: "Temporary failure — attempt 1 of 3",
        severity: "retrying",
      },
    ],
    summaries: [
      {
        id: "subscriptions",
        title: "Subscriptions",
        rows: [
          { label: "Active", count: 12, tone: "default" },
          { label: "Expiring Soon", count: 2, tone: "warning" },
          { label: "Expired", count: 1, tone: "danger" },
        ],
      },
      {
        id: "maintenance",
        title: "Maintenance",
        rows: [
          { label: "Active Agreements", count: 7, tone: "default" },
          { label: "Payment Due", count: 0, tone: "warning" },
          { label: "Overdue", count: 1, tone: "danger" },
        ],
      },
      {
        id: "projects",
        title: "Projects",
        rows: [
          { label: "In Progress", count: 6, tone: "default" },
          { label: "Completed (This Month)", count: 0, tone: "success" },
          { label: "On Hold", count: 2, tone: "danger" },
        ],
      },
    ],
    recentTransactions: [
      {
        id: "tx-n1",
        date: "Nov 22",
        description: "Software licenses",
        type: "expense",
        amount: { amount: "310.00", currency: "ETB" },
      },
      {
        id: "tx-n2",
        date: "Nov 18",
        description: "Payment — PT Beta",
        type: "income",
        amount: { amount: "500.00", currency: "ETB" },
      },
    ],
    upcomingRenewals: [
      {
        id: "ren-n1",
        name: "Figma Professional",
        vendorKey: "figma",
        expiresOn: "Dec 05, 2024",
        daysRemaining: 8,
        amount: { amount: "180.00", currency: "ETB" },
        billingPeriod: "yearly",
      },
    ],
  },
};

export function getDashboardFixture(periodId = "2025-01"): DashboardSnapshot {
  const period =
    AVAILABLE_PERIODS.find((item) => item.id === periodId) ??
    AVAILABLE_PERIODS[0]!;
  const bundle = FIXTURES_BY_PERIOD[period.id] ?? FIXTURES_BY_PERIOD["2025-01"]!;

  return {
    source: "fixture",
    reportingCurrency: "ETB",
    period,
    availablePeriods: AVAILABLE_PERIODS,
    ...bundle,
  };
}
