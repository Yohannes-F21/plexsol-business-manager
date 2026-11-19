import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Prisma,
  PrismaClient,
  allocatePayment,
  confirmSubscriptionRenewal,
  correctClientPaymentAmount,
  money,
} from "../src/index.js";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
loadEnv({ path: rootEnv });

const prisma = new PrismaClient();

const suffix = `t${Date.now()}`;

async function seedFixtures() {
  await prisma.currency.upsert({
    where: { code: "ETB" },
    update: { isReporting: true, isActive: true },
    create: {
      code: "ETB",
      name: "Ethiopian Birr",
      symbol: "Br",
      isReporting: true,
    },
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: { isActive: true },
    create: { code: "USD", name: "US Dollar", symbol: "$" },
  });

  await prisma.expenseCategory.upsert({
    where: { slug: "subscription_renewal" },
    update: { isSystem: true },
    create: {
      slug: "subscription_renewal",
      name: "Subscription Renewal",
      isSystem: true,
    },
  });

  const clientA = await prisma.client.create({
    data: { name: `Client A ${suffix}` },
  });
  const clientB = await prisma.client.create({
    data: { name: `Client B ${suffix}` },
  });

  const projectA = await prisma.project.create({
    data: { clientId: clientA.id, name: `Project A ${suffix}` },
  });
  const projectB = await prisma.project.create({
    data: { clientId: clientB.id, name: `Project B ${suffix}` },
  });

  const agreement = await prisma.maintenanceAgreement.create({
    data: {
      projectId: projectA.id,
      billingFrequency: "MONTHLY",
      amount: "1000.0000",
      currencyCode: "ETB",
      startDate: new Date("2026-01-01"),
      status: "ACTIVE",
    },
  });

  const cycle = await prisma.maintenanceBillingCycle.create({
    data: {
      maintenanceAgreementId: agreement.id,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      dueDate: new Date("2026-02-01"),
      amount: "1000.0000",
      currencyCode: "ETB",
    },
  });

  const payment = await prisma.clientPayment.create({
    data: {
      clientId: clientA.id,
      amount: "1000.0000",
      currencyCode: "ETB",
      amountEtb: "1000.0000",
      paidAt: new Date("2026-01-15"),
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      name: `GitHub ${suffix}`,
      amount: "100.0000",
      currencyCode: "USD",
      billingPeriod: "YEARLY",
      startDate: new Date("2025-01-01"),
      expirationDate: new Date("2026-01-01"),
      status: "ACTIVE",
    },
  });

  const rate = await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "56.50000000",
      effectiveAt: new Date(`2026-01-02T00:00:00.${String(Date.now()).slice(-3)}Z`),
      source: "test",
    },
  });

  return {
    clientA,
    clientB,
    projectA,
    projectB,
    agreement,
    cycle,
    payment,
    subscription,
    rate,
  };
}

