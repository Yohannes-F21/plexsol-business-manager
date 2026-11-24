import { Prisma, type PrismaClient, type Subscription } from "@prisma/client";
import {
  DEFAULT_SUBSCRIPTION_AFTER_EXPIRATION_DAYS,
  DEFAULT_SUBSCRIPTION_REMINDER_DAYS,
  ENTITY,
} from "./constants.js";
import { startOfUtcDay, addCalendarDays, utcParts } from "../finance/dates.js";
import { money } from "../money.js";

type Db = PrismaClient | Prisma.TransactionClient;

function dateKey(date: Date): string {
  const { year, month, day } = utcParts(startOfUtcDay(date));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function getSettingArray(
  db: Db,
  key: string,
  fallback: readonly number[],
): Promise<number[]> {
  const setting = await db.setting.findUnique({ where: { key } });
  if (!setting) return [...fallback];
  const value = setting.value;
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value as number[];
  }
  return [...fallback];
}

export async function resolveSubscriptionReminderDays(
  db: Db,
  subscription: Pick<Subscription, "reminderDaysBefore">,
): Promise<number[]> {
  // Per-subscription override when set; otherwise global before/on-day defaults.
  const before = subscription.reminderDaysBefore?.length
    ? subscription.reminderDaysBefore
    : await getSettingArray(
        db,
        "subscription_reminder_days",
        DEFAULT_SUBSCRIPTION_REMINDER_DAYS,
      );

  // Negative offsets are after-expiration. If the override already includes any,
  // treat the array as the full schedule; otherwise append configurable after days.
  if (before.some((offset) => offset < 0)) {
    return before;
  }

  const after = await getSettingArray(
    db,
    "subscription_reminder_after_expiration_days",
    DEFAULT_SUBSCRIPTION_AFTER_EXPIRATION_DAYS,
  );
  return [...before, ...after];
}

/**
 * Upsert subscription reminder events idempotently for one subscription.
 * Offsets: positive = before expiration, 0 = on day, negative = after.
 */
export async function scheduleSubscriptionRemindersFor(
  db: Db,
  subscriptionId: string,
): Promise<number> {
  const subscription = await db.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription) return 0;
  if (subscription.status === "CANCELLED") return 0;

  const offsets = await resolveSubscriptionReminderDays(db, subscription);
  const expiration = startOfUtcDay(subscription.expirationDate);
  const expirationKey = dateKey(expiration);

  const rows = offsets.map((offset) => ({
    type: "SUBSCRIPTION_REMINDER" as const,
    entityType: ENTITY.subscription,
    entityId: subscription.id,
    scheduledFor: addCalendarDays(expiration, -offset),
    status: "PENDING" as const,
    requiresApproval: false,
    idempotencyKey: `sub-reminder:${subscription.id}:${expirationKey}:${offset}`,
    payload: {
      offsetDays: offset,
      expirationDate: expirationKey,
      subscriptionName: subscription.name,
    },
  }));

  const result = await db.scheduledEvent.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

/** Schedule reminders for all non-cancelled subscriptions (worker sweep). */
export async function scheduleDueSubscriptionReminders(db: Db): Promise<number> {
  const subscriptions = await db.subscription.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { id: true },
  });
  let total = 0;
  for (const subscription of subscriptions) {
    total += await scheduleSubscriptionRemindersFor(db, subscription.id);
  }
  return total;
}

/**
 * One automatic professional email the day before due date,
 * only when outstanding balance exists.
 */
export async function scheduleMaintenanceDueReminders(
  db: Db,
  input?: { asOf?: Date },
): Promise<number> {
  const asOf = startOfUtcDay(input?.asOf ?? new Date());
  const tomorrow = addCalendarDays(asOf, 1);

  const cycles = await db.maintenanceBillingCycle.findMany({
    where: {
      dueDate: tomorrow,
      status: { notIn: ["PAID", "CANCELLED"] },
    },
    include: {
      agreement: { include: { project: { include: { client: true } } } },
    },
  });

  let created = 0;
  for (const cycle of cycles) {
    const outstanding = money(cycle.amount).sub(money(cycle.amountAllocated));
    if (outstanding.lte(0)) continue;

    const dueKey = dateKey(cycle.dueDate);
    const idempotencyKey = `maint-due:${cycle.id}:${dueKey}`;
    try {
      await db.scheduledEvent.create({
        data: {
          type: "MAINTENANCE_DUE_REMINDER",
          entityType: ENTITY.billingCycle,
          entityId: cycle.id,
          scheduledFor: asOf,
          status: "PENDING",
          requiresApproval: false,
          idempotencyKey,
          payload: {
            dueDate: dueKey,
            projectName: cycle.agreement.project.name,
            clientId: cycle.agreement.project.clientId,
            toEmail: cycle.agreement.project.client.email,
            amount: cycle.amount.toString(),
            currencyCode: cycle.currencyCode,
            outstanding: outstanding.toString(),
          },
        },
      });
      created += 1;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  return created;
}

/**
 * Overdue drafts require administrator approval — never auto-send.
 */
export async function scheduleOverduePaymentDrafts(
  db: Db,
  input?: { asOf?: Date },
): Promise<number> {
  const asOf = startOfUtcDay(input?.asOf ?? new Date());

  const cycles = await db.maintenanceBillingCycle.findMany({
    where: {
      dueDate: { lt: asOf },
      status: { notIn: ["PAID", "CANCELLED"] },
    },
    include: {
      agreement: { include: { project: { include: { client: true } } } },
    },
  });

  let created = 0;
  for (const cycle of cycles) {
    const outstanding = money(cycle.amount).sub(money(cycle.amountAllocated));
    if (outstanding.lte(0)) continue;

    // Keep status in sync for unpaid past-due cycles.
    if (cycle.status === "PENDING" || cycle.status === "PARTIALLY_PAID") {
      await db.maintenanceBillingCycle.update({
        where: { id: cycle.id },
        data: { status: "OVERDUE" },
      });
    }

    const dueKey = dateKey(cycle.dueDate);
    const idempotencyKey = `overdue:${cycle.id}:${dueKey}`;
    try {
      // PENDING + requiresApproval: worker creates a draft email (AWAITING_APPROVAL).
      // Claim never auto-sends these; administrator approval is required.
      await db.scheduledEvent.create({
        data: {
          type: "OVERDUE_PAYMENT_EMAIL",
          entityType: ENTITY.billingCycle,
          entityId: cycle.id,
          scheduledFor: asOf,
          status: "PENDING",
          requiresApproval: true,
          idempotencyKey,
          payload: {
            dueDate: dueKey,
            projectName: cycle.agreement.project.name,
            clientId: cycle.agreement.project.clientId,
            toEmail: cycle.agreement.project.client.email,
            amount: cycle.amount.toString(),
            currencyCode: cycle.currencyCode,
            outstanding: outstanding.toString(),
          },
        },
      });
      created += 1;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  return created;
}
