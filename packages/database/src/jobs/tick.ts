import type { PrismaClient } from "@prisma/client";
import {
  claimEmailJobs,
  claimScheduledEvents,
  recoverExpiredLeases,
} from "./claim.js";
import type { EmailTransport } from "./email/transport.js";
import { writeJobLog } from "./logs.js";
import { processEmailJob } from "./process-emails.js";
import { processScheduledEvent } from "./process-events.js";
import {
  scheduleDueSubscriptionReminders,
  scheduleMaintenanceDueReminders,
  scheduleOverduePaymentDrafts,
} from "./schedule-reminders.js";

export type WorkerTickOptions = {
  workerId: string;
  transport: EmailTransport;
  fromAddress: string;
  now?: Date;
  claimLimit?: number;
};

export type WorkerTickResult = {
  recoveredEvents: number;
  recoveredEmails: number;
  scheduledSubscription: number;
  scheduledMaintenanceDue: number;
  scheduledOverdue: number;
  processedEvents: number;
  processedEmails: number;
};

export async function runJobsTick(
  db: PrismaClient,
  options: WorkerTickOptions,
): Promise<WorkerTickResult> {
  const now = options.now ?? new Date();
  const limit = options.claimLimit ?? 10;

  const recovered = await recoverExpiredLeases(db, {
    workerId: options.workerId,
    now,
  });

  const scheduledSubscription = await scheduleDueSubscriptionReminders(db);
  const scheduledMaintenanceDue = await scheduleMaintenanceDueReminders(db, {
    asOf: now,
  });
  const scheduledOverdue = await scheduleOverduePaymentDrafts(db, {
    asOf: now,
  });

  const events = await claimScheduledEvents(db, {
    workerId: options.workerId,
    limit,
    now,
  });
  for (const event of events) {
    await processScheduledEvent(db, {
      workerId: options.workerId,
      event,
    });
  }

  const emails = await claimEmailJobs(db, {
    workerId: options.workerId,
    limit,
    now,
  });
  for (const job of emails) {
    await processEmailJob(db, {
      workerId: options.workerId,
      job,
      transport: options.transport,
      fromAddress: options.fromAddress,
    });
  }

  await writeJobLog(db, {
    workerId: options.workerId,
    jobKind: "Scheduler",
    jobId: "tick",
    action: "TICK_COMPLETE",
    detail: {
      recovered,
      scheduledSubscription,
      scheduledMaintenanceDue,
      scheduledOverdue,
      processedEvents: events.length,
      processedEmails: emails.length,
    },
  });

  return {
    recoveredEvents: recovered.events,
    recoveredEmails: recovered.emails,
    scheduledSubscription,
    scheduledMaintenanceDue,
    scheduledOverdue,
    processedEvents: events.length,
    processedEmails: emails.length,
  };
}
