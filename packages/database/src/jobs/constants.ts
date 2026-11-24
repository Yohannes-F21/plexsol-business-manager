/** Default subscription reminder offsets (days before expiration; 0 = on expiration). */
export const DEFAULT_SUBSCRIPTION_REMINDER_DAYS = [30, 7, 3, 1, 0] as const;

/** Optional post-expiration reminder offsets (negative days relative to expiration). */
export const DEFAULT_SUBSCRIPTION_AFTER_EXPIRATION_DAYS = [-1, -7] as const;

export const DEFAULT_EMAIL_MAX_ATTEMPTS = 3;
export const DEFAULT_WORKER_LEASE_MS = 60_000;

/** Backoff seconds before retry after temporary email failures (attempt 1→2, 2→3). */
export const EMAIL_RETRY_BACKOFF_SECONDS = [60, 300] as const;

export const TEMPLATE_KEYS = {
  subscriptionReminder: "subscription_reminder",
  maintenanceDue: "maintenance_due_reminder",
  overduePayment: "overdue_payment",
} as const;

export const ENTITY = {
  subscription: "Subscription",
  billingCycle: "MaintenanceBillingCycle",
} as const;
