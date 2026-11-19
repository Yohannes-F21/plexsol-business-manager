import type { PaymentAllocation, Prisma, PrismaClient } from "@prisma/client";
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

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Allocates part of a client payment to exactly one project or billing cycle.
 * Relies on PostgreSQL triggers for ownership + over-allocation hard guarantees;
 * this helper adds transactional validation and audit logging.
 */
export async function allocatePayment(
  db: Db,
  input: CreateAllocationInput,
): Promise<PaymentAllocation> {
  const amount = money(input.amount);
  assertPositiveMoney(amount);

  const hasProject = Boolean(input.target.projectId);
  const hasCycle = Boolean(input.target.billingCycleId);
  if (hasProject === hasCycle) {
    throw new Error("Allocation must target exactly one project or billing cycle");
  }

  const run = async (tx: Prisma.TransactionClient) => {
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

    return allocation;
  };

  if ("$transaction" in db) {
    return db.$transaction((tx) => run(tx));
  }

  return run(db);
}
