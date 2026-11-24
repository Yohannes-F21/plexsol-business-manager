import { Prisma, type EmailJob, type PrismaClient, type ScheduledEvent } from "@prisma/client";
import { DEFAULT_WORKER_LEASE_MS } from "./constants.js";
import { writeJobLog } from "./logs.js";

type Db = PrismaClient;

function leaseExpiry(leaseMs: number) {
  return new Date(Date.now() + leaseMs);
}

/**
 * Atomically claim due scheduled events using SKIP LOCKED.
 * Recovers from crashes via lease expiry (see recoverExpiredLeases).
 */
export async function claimScheduledEvents(
  db: Db,
  input: {
    workerId: string;
    limit?: number;
    leaseMs?: number;
    now?: Date;
  },
): Promise<ScheduledEvent[]> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 10;
  const leaseMs = input.leaseMs ?? DEFAULT_WORKER_LEASE_MS;
  const expires = leaseExpiry(leaseMs);

  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE scheduled_events AS se
    SET
      status = 'PROCESSING',
      claimed_by = ${input.workerId},
      claimed_at = ${now},
      lease_expires_at = ${expires},
      updated_at = ${now}
    WHERE se.id IN (
      SELECT id FROM scheduled_events
      WHERE status IN ('PENDING', 'APPROVED')
        AND scheduled_for <= ${now}
      ORDER BY scheduled_for ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING se.id
  `);

  if (!rows.length) return [];

  return db.scheduledEvent.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });
}

/**
 * Claim sendable email jobs (PENDING or APPROVED only — never AWAITING_APPROVAL).
 */
export async function claimEmailJobs(
  db: Db,
  input: {
    workerId: string;
    limit?: number;
    leaseMs?: number;
    now?: Date;
  },
): Promise<EmailJob[]> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 10;
  const leaseMs = input.leaseMs ?? DEFAULT_WORKER_LEASE_MS;
  const expires = leaseExpiry(leaseMs);

  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE email_jobs AS ej
    SET
      status = 'SENDING',
      claimed_by = ${input.workerId},
      claimed_at = ${now},
      lease_expires_at = ${expires},
      updated_at = ${now}
    WHERE ej.id IN (
      SELECT id FROM email_jobs
      WHERE status IN ('PENDING', 'APPROVED')
        AND attempt_count < max_attempts
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING ej.id
  `);

  if (!rows.length) return [];

  return db.emailJob.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });
}

/** Requeue jobs whose worker lease expired (crash recovery). */
export async function recoverExpiredLeases(
  db: Db,
  input: { workerId: string; now?: Date },
): Promise<{ events: number; emails: number }> {
  const now = input.now ?? new Date();

  const expiredEvents = await db.scheduledEvent.findMany({
    where: {
      status: "PROCESSING",
      leaseExpiresAt: { lt: now },
    },
    select: { id: true, approvedAt: true },
  });

  let eventsRecovered = 0;
  for (const event of expiredEvents) {
    await db.scheduledEvent.update({
      where: { id: event.id },
      data: {
        status: event.approvedAt ? "APPROVED" : "PENDING",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastError: "Lease expired — requeued for crash recovery",
      },
    });
    eventsRecovered += 1;
  }

  const expiredEmails = await db.emailJob.findMany({
    where: {
      status: "SENDING",
      leaseExpiresAt: { lt: now },
    },
    select: { id: true, approvedAt: true },
  });

  let emailsRecovered = 0;
  for (const job of expiredEmails) {
    const alreadySent = await db.emailDeliveryAttempt.findFirst({
      where: { emailJobId: job.id, status: "SUCCESS" },
      select: { id: true },
    });

    await db.emailJob.update({
      where: { id: job.id },
      data: alreadySent
        ? {
            // DEF-FS-03: SUCCESS attempt already persisted — finalize without re-send.
            status: "SENT",
            sentAt: new Date(),
            claimedBy: null,
            claimedAt: null,
            leaseExpiresAt: null,
            lastError: null,
          }
        : {
            // Preserve approval gate — never demote APPROVED → PENDING after a crash.
            status: job.approvedAt ? "APPROVED" : "PENDING",
            claimedBy: null,
            claimedAt: null,
            leaseExpiresAt: null,
            lastError: "Lease expired — requeued for crash recovery",
          },
    });
    emailsRecovered += 1;
  }

  if (eventsRecovered > 0 || emailsRecovered > 0) {
    await writeJobLog(db, {
      workerId: input.workerId,
      jobKind: "Scheduler",
      jobId: "leases",
      action: "RECOVER_LEASES",
      message: `Requeued ${eventsRecovered} events and ${emailsRecovered} email jobs`,
      detail: { events: eventsRecovered, emails: emailsRecovered },
    });
  }

  return { events: eventsRecovered, emails: emailsRecovered };
}
