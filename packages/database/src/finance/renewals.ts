import type { Prisma, PrismaClient, SubscriptionRenewal } from "@prisma/client";
import { cancelSubscriptionReminders } from "../jobs/cancel-reminders.js";
import { scheduleSubscriptionRemindersFor } from "../jobs/schedule-reminders.js";
import { assertPositiveMoney, convertAmount, money } from "../money.js";

export type ConfirmRenewalInput = {
  subscriptionId: string;
  renewedAt?: Date;
  newExpirationDate: Date;
  amount: string | Prisma.Decimal;
  currencyCode: string;
  amountEtb?: string | Prisma.Decimal;
  exchangeRateId?: string;
  paymentMethodId?: string;
  confirmedById?: string;
  notes?: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

const SUBSCRIPTION_RENEWAL_CATEGORY_SLUG = "subscription_renewal";

/**
 * Confirms a subscription renewal and creates exactly one linked expense
 * in the same transaction (no duplicate renewal expenses).
 */
export async function confirmSubscriptionRenewal(
  db: Db,
  input: ConfirmRenewalInput,
): Promise<SubscriptionRenewal> {
  const amount = money(input.amount);
  assertPositiveMoney(amount);

  const run = async (tx: Prisma.TransactionClient) => {
    const subscription = await tx.subscription.findUniqueOrThrow({
      where: { id: input.subscriptionId },
    });

    const category = await tx.expenseCategory.findUnique({
      where: { slug: SUBSCRIPTION_RENEWAL_CATEGORY_SLUG },
    });
    if (!category) {
      throw new Error(
        `Missing system expense category "${SUBSCRIPTION_RENEWAL_CATEGORY_SLUG}" — run seed`,
      );
    }

    // ETB renewals always snapshot 1:1 — reject mismatched amountEtb (DEF-FS-01).
    let amountEtb: ReturnType<typeof money>;
    if (input.currencyCode === "ETB") {
      if (input.amountEtb != null && !money(input.amountEtb).eq(amount)) {
        throw new Error("For ETB renewals, amountEtb must equal amount");
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
      throw new Error("amountEtb or exchangeRateId is required for non-ETB renewals");
    }

    const expense = await tx.expense.create({
      data: {
        categoryId: category.id,
        amount,
        currencyCode: input.currencyCode,
        amountEtb,
        exchangeRateId: input.exchangeRateId,
        description: `Subscription renewal: ${subscription.name}`,
        incurredAt: input.renewedAt ?? new Date(),
        paymentMethodId: input.paymentMethodId,
        isSubscriptionRenewal: true,
        createdById: input.confirmedById,
      },
    });

    const renewal = await tx.subscriptionRenewal.create({
      data: {
        subscriptionId: subscription.id,
        renewedAt: input.renewedAt ?? new Date(),
        previousExpirationDate: subscription.expirationDate,
        newExpirationDate: input.newExpirationDate,
        amount,
        currencyCode: input.currencyCode,
        expenseId: expense.id,
        confirmedById: input.confirmedById,
        notes: input.notes,
      },
    });

    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        expirationDate: input.newExpirationDate,
        amount,
        currencyCode: input.currencyCode,
        status: "ACTIVE",
      },
    });

    // Cancel obsolete reminders inside the financial transaction.
    // Reschedule after commit — Neon pooled interactive txs time out on many inserts.
    await cancelSubscriptionReminders(tx, subscription.id);

    await tx.auditLog.create({
      data: {
        actorUserId: input.confirmedById,
        action: "CREATE",
        entityType: "SubscriptionRenewal",
        entityId: renewal.id,
        after: { renewal, expense },
        reason: "Confirmed subscription renewal with single linked expense",
      },
    });

    return renewal;
  };

  const renewal =
    "$transaction" in db
      ? await db.$transaction((tx) => run(tx), {
          timeout: 60_000,
          maxWait: 10_000,
        })
      : await run(db);

  // Schedule against the new expiration outside the interactive transaction.
  await scheduleSubscriptionRemindersFor(db, input.subscriptionId);

  return renewal;
}
