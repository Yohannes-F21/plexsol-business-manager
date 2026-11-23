import type {
  SubscriptionCreateInput,
  SubscriptionRenewalCreateInput,
} from "@plexsol/shared";
import { apiFetch } from "@/lib/api";
import { createCrudApi, type ItemResponse } from "@/lib/crud-api";

export type SubscriptionCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: { subscriptions: number };
};

export type Subscription = {
  id: string;
  name: string;
  vendor: string | null;
  categoryId: string | null;
  amount: string;
  currencyCode: string;
  billingPeriod: "MONTHLY" | "YEARLY" | "CUSTOM";
  startDate: string;
  expirationDate: string;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED";
  reminderDaysBefore: number[];
  url: string | null;
  notes: string | null;
  category?: SubscriptionCategory | null;
  renewals?: SubscriptionRenewal[];
};

export type SubscriptionRenewal = {
  id: string;
  subscriptionId: string;
  renewedAt: string;
  previousExpirationDate: string;
  newExpirationDate: string;
  amount: string;
  currencyCode: string;
  expenseId: string;
  notes: string | null;
  expense?: {
    id: string;
    amount: string;
    amountEtb: string;
    description: string;
  };
};

export const subscriptionsApi = createCrudApi<
  Subscription,
  SubscriptionCreateInput
>("/api/subscriptions");

export const subscriptionCategoriesApi = createCrudApi<
  SubscriptionCategory,
  { name: string; slug: string; description?: string | null }
>("/api/subscription-categories");

export function confirmRenewal(
  subscriptionId: string,
  body: Omit<SubscriptionRenewalCreateInput, "subscriptionId">,
) {
  return apiFetch<ItemResponse<SubscriptionRenewal>>(
    `/api/subscriptions/${subscriptionId}/renewals`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export type ExchangeRate = {
  id: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: string;
  effectiveAt: string;
  source: string | null;
};

export function listExchangeRates(params?: {
  fromCurrencyCode?: string;
  toCurrencyCode?: string;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params?.fromCurrencyCode) {
    search.set("fromCurrencyCode", params.fromCurrencyCode);
  }
  if (params?.toCurrencyCode) {
    search.set("toCurrencyCode", params.toCurrencyCode);
  }
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return apiFetch<{ data: ExchangeRate[] }>(
    `/api/exchange-rates${qs ? `?${qs}` : ""}`,
  );
}
