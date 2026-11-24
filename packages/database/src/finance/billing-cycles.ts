import type {
  MaintenanceAgreement,
  MaintenanceBillingCycle,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  addMonthsClamped,
  dayBefore,
  isBeforeOrEqual,
  startOfUtcDay,
  utcParts,
} from "./dates.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type GenerateBillingCyclesInput = {
  agreementId: string;
  /** Generate periods whose start is on or before this date (inclusive). Default: today UTC. */
  asOf?: Date;
  actorUserId?: string;
};

export type GenerateBillingCyclesResult = {
  created: MaintenanceBillingCycle[];
  skipped: number;
};

function monthsPerPeriod(frequency: MaintenanceAgreement["billingFrequency"]): number {
  return frequency === "YEARLY" ? 12 : 1;
}

function isRootClient(db: Db): db is PrismaClient {
  return typeof (db as PrismaClient).$connect === "function";
}

/**
 * Idempotently generates billing cycles from the agreement activation date
 * through `asOf`, clamping month-end activation days (29/30/31).
 * Existing periods (unique agreement + periodStart) are skipped.
 */
export async function generateBillingCycles(
  db: Db,
  input: GenerateBillingCyclesInput,
): Promise<GenerateBillingCyclesResult> {
  const run = async (tx: Prisma.TransactionClient) => {
    const agreement = await tx.maintenanceAgreement.findUniqueOrThrow({
      where: { id: input.agreementId },
    });

    if (agreement.status !== "ACTIVE") {
      throw new Error("Billing cycles can only be generated for ACTIVE agreements");
    }

    const asOf = startOfUtcDay(input.asOf ?? new Date());
    const start = startOfUtcDay(agreement.startDate);
    const end = agreement.endDate ? startOfUtcDay(agreement.endDate) : null;
    const anchorDay = utcParts(start).day;
    const step = monthsPerPeriod(agreement.billingFrequency);

    const planned: Array<{
      maintenanceAgreementId: string;
      periodStart: Date;
      periodEnd: Date;
      dueDate: Date;
      amount: Prisma.Decimal;
      currencyCode: string;
      status: "PENDING";
    }> = [];

    let index = 0;
    while (true) {
      const periodStart = addMonthsClamped(start, index * step, anchorDay);
      if (!isBeforeOrEqual(periodStart, asOf)) break;
      if (end && periodStart.getTime() > end.getTime()) break;

      const nextStart = addMonthsClamped(start, (index + 1) * step, anchorDay);
      planned.push({
        maintenanceAgreementId: agreement.id,
        periodStart,
        periodEnd: dayBefore(nextStart),
        dueDate: nextStart,
        amount: agreement.amount,
        currencyCode: agreement.currencyCode,
        status: "PENDING",
      });
      index += 1;
      if (index > 240) {
        throw new Error("Billing cycle generation exceeded safety limit");
      }
    }

    if (planned.length === 0) {
      return { created: [] as MaintenanceBillingCycle[], skipped: 0 };
    }

    const existing = await tx.maintenanceBillingCycle.findMany({
      where: {
        maintenanceAgreementId: agreement.id,
        periodStart: { in: planned.map((row) => row.periodStart) },
      },
      select: { periodStart: true },
    });
    const existingKeys = new Set(
      existing.map((row) => row.periodStart.toISOString()),
    );

    const toCreate = planned.filter(
      (row) => !existingKeys.has(row.periodStart.toISOString()),
    );
    const skipped = planned.length - toCreate.length;

    if (toCreate.length === 0) {
      return { created: [] as MaintenanceBillingCycle[], skipped };
    }

    await tx.maintenanceBillingCycle.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    const created = await tx.maintenanceBillingCycle.findMany({
      where: {
        maintenanceAgreementId: agreement.id,
        periodStart: { in: toCreate.map((row) => row.periodStart) },
      },
      orderBy: { periodStart: "asc" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "CREATE",
        entityType: "MaintenanceBillingCycle",
        entityId: agreement.id,
        after: {
          createdCount: created.length,
          skipped,
          asOf: asOf.toISOString(),
          cycleIds: created.map((cycle) => cycle.id),
        },
        reason: "Generated maintenance billing cycles",
      },
    });

    return { created, skipped };
  };

  if (isRootClient(db)) {
    return db.$transaction((tx) => run(tx), { timeout: 60_000 });
  }
  return run(db);
}
