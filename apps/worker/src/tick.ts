import { randomUUID } from "node:crypto";
import {
  createEmailTransport,
  prisma,
  runJobsTick,
} from "@plexsol/database";
import type { WorkerEnv } from "@plexsol/shared";

const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

export async function runWorkerTick(env: WorkerEnv): Promise<void> {
  const transport = createEmailTransport({
    smtpHost: env.SMTP_HOST || undefined,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER || undefined,
    smtpPassword: env.SMTP_PASSWORD || undefined,
  });

  const result = await runJobsTick(prisma, {
    workerId,
    transport,
    fromAddress: env.EMAIL_FROM,
  });

  console.log(
    `[worker] tick complete recovered=${result.recoveredEvents}/${result.recoveredEmails} ` +
      `scheduled=${result.scheduledSubscription}/${result.scheduledMaintenanceDue}/${result.scheduledOverdue} ` +
      `processed=${result.processedEvents}/${result.processedEmails}`,
  );
}
