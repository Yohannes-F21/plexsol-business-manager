import { createCrudApi } from "@/lib/crud-api";

export type PaymentMethod = {
  id: string;
  name: string;
  type: "BANK_TRANSFER" | "CASH" | "CARD" | "MOBILE_MONEY" | "OTHER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const paymentMethodsApi = createCrudApi<
  PaymentMethod,
  { name: string; type: PaymentMethod["type"]; isActive?: boolean }
>("/api/payment-methods");
