import { Prisma, type EmailJob, type PrismaClient } from "@prisma/client";
import { EMAIL_RETRY_BACKOFF_SECONDS } from "./constants.js";
import { revalidateScheduledEvent } from "./eligibility.js";
import { writeJobLog } from "./logs.js";
import {
  createNotificationForAdmins,
  markNotificationsReadForEntity,
} from "./notifications.js";
import type { EmailTransport } from "./email/transport.js";

function nextAttemptAtFor(attemptNumber: number, now = new Date()): Date | null {
  // attemptNumber is the attempt that just failed; schedule delay before the next one.
  const delaySeconds =
    EMAIL_RETRY_BACKOFF_SECONDS[attemptNumber - 1] ??
    EMAIL_RETRY_BACKOFF_SECONDS[EMAIL_RETRY_BACKOFF_SECONDS.length - 1];
  if (delaySeconds == null) return null;
  return new Date(now.getTime() + delaySeconds * 1000);
}

type Db = PrismaClient;

function deliveryIdempotencyKey(job: EmailJob, attemptNumber: number): string {
  return `${job.idempotencyKey ?? job.id}:attempt:${attemptNumber}`;
}

async function finalizeAlreadySent(
  db: Db,
  input: {
    workerId: string;
    job: EmailJob;
    attemptNumber: number;
    providerResponse?: string | null;
  },
): Promise<void> {
  const { job, workerId, attemptNumber, providerResponse } = input;
  await db.emailJob.update({
    where: { id: job.id },
    data: {
      status: "SENT",
      attemptCount: Math.max(job.attemptCount, attemptNumber),
      sentAt: job.sentAt ?? new Date(),
      lastError: null,
      nextAttemptAt: null,
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });
  await writeJobLog(db, {
    workerId,
    jobKind: "EmailJob",
    jobId: job.id,
    action: "SENT_IDEMPOTENT",
    message: "Skipped duplicate send — prior SUCCESS delivery recorded",
    detail: providerResponse ? { providerResponse } : undefined,
  });
}

/**
 * Send a claimed email job. Revalidates linked scheduled event eligibility first.
 * Never sends AWAITING_APPROVAL jobs (claim excludes them).
 *
 * Crash-safe (DEF-FS-03): if a SUCCESS attempt already exists, finalize SENT
 * without calling the transport again. Transport also receives an idempotency key.
 */
export async function processEmailJob(
  db: Db,
  input: {
    workerId: string;
    job: EmailJob;
    transport: EmailTransport;
    fromAddress: string;
  },
): Promise<void> {
  const { job, workerId, transport, fromAddress } = input;

  if (job.status === "AWAITING_APPROVAL") {
    await db.emailJob.update({
      where: { id: job.id },
      data: {
        status: "AWAITING_APPROVAL",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastError: "Blocked — overdue emails require administrator approval",
      },
    });
    return;
  }

  if (job.status === "SENT") {
    await db.emailJob.update({
      where: { id: job.id },
      data: {
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });
    return;
  }

  const priorSuccess = await db.emailDeliveryAttempt.findFirst({
    where: { emailJobId: job.id, status: "SUCCESS" },
    orderBy: { attemptNumber: "desc" },
  });
  if (priorSuccess) {
    await finalizeAlreadySent(db, {
      workerId,
      job,
      attemptNumber: priorSuccess.attemptNumber,
      providerResponse: priorSuccess.providerResponse,
    });
    return;
  }

  if (job.scheduledEventId) {
    const event = await db.scheduledEvent.findUnique({
      where: { id: job.scheduledEventId },
    });
    if (event) {
      const eligibility = await revalidateScheduledEvent(db, event);
      if (!eligibility.ok) {
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            status: "CANCELLED",
            lastError: eligibility.reason,
            claimedBy: null,
            claimedAt: null,
            leaseExpiresAt: null,
          },
        });
        await writeJobLog(db, {
          workerId,
          jobKind: "EmailJob",
          jobId: job.id,
          action: "CANCELLED_INELIGIBLE",
          message: eligibility.reason,
        });
        return;
      }
    }
  }

  const attemptNumber = job.attemptCount + 1;
  const idempotencyKey = deliveryIdempotencyKey(job, attemptNumber);

  const result = await transport.send({
    to: job.toEmail,
    subject: job.subject,
    html: job.bodyHtml,
    text: job.bodyText,
    from: fromAddress,
    idempotencyKey,
  });

  if (result.ok) {
    // Persist SUCCESS before flipping the job — crash after this still avoids re-send.
    try {
      await db.emailDeliveryAttempt.create({
        data: {
          emailJobId: job.id,
          attemptNumber,
          status: "SUCCESS",
          providerResponse: result.providerResponse,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        await finalizeAlreadySent(db, {
          workerId,
          job,
          attemptNumber,
          providerResponse: result.providerResponse,
        });
        return;
      }
      throw error;
    }

    await db.emailJob.update({
      where: { id: job.id },
      data: {
        status: "SENT",
        attemptCount: attemptNumber,
        sentAt: new Date(),
        lastError: null,
        nextAttemptAt: null,
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });
    await writeJobLog(db, {
      workerId,
      jobKind: "EmailJob",
      jobId: job.id,
      action: result.deduplicated ? "SENT_DEDUPED" : "SENT",
      message: `Delivered to ${job.toEmail}`,
      detail: { idempotencyKey, deduplicated: Boolean(result.deduplicated) },
    });
    await markNotificationsReadForEntity(db, {
      entityType: "EmailJob",
      entityId: job.id,
    });
    return;
  }

  const permanent = Boolean(result.permanent);
  const exhausted = attemptNumber >= job.maxAttempts || permanent;
  const retryAt = exhausted ? null : nextAttemptAtFor(attemptNumber);

  await db.emailDeliveryAttempt.create({
    data: {
      emailJobId: job.id,
      attemptNumber,
      status: permanent ? "PERMANENT_FAILURE" : "TEMPORARY_FAILURE",
      providerResponse: result.providerResponse,
      errorMessage: result.errorMessage,
    },
  });

  await db.emailJob.update({
    where: { id: job.id },
    data: {
      status: exhausted ? "FAILED" : "PENDING",
      attemptCount: attemptNumber,
      lastError: result.errorMessage ?? "Delivery failed",
      nextAttemptAt: retryAt,
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });

  await writeJobLog(db, {
    workerId,
    jobKind: "EmailJob",
    jobId: job.id,
    action: exhausted ? "FAILED" : "RETRY_SCHEDULED",
    message: result.errorMessage ?? "Delivery failed",
    detail: retryAt ? { nextAttemptAt: retryAt.toISOString() } : undefined,
  });

  if (exhausted) {
    await createNotificationForAdmins(db, {
      type: "WARNING",
      title: "Email delivery failed",
      body: `Failed to send “${job.subject}” to ${job.toEmail} after ${attemptNumber} attempt(s).`,
      entityType: "EmailJob",
      entityId: job.id,
    });
  }
}
