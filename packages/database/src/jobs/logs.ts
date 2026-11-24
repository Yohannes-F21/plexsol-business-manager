import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function writeJobLog(
  db: Db,
  input: {
    workerId: string;
    jobKind: "ScheduledEvent" | "EmailJob" | "Scheduler";
    jobId: string;
    action: string;
    message?: string;
    detail?: Prisma.InputJsonValue;
  },
) {
  await db.jobExecutionLog.create({
    data: {
      workerId: input.workerId,
      jobKind: input.jobKind,
      jobId: input.jobId,
      action: input.action,
      message: input.message,
      detail: input.detail,
    },
  });
}