describe("financial invariants", () => {
  let fx: Awaited<ReturnType<typeof seedFixtures>>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for financial invariant tests");
    }
    fx = await seedFixtures();
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows at most one maintenance agreement per project", async () => {
    await expect(
      prisma.maintenanceAgreement.create({
        data: {
          projectId: fx.projectA.id,
          billingFrequency: "YEARLY",
          amount: "500.0000",
          currencyCode: "ETB",
          startDate: new Date("2026-06-01"),
        },
      }),
    ).rejects.toThrow(/Unique constraint|unique/i);
  });

  it("requires exactly one allocation target (project XOR billing cycle)", async () => {
    await expect(
      prisma.paymentAllocation.create({
        data: {
          clientPaymentId: fx.payment.id,
          amount: "10.0000",
          projectId: null,
          billingCycleId: null,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.paymentAllocation.create({
        data: {
          clientPaymentId: fx.payment.id,
          amount: "10.0000",
          projectId: fx.projectA.id,
          billingCycleId: fx.cycle.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents allocating a payment to another client's project", async () => {
    await expect(
      allocatePayment(prisma, {
        clientPaymentId: fx.payment.id,
        amount: "50.0000",
        target: { projectId: fx.projectB.id },
      }),
    ).rejects.toThrow(/does not own/i);
  });

  it("prevents over-allocation of a client payment", async () => {
    await allocatePayment(prisma, {
      clientPaymentId: fx.payment.id,
      amount: "600.0000",
      target: { billingCycleId: fx.cycle.id },
    });

    await expect(
      allocatePayment(prisma, {
        clientPaymentId: fx.payment.id,
        amount: "500.0000",
        target: { projectId: fx.projectA.id },
      }),
    ).rejects.toThrow(/over|exceed/i);

    const payment = await prisma.clientPayment.findUniqueOrThrow({
      where: { id: fx.payment.id },
    });
    expect(money(payment.amountAllocated).eq("600.0000")).toBe(true);
  });

  it("prevents over-allocation against a billing cycle amount", async () => {
    const extraPayment = await prisma.clientPayment.create({
      data: {
        clientId: fx.clientA.id,
        amount: "2000.0000",
        currencyCode: "ETB",
        amountEtb: "2000.0000",
        paidAt: new Date(),
      },
    });

    // cycle already has 600 allocated from previous test; remaining 400
    await expect(
      allocatePayment(prisma, {
        clientPaymentId: extraPayment.id,
        amount: "500.0000",
        target: { billingCycleId: fx.cycle.id },
      }),
    ).rejects.toThrow(/over|exceed/i);
  });

  it("creates exactly one expense for a subscription renewal", async () => {
    const renewal = await confirmSubscriptionRenewal(prisma, {
      subscriptionId: fx.subscription.id,
      newExpirationDate: new Date("2027-01-01"),
      amount: "120.0000",
      currencyCode: "USD",
      exchangeRateId: fx.rate.id,
    });

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: renewal.expenseId },
    });
    expect(expense.isSubscriptionRenewal).toBe(true);

    const linked = await prisma.subscriptionRenewal.findMany({
      where: { expenseId: expense.id },
    });
    expect(linked).toHaveLength(1);

    await expect(
      prisma.subscriptionRenewal.create({
        data: {
          subscriptionId: fx.subscription.id,
          renewedAt: new Date(),
          previousExpirationDate: new Date("2027-01-01"),
          newExpirationDate: new Date("2028-01-01"),
          amount: "120.0000",
          currencyCode: "USD",
          expenseId: expense.id,
        },
      }),
    ).rejects.toThrow(/Unique constraint|unique/i);
  });

  it("audits financial corrections and blocks unsafe reductions", async () => {
    const payment = await prisma.clientPayment.create({
      data: {
        clientId: fx.clientA.id,
        amount: "300.0000",
        currencyCode: "ETB",
        amountEtb: "300.0000",
        paidAt: new Date(),
      },
    });

    await allocatePayment(prisma, {
      clientPaymentId: payment.id,
      amount: "200.0000",
      target: { projectId: fx.projectA.id },
    });

    await expect(
      correctClientPaymentAmount(prisma, {
        paymentId: payment.id,
        newAmount: "100.0000",
        reason: "Should fail",
      }),
    ).rejects.toThrow(/below allocated/i);

    const { audit } = await correctClientPaymentAmount(prisma, {
      paymentId: payment.id,
      newAmount: "250.0000",
      reason: "Customer credited partial refund adjustment",
    });

    expect(audit.action).toBe("CORRECT");
    expect(audit.reason).toContain("refund");
  });

  it("preserves historical exchange rates (unique effectiveAt)", async () => {
    const effectiveAt = new Date("2026-03-01T00:00:00.000Z");
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyCode: "USD",
        toCurrencyCode: "ETB",
        rate: "57.00000000",
        effectiveAt,
        source: "test-history-1",
      },
    });

    await expect(
      prisma.exchangeRate.create({
        data: {
          fromCurrencyCode: "USD",
          toCurrencyCode: "ETB",
          rate: "58.00000000",
          effectiveAt,
          source: "test-history-dup",
        },
      }),
    ).rejects.toThrow(/Unique constraint|unique/i);

    const later = await prisma.exchangeRate.create({
      data: {
        fromCurrencyCode: "USD",
        toCurrencyCode: "ETB",
        rate: "58.25000000",
        effectiveAt: new Date("2026-04-01T00:00:00.000Z"),
        source: "test-history-2",
      },
    });
    expect(money(later.rate).eq("58.25000000")).toBe(true);
  });

  it("uses Decimal math (not JS floats) for money helpers", () => {
    const total = money("0.1").add(money("0.2"));
    expect(total.eq("0.3")).toBe(true);
    expect(total instanceof Prisma.Decimal).toBe(true);
  });
});
