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
  /** Days before (positive), on day (0), or after expiration (negative). */
  reminderDaysBefore: z.array(z.number().int().min(-365).max(365)).optional(),
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
    if (currency === "ETB") {
      if (value.amountEtb && value.amountEtb !== value.amount) {
        ctx.addIssue({
          code: "custom",
          path: ["amountEtb"],
          message: "For ETB renewals, amountEtb must equal amount",
        });
      }
      return;
    }
    if (!value.amountEtb && !value.exchangeRateId) {
      ctx.addIssue({
        code: "custom",
        path: ["amountEtb"],
        message:
          "amountEtb or exchangeRateId is required for non-ETB renewals",
      });
    }
  });

// --- Exchange rates (historical snapshots; never overwrite — insert new effectiveAt) ---
export const exchangeRateListQuerySchema = paginationSchema.extend({
  fromCurrencyCode: currencyCodeSchema.optional(),
  toCurrencyCode: currencyCodeSchema.optional().default("ETB"),
});

export const exchangeRateCreateSchema = z
  .object({
    fromCurrencyCode: currencyCodeSchema,
    toCurrencyCode: currencyCodeSchema.default("ETB"),
    rate: z
      .string()
      .regex(/^\d+(\.\d{1,8})?$/, "Rate must be a positive decimal string")
      .refine((value) => Number(value) > 0, "Rate must be greater than zero"),
    effectiveAt: dateInputSchema,
    source: z.string().trim().max(120).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.fromCurrencyCode === value.toCurrencyCode) {
      ctx.addIssue({
        code: "custom",
        path: ["toCurrencyCode"],
        message: "fromCurrencyCode and toCurrencyCode must differ",
      });
    }
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

// --- Client payments & allocations ---
export const clientPaymentCreateSchema = z
  .object({
    clientId: uuidSchema,
    amount: moneyStringSchema,
    currencyCode: currencyCodeSchema.default("ETB"),
    amountEtb: moneyStringSchema.optional(),
    exchangeRateId: uuidSchema.optional().nullable(),
    paymentMethodId: uuidSchema.optional().nullable(),
    paidAt: dateInputSchema.optional(),
    reference: z.string().trim().max(120).optional().nullable(),
    notes: optionalStringSchema,
  })
  .superRefine((value, ctx) => {
    const currency = (value.currencyCode ?? "ETB").toUpperCase();
    if (currency === "ETB") {
      if (value.amountEtb && value.amountEtb !== value.amount) {
        ctx.addIssue({
          code: "custom",
          path: ["amountEtb"],
          message: "For ETB payments, amountEtb must equal amount",
        });
      }
      return;
    }
    if (!value.amountEtb && !value.exchangeRateId) {
      ctx.addIssue({
        code: "custom",
        path: ["amountEtb"],
        message:
          "amountEtb or exchangeRateId is required for non-ETB payments",
      });
    }
  });

export const clientPaymentListQuerySchema = paginationSchema.extend({
  clientId: uuidSchema.optional(),
});

export const paymentAllocationCreateSchema = z.object({
  amount: moneyStringSchema,
  projectId: uuidSchema.optional(),
  billingCycleId: uuidSchema.optional(),
  notes: optionalStringSchema,
}).superRefine((value, ctx) => {
  const hasProject = Boolean(value.projectId);
  const hasCycle = Boolean(value.billingCycleId);
  if (hasProject === hasCycle) {
    ctx.addIssue({
      code: "custom",
      message: "Allocation must target exactly one project or billing cycle",
    });
  }
});

export const paymentAllocationBatchSchema = z.object({
  allocations: z
    .array(
      z.object({
        amount: moneyStringSchema,
        projectId: uuidSchema.optional(),
        billingCycleId: uuidSchema.optional(),
        notes: optionalStringSchema,
      }),
    )
    .min(1)
    .max(50),
}).superRefine((value, ctx) => {
  value.allocations.forEach((line, index) => {
    const hasProject = Boolean(line.projectId);
    const hasCycle = Boolean(line.billingCycleId);
    if (hasProject === hasCycle) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations", index],
        message: "Each allocation must target exactly one project or billing cycle",
      });
    }
  });
});

