import type { ClientPaymentCreateInput } from "@plexsol/shared";
import { apiFetch } from "@/lib/api";
import { createCrudApi, type ItemResponse } from "@/lib/crud-api";

export type ClientPayment = {
  id: string;
  clientId: string;
  amount: string;
  currencyCode: string;
  amountEtb: string;
  amountAllocated: string;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  paymentMethodId: string | null;
  client?: { id: string; name: string };
  paymentMethod?: { id: string; name: string } | null;
  allocations?: PaymentAllocation[];
  _count?: { allocations: number };
};

export type PaymentAllocation = {
  id: string;
  clientPaymentId: string;
  amount: string;
  projectId: string | null;
  billingCycleId: string | null;
  notes: string | null;
  project?: { id: string; name: string } | null;
  billingCycle?: {
    id: string;
    periodStart: string;
    periodEnd: string;
  } | null;
};

export type ClientBalances = {
  clientId: string;
  projects: Array<{
    projectId: string;
    name: string;
    currencyCode: string;
    agreedPrice: string;
    amountAllocated: string;
    outstanding: string;
  }>;
  billingCycles: Array<{
    cycleId: string;
    maintenanceAgreementId: string;
    projectId: string;
    projectName: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    status: string;
    currencyCode: string;
    amount: string;
    amountAllocated: string;
    outstanding: string;
  }>;
  payments: Array<{
    paymentId: string;
    currencyCode: string;
    amount: string;
    amountEtb: string;
    amountAllocated: string;
    unapplied: string;
    paidAt: string;
  }>;
};

export const paymentsApi = createCrudApi<ClientPayment, ClientPaymentCreateInput>(
  "/api/payments",
);

export function allocatePayment(
  paymentId: string,
  body: {
    amount: string;
    projectId?: string;
    billingCycleId?: string;
    notes?: string | null;
  },
) {
  return apiFetch<ItemResponse<PaymentAllocation>>(
    `/api/payments/${paymentId}/allocations`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function allocatePaymentBatch(
  paymentId: string,
  allocations: Array<{
    amount: string;
    projectId?: string;
    billingCycleId?: string;
    notes?: string | null;
  }>,
) {
  return apiFetch<ItemResponse<PaymentAllocation[]>>(
    `/api/payments/${paymentId}/allocations/batch`,
    { method: "POST", body: JSON.stringify({ allocations }) },
  );
}

export function getClientBalances(clientId: string) {
  return apiFetch<ItemResponse<ClientBalances>>(`/api/balances/clients/${clientId}`);
}
