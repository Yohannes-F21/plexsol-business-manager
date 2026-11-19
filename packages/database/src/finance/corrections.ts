import type { AuditLog, Prisma, PrismaClient } from "@prisma/client";
import { money } from "../money.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type CorrectPaymentAmountInput = {
  paymentId: string;
  newAmount: string | Prisma.Decimal;
  actorUserId?: string;
  reason: string;
};

/**
 * Financial correction for a client payment amount.
 * Rejects reductions below already-allocated totals and always writes an audit log.
 */
export async function correctClientPaymentAmount(
  db: Db,
  input: CorrectPaymentAmountInput,
): Promise<{ paymentId: string; audit: AuditLog }> {
  if (!input.reason.trim()) {
    throw new Error("Financial corrections require a reason");
  }

  const newAmount = money(input.newAmount);

  const run = async (tx: Prisma.TransactionClient) => {
    const before = await tx.clientPayment.findUniqueOrThrow({
      where: { id: input.paymentId },
    });

    if (newAmount.lt(money(before.amountAllocated))) {
      throw new Error(
        `Cannot correct payment below allocated amount (${before.amountAllocated})`,
      );
    }

    const after = await tx.clientPayment.update({
      where: { id: input.paymentId },
      data: { amount: newAmount },
    });

    const audit = await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "CORRECT",
        entityType: "ClientPayment",
        entityId: after.id,
        before,
        after,
        reason: input.reason,
      },
    });

    return { paymentId: after.id, audit };
  };

  if ("$transaction" in db) {
    return db.$transaction((tx) => run(tx));
  }

  return run(db);
}
