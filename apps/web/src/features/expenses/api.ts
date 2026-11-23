import type { ExpenseCreateInput } from "@plexsol/shared";
import { createCrudApi } from "@/lib/crud-api";

export type ExpenseCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  _count?: { expenses: number };
};

export type Expense = {
  id: string;
  categoryId: string;
  amount: string;
  currencyCode: string;
  amountEtb: string;
  description: string;
  incurredAt: string;
  paymentMethodId: string | null;
  isSubscriptionRenewal: boolean;
  category?: ExpenseCategory;
  paymentMethod?: { id: string; name: string } | null;
};

export const expensesApi = createCrudApi<Expense, ExpenseCreateInput>(
  "/api/expenses",
);

export const expenseCategoriesApi = createCrudApi<
  ExpenseCategory,
  { name: string; slug: string; description?: string | null }
>("/api/expense-categories");
