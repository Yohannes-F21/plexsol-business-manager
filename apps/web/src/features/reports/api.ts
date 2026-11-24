import { apiFetch } from "@/lib/api";

export type ReportPreset = "month" | "year" | "custom";

export type FinancialReport = {
  reportingCurrency: "ETB";
  period: {
    id: string;
    label: string;
    preset: ReportPreset;
    from: string;
    to: string;
  };
  availablePeriods: Array<{
    id: string;
    label: string;
    preset: ReportPreset;
    month?: string;
    year?: string;
  }>;
  totals: {
    incomeEtb: string;
    expensesEtb: string;
    netCashFlowEtb: string;
    recurringMaintenanceMonthlyEtb: string;
    outstandingClientsEtb: string;
  };
  monthlySeries: Array<{
    month: string;
    label: string;
    incomeEtb: string;
    expensesEtb: string;
    netCashFlowEtb: string;
  }>;
  outstandingBalances: Array<{
    clientId: string;
    clientName: string;
    projectOutstandingEtb: string;
    billingOutstandingEtb: string;
    totalOutstandingEtb: string;
  }>;
  renewalForecasts: Array<{
    subscriptionId: string;
    name: string;
    vendor: string | null;
    expirationDate: string;
    daysRemaining: number;
    amountEtb: string;
    currencyCode: string;
    billingPeriod: string;
  }>;
  projectSummaries: Array<{
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
  }>;
  maintenanceRecurring: Array<{
    agreementId: string;
    projectName: string;
    clientName: string;
    billingFrequency: string;
    currencyCode: string;
    amount: string;
    monthlyEtb: string;
  }>;
};

export type ReportQuery = {
  preset?: ReportPreset;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  period?: string;
};

export function fetchReport(query: ReportQuery) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return apiFetch<{ data: FinancialReport }>(
    `/api/reports${qs ? `?${qs}` : ""}`,
  );
}
