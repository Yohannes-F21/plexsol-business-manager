import { Prisma, type PrismaClient, type ScheduledEvent } from "@prisma/client";
import { DEFAULT_EMAIL_MAX_ATTEMPTS, TEMPLATE_KEYS } from "./constants.js";
import { revalidateScheduledEvent } from "./eligibility.js";
import { writeJobLog } from "./logs.js";
import { renderTemplate } from "./templates.js";
import { createNotificationForAdmins } from "./notifications.js";

type Db = PrismaClient;

function templateKeyFor(type: ScheduledEvent["type"]): string {
  switch (type) {
    case "SUBSCRIPTION_REMINDER":
      return TEMPLATE_KEYS.subscriptionReminder;
    case "MAINTENANCE_DUE_REMINDER":
      return TEMPLATE_KEYS.maintenanceDue;
    case "OVERDUE_PAYMENT_EMAIL":
      return TEMPLATE_KEYS.overduePayment;
    default:
      return TEMPLATE_KEYS.subscriptionReminder;
  }
}

async function maxAttempts(db: Db): Promise<number> {
  const setting = await db.setting.findUnique({
    where: { key: "email_max_attempts" },
  });
  return typeof setting?.value === "number"
    ? setting.value
    : DEFAULT_EMAIL_MAX_ATTEMPTS;
}

/**
 * Process a claimed scheduled event: revalidate, then create an email job.
 * Overdue emails are created as AWAITING_APPROVAL and never sent automatically.
 */
export async function processScheduledEvent(
  db: Db,
  input: { workerId: string; event: ScheduledEvent },
): Promise<void> {
  const { event, workerId } = input;
  const eligibility = await revalidateScheduledEvent(db, event);

  if (!eligibility.ok) {
    await db.scheduledEvent.update({
      where: { id: event.id },
      data: {
        status: "CANCELLED",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastError: eligibility.reason,
      },
    });
    await writeJobLog(db, {
      workerId,
      jobKind: "ScheduledEvent",
      jobId: event.id,
      action: "CANCELLED_INELIGIBLE",
      message: eligibility.reason,
    });
    return;
  }

  const template = await db.emailTemplate.findUnique({
    where: { key: templateKeyFor(event.type) },
  });
  if (!template) {
    await db.scheduledEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lastError: `Missing email template for ${event.type}`,
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });
    return;
  }

  const subject = renderTemplate(template.subject, eligibility.vars);
  const bodyHtml = renderTemplate(template.bodyHtml, eligibility.vars);
  const bodyText = template.bodyText
    ? renderTemplate(template.bodyText, eligibility.vars)
    : null;

  const requiresApproval =
    event.requiresApproval || event.type === "OVERDUE_PAYMENT_EMAIL";
  const emailStatus = requiresApproval ? "AWAITING_APPROVAL" : "PENDING";
  const idempotencyKey = `email:${event.idempotencyKey ?? event.id}`;

  try {
    const job = await db.emailJob.create({
      data: {
        templateId: template.id,
        scheduledEventId: event.id,
        toEmail: eligibility.toEmail,
        subject,
        bodyHtml,
        bodyText,
        status: emailStatus,
        maxAttempts: await maxAttempts(db),
        idempotencyKey,
      },
    });

    await db.scheduledEvent.update({
      where: { id: event.id },
      data: {
        status: requiresApproval ? "AWAITING_APPROVAL" : "COMPLETED",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });

    await writeJobLog(db, {
      workerId,
      jobKind: "ScheduledEvent",
      jobId: event.id,
      action: requiresApproval ? "DRAFT_EMAIL_CREATED" : "EMAIL_ENQUEUED",
      message: `Created email job ${job.id}`,
      detail: { emailJobId: job.id, status: emailStatus },
    });

    if (requiresApproval) {
      await createNotificationForAdmins(db, {
        type: "ACTION_REQUIRED",
        title: "Overdue email awaiting approval",
        body: `${eligibility.vars.project_name ?? "A client"} has an overdue payment email draft ready for review.`,
        entityType: "EmailJob",
        entityId: job.id,
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await db.scheduledEvent.update({
        where: { id: event.id },
        data: {
          status: "COMPLETED",
          claimedBy: null,
          claimedAt: null,
          leaseExpiresAt: null,
          lastError: "Email job already existed (idempotent)",
        },
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Process failed";
    const attempts = event.attemptCount + 1;
    const failed = attempts >= event.maxAttempts;
    await db.scheduledEvent.update({
      where: { id: event.id },
      data: {
        status: failed ? "FAILED" : "PENDING",
        attemptCount: attempts,
        lastError: message,
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });
    await writeJobLog(db, {
      workerId,
      jobKind: "ScheduledEvent",
      jobId: event.id,
      action: failed ? "FAILED" : "RETRY_SCHEDULED",
      message,
    });
  }
}
