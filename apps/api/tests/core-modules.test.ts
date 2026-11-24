import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@plexsol/database";
import { apiEnvSchema, type ApiEnv } from "@plexsol/shared";
import { createApp } from "../src/app.js";

const suffix = `core${Date.now()}`;
const adminEmail = "admin@plexsol.com";
const adminPassword =
  process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!";

function loadTestEnv(): ApiEnv {
  const parsed = apiEnvSchema.safeParse({
    ...process.env,
    NODE_ENV: "test",
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid test env: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

describe("core business modules API", () => {
  const env = loadTestEnv();
  const app = createApp(env);
  const agent = request.agent(app);

  const created = {
    clientId: "",
    projectId: "",
    subscriptionId: "",
    usdSubscriptionId: "",
    subscriptionCategoryId: "",
    expenseCategoryId: "",
    expenseId: "",
    paymentMethodId: "",
    renewalExpenseId: "",
    usdRenewalExpenseId: "",
  };

  async function cleanupSubscription(subscriptionId: string) {
    if (!subscriptionId) return;
    await prisma.scheduledEvent.deleteMany({
      where: { entityId: subscriptionId },
    });
    const renewals = await prisma.subscriptionRenewal.findMany({
      where: { subscriptionId },
    });
    for (const renewal of renewals) {
      await prisma.subscriptionRenewal.delete({ where: { id: renewal.id } });
      await prisma.expense
        .delete({ where: { id: renewal.expenseId } })
        .catch(() => undefined);
    }
    await prisma.subscription.deleteMany({ where: { id: subscriptionId } });
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for core module tests");
    }

    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      throw new Error("Admin user missing — run pnpm db:seed first");
    }

    const login = await agent.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
    });
    expect(login.status).toBe(200);
  }, 60_000);

  afterAll(async () => {
    await cleanupSubscription(created.subscriptionId);
    await cleanupSubscription(created.usdSubscriptionId);
    if (created.expenseId) {
      await prisma.expense.deleteMany({ where: { id: created.expenseId } });
    }
    if (created.expenseCategoryId) {
      await prisma.expenseCategory.deleteMany({
        where: { id: created.expenseCategoryId },
      });
    }
    if (created.subscriptionCategoryId) {
      await prisma.subscriptionCategory.deleteMany({
        where: { id: created.subscriptionCategoryId },
      });
    }
    if (created.projectId) {
      await prisma.project.deleteMany({ where: { id: created.projectId } });
    }
    if (created.clientId) {
      await prisma.client.deleteMany({ where: { id: created.clientId } });
    }
    if (created.paymentMethodId) {
      await prisma.paymentMethod.deleteMany({
        where: { id: created.paymentMethodId },
      });
    }
    await prisma.$disconnect();
  });

  it("rejects unauthenticated core routes", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });

  it("creates and lists clients", async () => {
    const create = await agent.post("/api/clients").send({
      name: `Client ${suffix}`,
      email: `client-${suffix}@example.com`,
      company: "Test Co",
      isActive: true,
    });
    expect(create.status).toBe(201);
    created.clientId = create.body.data.id;

    const list = await agent.get("/api/clients").query({ search: suffix });
    expect(list.status).toBe(200);
    expect(list.body.data.some((row: { id: string }) => row.id === created.clientId)).toBe(
      true,
    );

    const detail = await agent.get(`/api/clients/${created.clientId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.name).toContain(suffix);
  });

  it("creates projects with agreed price independent of payments", async () => {
    const create = await agent.post("/api/projects").send({
      clientId: created.clientId,
      name: `Project ${suffix}`,
      description: "Phase 5 project",
      agreedPrice: "25000.00",
      currencyCode: "ETB",
      status: "IN_PROGRESS",
      startDate: "2026-01-01",
    });
    expect(create.status).toBe(201);
    expect(Number(create.body.data.agreedPrice)).toBe(25000);
    created.projectId = create.body.data.id;

    const patch = await agent.patch(`/api/projects/${created.projectId}`).send({
      status: "COMPLETED",
      agreedPrice: "27500.50",
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe("COMPLETED");
    expect(Number(patch.body.data.agreedPrice)).toBe(27500.5);
  });

  it("manages payment methods and categories", async () => {
    const method = await agent.post("/api/payment-methods").send({
      name: `Method ${suffix}`,
      type: "MOBILE_MONEY",
      isActive: true,
    });
    expect(method.status).toBe(201);
    created.paymentMethodId = method.body.data.id;

    const subCat = await agent.post("/api/subscription-categories").send({
      name: `SubCat ${suffix}`,
      slug: `subcat-${suffix}`,
      description: "Test category",
    });
    expect(subCat.status).toBe(201);
    created.subscriptionCategoryId = subCat.body.data.id;

    const expCat = await agent.post("/api/expense-categories").send({
      name: `ExpCat ${suffix}`,
      slug: `expcat-${suffix}`,
    });
    expect(expCat.status).toBe(201);
    created.expenseCategoryId = expCat.body.data.id;
  });

  it("creates expenses outside the renewal flow", async () => {
    const create = await agent.post("/api/expenses").send({
      categoryId: created.expenseCategoryId,
      amount: "150.00",
      currencyCode: "ETB",
      description: `Office supplies ${suffix}`,
      incurredAt: "2026-03-01",
      paymentMethodId: created.paymentMethodId,
    });
    expect(create.status).toBe(201);
    expect(create.body.data.isSubscriptionRenewal).toBe(false);
    created.expenseId = create.body.data.id;
  });

  it("blocks manual subscription_renewal category expenses", async () => {
    const renewalCategory = await prisma.expenseCategory.findUnique({
      where: { slug: "subscription_renewal" },
    });
    expect(renewalCategory).toBeTruthy();

    const res = await agent.post("/api/expenses").send({
      categoryId: renewalCategory!.id,
      amount: "10.00",
      currencyCode: "ETB",
      description: "Should fail",
      incurredAt: "2026-03-01",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("creates subscriptions and confirms renewals atomically", async () => {
    const create = await agent.post("/api/subscriptions").send({
      name: `Subscription ${suffix}`,
      vendor: "Vendor Co",
      categoryId: created.subscriptionCategoryId,
      amount: "99.00",
      currencyCode: "ETB",
      billingPeriod: "YEARLY",
      startDate: "2025-01-01",
      expirationDate: "2026-01-01",
      status: "ACTIVE",
    });
    expect(create.status).toBe(201);
    created.subscriptionId = create.body.data.id;

    await prisma.scheduledEvent.create({
      data: {
        type: "SUBSCRIPTION_REMINDER",
        entityType: "Subscription",
        entityId: created.subscriptionId,
        status: "PENDING",
        scheduledFor: new Date("2025-12-01T00:00:00.000Z"),
        payload: { test: true },
      },
    });

    const renew = await agent
      .post(`/api/subscriptions/${created.subscriptionId}/renewals`)
      .send({
        renewedAt: "2026-01-02",
        newExpirationDate: "2027-01-01",
        amount: "120.00",
        currencyCode: "ETB",
        paymentMethodId: created.paymentMethodId,
        notes: "Confirmed payment",
      });
    expect(renew.status).toBe(201);
    expect(Number(renew.body.data.amount)).toBe(120);
    expect(renew.body.data.expenseId).toBeTruthy();
    created.renewalExpenseId = renew.body.data.expenseId;

    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { id: created.subscriptionId },
    });
    expect(subscription.expirationDate.toISOString().startsWith("2027-01-01")).toBe(
      true,
    );
    expect(Number(subscription.amount.toString())).toBe(120);
    expect(subscription.status).toBe("ACTIVE");

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: created.renewalExpenseId },
    });
    expect(expense.isSubscriptionRenewal).toBe(true);
    expect(Number(expense.amount.toString())).toBe(120);

    // Phase 7: obsolete reminders are cancelled; new ones are scheduled for the
    // renewed expiration (not "all cancelled").
    const reminders = await prisma.scheduledEvent.findMany({
      where: {
        entityId: created.subscriptionId,
        type: "SUBSCRIPTION_REMINDER",
      },
    });
    const openReminders = reminders.filter((event) =>
      ["PENDING", "APPROVED", "AWAITING_APPROVAL"].includes(event.status),
    );
    expect(openReminders.length).toBeGreaterThan(0);
    expect(
      openReminders.every((event) => {
        const payload = (event.payload ?? {}) as { expirationDate?: string };
        return payload.expirationDate === "2027-01-01";
      }),
    ).toBe(true);
    expect(
      reminders
        .filter((event) => {
          const payload = (event.payload ?? {}) as { expirationDate?: string };
          return (
            payload.expirationDate === "2026-01-01" ||
            (payload as { test?: boolean }).test === true
          );
        })
        .every((event) => event.status === "CANCELLED"),
    ).toBe(true);

    const detail = await agent.get(`/api/subscriptions/${created.subscriptionId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.renewals.length).toBeGreaterThanOrEqual(1);
  });

  it("validates required fields", async () => {
    const res = await agent.post("/api/clients").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("rejects mismatched amountEtb on ETB renewals", async () => {
    const create = await agent.post("/api/subscriptions").send({
      name: `ETB Renew Guard ${suffix}`,
      vendor: "Local",
      categoryId: created.subscriptionCategoryId,
      amount: "50.00",
      currencyCode: "ETB",
      billingPeriod: "YEARLY",
      startDate: "2025-01-01",
      expirationDate: "2026-06-01",
      status: "ACTIVE",
    });
    expect(create.status).toBe(201);
    const subscriptionId = create.body.data.id as string;

    const mismatched = await agent
      .post(`/api/subscriptions/${subscriptionId}/renewals`)
      .send({
        renewedAt: "2026-06-02",
        newExpirationDate: "2027-06-01",
        amount: "100.00",
        currencyCode: "ETB",
        amountEtb: "999.00",
        paymentMethodId: created.paymentMethodId,
      });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error).toBe("validation_error");

    const matching = await agent
      .post(`/api/subscriptions/${subscriptionId}/renewals`)
      .send({
        renewedAt: "2026-06-02",
        newExpirationDate: "2027-06-01",
        amount: "100.00",
        currencyCode: "ETB",
        amountEtb: "100.00",
        paymentMethodId: created.paymentMethodId,
      });
    expect(matching.status).toBe(201);
    expect(Number(matching.body.data.amount)).toBe(100);

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: matching.body.data.expenseId },
    });
    expect(Number(expense.amountEtb.toString())).toBe(100);
  });

  it("rejects non-ETB renewals without amountEtb or exchangeRateId", async () => {
    const create = await agent.post("/api/subscriptions").send({
      name: `USD Subscription ${suffix}`,
      vendor: "GitHub",
      categoryId: created.subscriptionCategoryId,
      amount: "10.00",
      currencyCode: "USD",
      billingPeriod: "YEARLY",
      startDate: "2025-01-01",
      expirationDate: "2026-01-01",
      status: "ACTIVE",
    });
    expect(create.status).toBe(201);
    created.usdSubscriptionId = create.body.data.id;

    const missingFx = await agent
      .post(`/api/subscriptions/${created.usdSubscriptionId}/renewals`)
      .send({
        renewedAt: "2026-01-02",
        newExpirationDate: "2027-01-01",
        amount: "12.00",
        currencyCode: "USD",
      });
    expect(missingFx.status).toBe(400);
    expect(missingFx.body.error).toBe("validation_error");
  });

  it("confirms non-ETB renewals with amountEtb or exchangeRateId", async () => {
    expect(created.usdSubscriptionId).toBeTruthy();

    const withAmountEtb = await agent
      .post(`/api/subscriptions/${created.usdSubscriptionId}/renewals`)
      .send({
        renewedAt: "2026-01-02",
        newExpirationDate: "2027-01-01",
        amount: "12.00",
        currencyCode: "USD",
        amountEtb: "678.00",
        paymentMethodId: created.paymentMethodId,
      });
    expect(withAmountEtb.status).toBe(201);
    created.usdRenewalExpenseId = withAmountEtb.body.data.expenseId;

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: created.usdRenewalExpenseId },
    });
    expect(expense.isSubscriptionRenewal).toBe(true);
    expect(Number(expense.amountEtb.toString())).toBe(678);

    const rate = await prisma.exchangeRate.findFirst({
      where: { fromCurrencyCode: "USD", toCurrencyCode: "ETB" },
      orderBy: { effectiveAt: "desc" },
    });
    expect(rate).toBeTruthy();

    const rates = await agent.get("/api/exchange-rates").query({
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
    });
    expect(rates.status).toBe(200);
    expect(rates.body.data.length).toBeGreaterThan(0);

    const usdAgain = await agent.post("/api/subscriptions").send({
      name: `USD Rate Renew ${suffix}`,
      amount: "5.00",
      currencyCode: "USD",
      billingPeriod: "YEARLY",
      startDate: "2025-06-01",
      expirationDate: "2026-06-01",
      status: "ACTIVE",
    });
    expect(usdAgain.status).toBe(201);
    const rateSubId = usdAgain.body.data.id;

    const withRate = await agent
      .post(`/api/subscriptions/${rateSubId}/renewals`)
      .send({
        renewedAt: "2026-06-02",
        newExpirationDate: "2027-06-01",
        amount: "5.00",
        currencyCode: "USD",
        exchangeRateId: rate!.id,
      });
    expect(withRate.status).toBe(201);

    await cleanupSubscription(rateSubId);
  });

  it("returns 404 for renewing a missing subscription", async () => {
    const missingId = "00000000-0000-4000-8000-000000000099";
    const res = await agent
      .post(`/api/subscriptions/${missingId}/renewals`)
      .send({
        newExpirationDate: "2027-01-01",
        amount: "10.00",
        currencyCode: "ETB",
      });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("returns payment method and category detail by id", async () => {
    const method = await agent.get(
      `/api/payment-methods/${created.paymentMethodId}`,
    );
    expect(method.status).toBe(200);
    expect(method.body.data.id).toBe(created.paymentMethodId);

    const subCat = await agent.get(
      `/api/subscription-categories/${created.subscriptionCategoryId}`,
    );
    expect(subCat.status).toBe(200);
    expect(subCat.body.data.id).toBe(created.subscriptionCategoryId);

    const expCat = await agent.get(
      `/api/expense-categories/${created.expenseCategoryId}`,
    );
    expect(expCat.status).toBe(200);
    expect(expCat.body.data.id).toBe(created.expenseCategoryId);
  });
});
