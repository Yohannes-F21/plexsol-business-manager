import { z } from "zod";
import {
  currencyCodeSchema,
  dateInputSchema,
  moneyStringSchema,
  optionalStringSchema,
  paginationSchema,
  uuidSchema,
} from "./common.js";

export const projectStatusSchema = z.enum([
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
]);

export const subscriptionStatusSchema = z.enum([
  "ACTIVE",
  "EXPIRING_SOON",
  "EXPIRED",
  "CANCELLED",
]);

export const subscriptionBillingPeriodSchema = z.enum([
  "MONTHLY",
  "YEARLY",
  "CUSTOM",
]);

export const paymentMethodTypeSchema = z.enum([
  "BANK_TRANSFER",
  "CASH",
  "CARD",
  "MOBILE_MONEY",
  "OTHER",
]);

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

// --- Clients ---
export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  notes: optionalStringSchema,
  isActive: z.boolean().optional().default(true),
});
export const clientUpdateSchema = clientCreateSchema.partial();
export const clientListQuerySchema = paginationSchema.extend({
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true",
    ),
});

// --- Projects ---
export const projectCreateSchema = z.object({
  clientId: uuidSchema,
  name: z.string().trim().min(1).max(200),
  description: optionalStringSchema,
  status: projectStatusSchema.optional().default("IN_PROGRESS"),
  agreedPrice: moneyStringSchema,
  currencyCode: currencyCodeSchema.default("ETB"),
  startDate: dateInputSchema.optional().nullable(),
  endDate: dateInputSchema.optional().nullable(),
});
export const projectUpdateSchema = projectCreateSchema.partial();
export const projectListQuerySchema = paginationSchema.extend({
  clientId: uuidSchema.optional(),
  status: projectStatusSchema.optional(),
});

// --- Subscription categories ---
export const subscriptionCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: optionalStringSchema,
});
export const subscriptionCategoryUpdateSchema =
  subscriptionCategoryCreateSchema.partial();

// --- Subscriptions ---
export const subscriptionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  vendor: z.string().trim().max(200).optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  amount: moneyStringSchema,
  currencyCode: currencyCodeSchema.default("ETB"),
  billingPeriod: subscriptionBillingPeriodSchema,
  startDate: dateInputSchema,
  expirationDate: dateInputSchema,
  status: subscriptionStatusSchema.optional().default("ACTIVE"),
  reminderDaysBefore: z.array(z.number().int().positive()).optional(),
  url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) return null;
      const parsed = z.string().url().safeParse(value);
      return parsed.success ? parsed.data : value;
    }),
  notes: optionalStringSchema,
});
export const subscriptionUpdateSchema = subscriptionCreateSchema.partial();
export const subscriptionListQuerySchema = paginationSchema.extend({
  status: subscriptionStatusSchema.optional(),
  categoryId: uuidSchema.optional(),
});

export const subscriptionRenewalCreateSchema = z
  .object({
    subscriptionId: uuidSchema,
    renewedAt: dateInputSchema.optional(),
    newExpirationDate: dateInputSchema,
    amount: moneyStringSchema,
    currencyCode: currencyCodeSchema.default("ETB"),
    amountEtb: moneyStringSchema.optional(),
    exchangeRateId: uuidSchema.optional().nullable(),
    paymentMethodId: uuidSchema.optional().nullable(),
    notes: optionalStringSchema,
  })
  .superRefine((value, ctx) => {
    const currency = (value.currencyCode ?? "ETB").toUpperCase();
    if (currency === "ETB") return;
    if (!value.amountEtb && !value.exchangeRateId) {
      ctx.addIssue({
        code: "custom",
        path: ["amountEtb"],
        message:
          "amountEtb or exchangeRateId is required for non-ETB renewals",
      });
    }
  });

// --- Exchange rates (read for renewals / FX UX) ---
export const exchangeRateListQuerySchema = paginationSchema.extend({
  fromCurrencyCode: currencyCodeSchema.optional(),
  toCurrencyCode: currencyCodeSchema.optional().default("ETB"),
});

// --- Expense categories ---
export const expenseCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: optionalStringSchema,
});
export const expenseCategoryUpdateSchema = expenseCategoryCreateSchema.partial();

// --- Expenses ---
export const expenseCreateSchema = z.object({
  categoryId: uuidSchema,
  amount: moneyStringSchema,
  currencyCode: currencyCodeSchema.default("ETB"),
  amountEtb: moneyStringSchema.optional(),
  exchangeRateId: uuidSchema.optional().nullable(),
  description: z.string().trim().min(1).max(500),
  incurredAt: dateInputSchema,
  paymentMethodId: uuidSchema.optional().nullable(),
});
export const expenseUpdateSchema = expenseCreateSchema.partial();
export const expenseListQuerySchema = paginationSchema.extend({
  categoryId: uuidSchema.optional(),
});

// --- Payment methods ---
export const paymentMethodCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: paymentMethodTypeSchema,
  isActive: z.boolean().optional().default(true),
});
export const paymentMethodUpdateSchema = paymentMethodCreateSchema.partial();

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionRenewalCreateInput = z.infer<
  typeof subscriptionRenewalCreateSchema
>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
