import type { PaymentAllocation, Prisma, PrismaClient } from "@prisma/client";
import { cancelBillingCycleReminders } from "../jobs/cancel-reminders.js";
import { assertMoneyNotExceeding, assertPositiveMoney, money } from "../money.js";

export type AllocationTarget =
  | { projectId: string; billingCycleId?: never }
  | { billingCycleId: string; projectId?: never };

export type CreateAllocationInput = {
  clientPaymentId: string;
  amount: string | Prisma.Decimal;
  target: AllocationTarget;
  notes?: string;
  actorUserId?: string;
  reason?: string;
};

export type BatchAllocationLine = {
  amount: string | Prisma.Decimal;
  target: AllocationTarget;
  notes?: string;
};

export type AllocatePaymentBatchInput = {
  clientPaymentId: string;
  allocations: BatchAllocationLine[];
  actorUserId?: string;
  reason?: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

function isRootClient(db: Db): db is PrismaClient {
  return typeof (db as PrismaClient).$connect === "function";
}

async function createOneAllocation(
  tx: Prisma.TransactionClient,
  input: CreateAllocationInput,
): Promise<PaymentAllocation> {
  const amount = money(input.amount);
  assertPositiveMoney(amount);

  const hasProject = Boolean(input.target.projectId);
  const hasCycle = Boolean(input.target.billingCycleId);
  if (hasProject === hasCycle) {
    throw new Error("Allocation must target exactly one project or billing cycle");
  }

  // Re-read inside the transaction; PostgreSQL trigger also locks payment/cycle rows
  // on insert (concurrency-safe over-allocation guard).
  const payment = await tx.clientPayment.findUniqueOrThrow({
    where: { id: input.clientPaymentId },
  });

  const already = money(payment.amountAllocated);
  const available = money(payment.amount).sub(already);
  assertMoneyNotExceeding(amount, available, "payment allocation");

  if (input.target.billingCycleId) {
    const cycle = await tx.maintenanceBillingCycle.findUniqueOrThrow({
      where: { id: input.target.billingCycleId },
      include: {
        agreement: { include: { project: true } },
      },
    });

    if (cycle.status === "CANCELLED") {
      throw new Error("Cannot allocate to a cancelled billing cycle");
    }
    if (cycle.agreement.project.clientId !== payment.clientId) {
      throw new Error("Payment client does not own the billing cycle");
    }
    if (cycle.currencyCode !== payment.currencyCode) {
      throw new Error("Payment currency must match billing cycle currency");
    }

    const cycleAvailable = money(cycle.amount).sub(money(cycle.amountAllocated));
    assertMoneyNotExceeding(amount, cycleAvailable, "billing cycle allocation");
  }

  if (input.target.projectId) {
    const project = await tx.project.findUniqueOrThrow({
      where: { id: input.target.projectId },
    });
    if (project.clientId !== payment.clientId) {
      throw new Error("Payment client does not own the project");
    }
    if (project.currencyCode !== payment.currencyCode) {
      throw new Error("Payment currency must match project currency");
    }

    const allocatedToProject = await tx.paymentAllocation.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    const projectAllocated = money(allocatedToProject._sum.amount ?? 0);
    const projectAvailable = money(project.agreedPrice).sub(projectAllocated);
    assertMoneyNotExceeding(amount, projectAvailable, "project allocation");
  }

  const allocation = await tx.paymentAllocation.create({
    data: {
      clientPaymentId: input.clientPaymentId,
      amount,
      projectId: input.target.projectId ?? null,
      billingCycleId: input.target.billingCycleId ?? null,
      notes: input.notes,
    },
  });

  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "ALLOCATE",
      entityType: "PaymentAllocation",
      entityId: allocation.id,
      after: allocation,
      reason: input.reason ?? "Payment allocation",
    },
  });

  // Settled cycles cancel due/overdue drafts so obsolete reminders are not sent.
  if (input.target.billingCycleId) {
    const cycle = await tx.maintenanceBillingCycle.findUnique({
      where: { id: input.target.billingCycleId },
      select: { id: true, status: true },
    });
    if (cycle?.status === "PAID") {
      await cancelBillingCycleReminders(tx, cycle.id);
    }
  }

  return allocation;
}

/**
 * Allocates part of a client payment to exactly one project or billing cycle.
 * Application checks + PostgreSQL triggers enforce concurrency-safe balances.
 */
export async function allocatePayment(
  db: Db,
  input: CreateAllocationInput,
): Promise<PaymentAllocation> {
  const run = async (tx: Prisma.TransactionClient) => createOneAllocation(tx, input);

  if (isRootClient(db)) {
    return db.$transaction((tx) => run(tx), { timeout: 60_000, maxWait: 10_000 });
  }
  return run(db);
}

/**
 * Applies multiple allocations from one receipt in a single transaction.
 * Income remains the payment amount once; allocations only apply that balance.
 */
export async function allocatePaymentBatch(
  db: Db,
  input: AllocatePaymentBatchInput,
): Promise<PaymentAllocation[]> {
  if (!input.allocations.length) {
    throw new Error("At least one allocation is required");
  }

  const run = async (tx: Prisma.TransactionClient) => {
    const results: PaymentAllocation[] = [];
    for (const line of input.allocations) {
      results.push(
        await createOneAllocation(tx, {
          clientPaymentId: input.clientPaymentId,
          amount: line.amount,
          target: line.target,
          notes: line.notes,
          actorUserId: input.actorUserId,
          reason: input.reason ?? "Batch payment allocation",
        }),
      );
    }
    return results;
  };

  if (isRootClient(db)) {
    return db.$transaction((tx) => run(tx), { timeout: 60_000, maxWait: 10_000 });
  }
  return run(db);
}
