export type DashboardDataSource = "api" | "fixture";

export type MoneyAmount = {
  /** Minor-safe decimal string, e.g. "4250.00" — never JS float math in UI formatters only. */
  amount: string;
  currency: "ETB";
};

export type KpiTrend = {
  direction: "up" | "down" | "flat";
  /** e.g. "+12.5%" */
  label: string;
  /** e.g. "vs. Dec 2024" */
  comparisonLabel: string;
  sentiment: "positive" | "negative" | "neutral";
};

export type DashboardKpi = {
  id: "total_income" | "total_expenses" | "net_cash_flow" | "recurring_maintenance";
  label: string;
  value: MoneyAmount;
  /** Optional suffix like "/ mo" */
  suffix?: string;
  footnote?: string;
  trend?: KpiTrend;
};

export type MonthlyPoint = {
  month: string;
  income: string;
  expenses: string;
  netCashFlow: string;
};

export type AttentionSeverity = "action" | "pending" | "retrying";

export type AttentionItem = {
  id: string;
  category: string;
  title: string;
  detail: string;
  severity: AttentionSeverity;
};

export type StatusSummary = {
  id: "subscriptions" | "maintenance" | "projects";
  title: string;
  rows: Array<{
    label: string;
    count: number;
    tone: "default" | "warning" | "danger" | "success";
  }>;
};

export type TransactionType = "income" | "expense";

export type RecentTransaction = {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: MoneyAmount;
};

export type UpcomingRenewal = {
  id: string;
  name: string;
  vendorKey: "google" | "github" | "figma" | "other";
  expiresOn: string;
  daysRemaining: number;
  amount: MoneyAmount;
  billingPeriod: "yearly" | "monthly";
};

export type DashboardPeriod = {
  id: string;
  label: string;
};

export type DashboardSnapshot = {
  source: DashboardDataSource;
  reportingCurrency: "ETB";
  period: DashboardPeriod;
  availablePeriods: DashboardPeriod[];
  kpis: DashboardKpi[];
  monthlyOverview: MonthlyPoint[];
  attentionItems: AttentionItem[];
  summaries: StatusSummary[];
  recentTransactions: RecentTransaction[];
  upcomingRenewals: UpcomingRenewal[];
};
