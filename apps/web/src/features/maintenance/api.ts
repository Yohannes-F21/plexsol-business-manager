import type { MaintenanceAgreementCreateInput } from "@plexsol/shared";
import { apiFetch } from "@/lib/api";
import { createCrudApi, type ItemResponse, type ListResponse } from "@/lib/crud-api";

export type MaintenanceAgreement = {
  id: string;
  projectId: string;
  billingFrequency: "MONTHLY" | "YEARLY";
  amount: string;
  currencyCode: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  notes: string | null;
  project?: {
    id: string;
    name: string;
    client?: { id: string; name: string };
  };
  billingCycles?: BillingCycle[];
  _count?: { billingCycles: number };
};

export type BillingCycle = {
  id: string;
  maintenanceAgreementId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: string;
  currencyCode: string;
  amountAllocated: string;
  status: string;
  agreement?: MaintenanceAgreement;
};

export const maintenanceAgreementsApi = {
  ...createCrudApi<MaintenanceAgreement, MaintenanceAgreementCreateInput>(
    "/api/maintenance/agreements",
  ),
  generateCycles(id: string, asOf?: string) {
    return apiFetch<
      ItemResponse<{
        created: BillingCycle[];
        createdCount: number;
        skipped: number;
      }>
    >(`/api/maintenance/agreements/${id}/generate-cycles`, {
      method: "POST",
      body: JSON.stringify(asOf ? { asOf } : {}),
    });
  },
};

export function listBillingCycles(params?: {
  clientId?: string;
  maintenanceAgreementId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params?.clientId) search.set("clientId", params.clientId);
  if (params?.maintenanceAgreementId) {
    search.set("maintenanceAgreementId", params.maintenanceAgreementId);
  }
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return apiFetch<ListResponse<BillingCycle>>(
    `/api/maintenance/cycles${qs ? `?${qs}` : ""}`,
  );
}
