import type { ClientPayment, Prisma, PrismaClient } from "@prisma/client";
import { assertPositiveMoney, convertAmount, money } from "../money.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type CreateClientPaymentInput = {
  clientId: string;
  amount: string | Prisma.Decimal;
  currencyCode: string;
  amountEtb?: string | Prisma.Decimal;
  exchangeRateId?: string | null;
  paymentMethodId?: string | null;
  paidAt?: Date;
  reference?: string | null;
  notes?: string | null;
  createdById?: string;
};

/**
 * Records a client payment receipt with an ETB reporting snapshot.
 * Does not allocate — income is the receipt amount once; allocations apply it.
 */
export async function createClientPayment(
  db: Db,
  input: CreateClientPaymentInput,
): Promise<ClientPayment> {
  const amount = money(input.amount);
  assertPositiveMoney(amount);

  const run = async (tx: Prisma.TransactionClient) => {
    const client = await tx.client.findUniqueOrThrow({
      where: { id: input.clientId },
    });
    if (!client.isActive) {
      throw new Error("Cannot record payment for inactive client");
    }

    // ETB receipts always snapshot 1:1 — ignore/reject any caller override.
    let amountEtb: ReturnType<typeof money>;
    if (input.currencyCode === "ETB") {
      if (input.amountEtb != null && !money(input.amountEtb).eq(amount)) {
        throw new Error("For ETB payments, amountEtb must equal amount");
      }
      amountEtb = amount;
    } else if (input.amountEtb) {
      amountEtb = money(input.amountEtb);
    } else if (input.exchangeRateId) {
      const rate = await tx.exchangeRate.findUniqueOrThrow({
        where: { id: input.exchangeRateId },
      });
      if (
        rate.fromCurrencyCode !== input.currencyCode ||
        rate.toCurrencyCode !== "ETB"
      ) {
        throw new Error("Exchange rate must convert payment currency to ETB");
      }
      amountEtb = convertAmount(amount, money(rate.rate));
    } else {
      throw new Error("amountEtb or exchangeRateId is required for non-ETB payments");
    }

    const payment = await tx.clientPayment.create({
      data: {
        clientId: input.clientId,
        amount,
        currencyCode: input.currencyCode,
        amountEtb,
        exchangeRateId: input.exchangeRateId ?? null,
        paymentMethodId: input.paymentMethodId ?? null,
        paidAt: input.paidAt ?? new Date(),
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.createdById,
        action: "CREATE",
        entityType: "ClientPayment",
        entityId: payment.id,
        after: payment,
        reason: "Recorded client payment receipt",
      },
    });

    return payment;
  };

  if ("$transaction" in db) {
    return db.$transaction((tx) => run(tx));
  }
  return run(db);
}
