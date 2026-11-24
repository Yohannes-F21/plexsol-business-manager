import type { EmailJob, Prisma, PrismaClient } from "@prisma/client";
import { markNotificationsReadForEntity } from "./notifications.js";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Administrator approval for overdue (and other gated) email drafts.
 * Moves AWAITING_APPROVAL → APPROVED so the worker may claim and send.
 * Never auto-sends; the worker still revalidates eligibility before delivery.
 */
export async function approveEmailJob(
  db: Db,
  input: { emailJobId: string; approvedById: string },
): Promise<EmailJob> {
  const job = await db.emailJob.findUnique({
    where: { id: input.emailJobId },
  });
  if (!job) {
    throw new Error("Email job not found");
  }
  if (job.status !== "AWAITING_APPROVAL") {
    throw new Error(
      `Email job cannot be approved from status ${job.status}`,
    );
  }

  const updated = await db.emailJob.update({
    where: { id: job.id },
    data: {
      status: "APPROVED",
      approvedById: input.approvedById,
      approvedAt: new Date(),
      lastError: null,
    },
  });

  if (job.scheduledEventId) {
    await db.scheduledEvent.updateMany({
      where: {
        id: job.scheduledEventId,
        status: { in: ["AWAITING_APPROVAL", "PENDING"] },
      },
      data: {
        status: "APPROVED",
        approvedById: input.approvedById,
        approvedAt: new Date(),
      },
    });
  }

  await db.auditLog.create({
    data: {
      actorUserId: input.approvedById,
      action: "APPROVE",
      entityType: "EmailJob",
      entityId: job.id,
      after: { status: "APPROVED" },
      reason: "Administrator approved email draft for delivery",
    },
  });

  await markNotificationsReadForEntity(db, {
    entityType: "EmailJob",
    entityId: job.id,
  });

  return updated;
}

export async function rejectEmailJob(
  db: Db,
  input: { emailJobId: string; rejectedById: string; reason?: string },
): Promise<EmailJob> {
  const job = await db.emailJob.findUnique({
    where: { id: input.emailJobId },
  });
  if (!job) {
    throw new Error("Email job not found");
  }
  if (job.status !== "AWAITING_APPROVAL" && job.status !== "APPROVED") {
    throw new Error(
      `Email job cannot be cancelled from status ${job.status}`,
    );
  }

  const updated = await db.emailJob.update({
    where: { id: job.id },
    data: {
      status: "CANCELLED",
      lastError: input.reason ?? "Rejected by administrator",
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });

  if (job.scheduledEventId) {
    await db.scheduledEvent.updateMany({
      where: {
        id: job.scheduledEventId,
        status: { in: ["AWAITING_APPROVAL", "APPROVED", "PENDING"] },
      },
      data: {
        status: "CANCELLED",
        lastError: input.reason ?? "Email draft rejected",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });
  }

  await db.auditLog.create({
    data: {
      actorUserId: input.rejectedById,
      action: "CANCEL",
      entityType: "EmailJob",
      entityId: job.id,
      after: { status: "CANCELLED" },
      reason: input.reason ?? "Administrator rejected email draft",
    },
  });

  await markNotificationsReadForEntity(db, {
    entityType: "EmailJob",
    entityId: job.id,
  });

  return updated;
}
