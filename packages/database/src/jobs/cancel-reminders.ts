import type { Prisma, PrismaClient } from "@prisma/client";
import { ENTITY } from "./constants.js";
import { markNotificationsReadForEntity } from "./notifications.js";

type Db = PrismaClient | Prisma.TransactionClient;

const OPEN_EVENT_STATUSES = [
  "PENDING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PROCESSING",
] as const;

const OPEN_EMAIL_STATUSES = [
  "PENDING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENDING",
] as const;

export async function cancelSubscriptionReminders(
  db: Db,
  subscriptionId: string,
): Promise<void> {
  const events = await db.scheduledEvent.findMany({
    where: {
      type: "SUBSCRIPTION_REMINDER",
      entityType: ENTITY.subscription,
      entityId: subscriptionId,
      status: { in: [...OPEN_EVENT_STATUSES] },
    },
    select: { id: true },
  });

  await db.scheduledEvent.updateMany({
    where: { id: { in: events.map((event) => event.id) } },
    data: {
      status: "CANCELLED",
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });

  if (events.length) {
    const emailJobs = await db.emailJob.findMany({
      where: {
        scheduledEventId: { in: events.map((event) => event.id) },
        status: { in: [...OPEN_EMAIL_STATUSES] },
      },
      select: { id: true },
    });
    await db.emailJob.updateMany({
      where: { id: { in: emailJobs.map((job) => job.id) } },
      data: {
        status: "CANCELLED",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastError: "Cancelled — subscription renewed or updated",
      },
    });
    for (const job of emailJobs) {
      await markNotificationsReadForEntity(db, {
        entityType: "EmailJob",
        entityId: job.id,
      });
    }
  }
}

/** Cancel maintenance due / overdue reminders when a cycle is settled. */
export async function cancelBillingCycleReminders(
  db: Db,
  cycleId: string,
): Promise<void> {
  const events = await db.scheduledEvent.findMany({
    where: {
      entityType: ENTITY.billingCycle,
      entityId: cycleId,
      type: { in: ["MAINTENANCE_DUE_REMINDER", "OVERDUE_PAYMENT_EMAIL"] },
      status: { in: [...OPEN_EVENT_STATUSES] },
    },
    select: { id: true },
  });

  await db.scheduledEvent.updateMany({
    where: { id: { in: events.map((event) => event.id) } },
    data: {
      status: "CANCELLED",
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });

  if (events.length) {
    const emailJobs = await db.emailJob.findMany({
      where: {
        scheduledEventId: { in: events.map((event) => event.id) },
        status: { in: [...OPEN_EMAIL_STATUSES] },
      },
      select: { id: true },
    });
    await db.emailJob.updateMany({
      where: { id: { in: emailJobs.map((job) => job.id) } },
      data: {
        status: "CANCELLED",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastError: "Cancelled — billing cycle settled",
      },
    });
    for (const job of emailJobs) {
      await markNotificationsReadForEntity(db, {
        entityType: "EmailJob",
        entityId: job.id,
      });
    }
  }
}