// --- Maintenance agreements & cycles ---
export const billingFrequencySchema = z.enum(["MONTHLY", "YEARLY"]);
export const maintenanceAgreementStatusSchema = z.enum([
  "ACTIVE",
  "PAUSED",
  "ENDED",
]);
export const billingCycleStatusSchema = z.enum([
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const maintenanceAgreementCreateSchema = z.object({
  projectId: uuidSchema,
  billingFrequency: billingFrequencySchema,
  amount: moneyStringSchema,
  currencyCode: currencyCodeSchema.default("ETB"),
  /** Explicit activation / billing start — never inferred from project delivery. */
  startDate: dateInputSchema,
  endDate: dateInputSchema.optional().nullable(),
  status: maintenanceAgreementStatusSchema.optional().default("ACTIVE"),
  notes: optionalStringSchema,
  /** When true (default), generate cycles through today after create if ACTIVE. */
  generateCycles: z.boolean().optional().default(true),
});
export const maintenanceAgreementUpdateSchema = z.object({
  billingFrequency: billingFrequencySchema.optional(),
  amount: moneyStringSchema.optional(),
  currencyCode: currencyCodeSchema.optional(),
  startDate: dateInputSchema.optional(),
  endDate: dateInputSchema.optional().nullable(),
  status: maintenanceAgreementStatusSchema.optional(),
  notes: optionalStringSchema,
});
export const maintenanceAgreementListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  status: maintenanceAgreementStatusSchema.optional(),
});

export const generateBillingCyclesSchema = z.object({
  asOf: dateInputSchema.optional(),
});

export const billingCycleListQuerySchema = paginationSchema.extend({
  maintenanceAgreementId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  status: billingCycleStatusSchema.optional(),
});

// --- Notifications & email jobs (Phase 7) ---
export const notificationListQuerySchema = paginationSchema.extend({
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true",
    ),
});

export const emailJobStatusSchema = z.enum([
  "PENDING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENDING",
  "SENT",
  "FAILED",
  "CANCELLED",
]);

export const emailJobListQuerySchema = paginationSchema.extend({
  status: emailJobStatusSchema.optional(),
});

export const emailJobRejectSchema = z.object({
  reason: optionalStringSchema,
});

// --- Reports (Phase 8) ---
export const reportPresetSchema = z.enum(["month", "year", "custom"]);

export const reportQuerySchema = z
  .object({
    preset: reportPresetSchema.optional(),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    year: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    from: dateInputSchema.optional(),
    to: dateInputSchema.optional(),
    /** Dashboard-style period id: YYYY-MM | YYYY | custom:from:to */
    period: z.string().trim().min(1).max(64).optional(),
  })
  .superRefine((value, ctx) => {
    const preset = value.preset ?? (value.from || value.to ? "custom" : undefined);
    if (preset === "custom" && (!value.from || !value.to)) {
      ctx.addIssue({
        code: "custom",
        message: "Custom reports require from and to",
        path: ["from"],
      });
    }
  });

export const dashboardQuerySchema = z.object({
  period: z.string().trim().min(1).max(64).optional(),
});

// --- App settings (ops / reminders / payment instructions) ---
export const settingUpsertSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.number()),
    z.array(z.string()),
    z.record(z.string(), z.unknown()),
  ]),
  description: optionalStringSchema,
});

export type SettingUpsertInput = z.infer<typeof settingUpsertSchema>;

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionRenewalCreateInput = z.infer<
  typeof subscriptionRenewalCreateSchema
>;
export type ExchangeRateCreateInput = z.infer<typeof exchangeRateCreateSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ClientPaymentCreateInput = z.infer<typeof clientPaymentCreateSchema>;
export type MaintenanceAgreementCreateInput = z.infer<
  typeof maintenanceAgreementCreateSchema
>;
