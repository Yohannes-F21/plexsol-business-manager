import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, utcDateOnly } from "@plexsol/database";
import { apiEnvSchema, type ApiEnv } from "@plexsol/shared";
import { createApp } from "../src/app.js";

const suffix = `pay${Date.now()}`;
const adminEmail = "admin@plexsol.com";
const adminPassword =
  process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!";

function loadTestEnv(): ApiEnv {
  const parsed = apiEnvSchema.safeParse({
    ...process.env,
    NODE_ENV: "test",
  });
  if (!parsed.success) {
    throw new Error("Invalid test env");
  }
  return parsed.data;
}

describe("payments & maintenance billing API", () => {
  const env = loadTestEnv();
  const app = createApp(env);
  const agent = request.agent(app);

  const ids = {
    clientId: "",
    projectId: "",
    usdProjectId: "",
    agreementId: "",
    cycleIds: [] as string[],
    paymentId: "",
    usdPaymentId: "",
    partialPaymentId: "",
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    const login = await agent.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
    });
    expect(login.status).toBe(200);

    const client = await agent.post("/api/clients").send({
      name: `Pay Client ${suffix}`,
      isActive: true,
    });
    expect(client.status).toBe(201);
    ids.clientId = client.body.data.id;

    const project = await agent.post("/api/projects").send({
      clientId: ids.clientId,
      name: `Dev Project ${suffix}`,
      agreedPrice: "10000.00",
      currencyCode: "ETB",
      status: "IN_PROGRESS",
    });
    expect(project.status).toBe(201);
    ids.projectId = project.body.data.id;

    const usdProject = await agent.post("/api/projects").send({
      clientId: ids.clientId,
      name: `USD Project ${suffix}`,
      agreedPrice: "500.00",
      currencyCode: "USD",
      status: "IN_PROGRESS",
    });
    expect(usdProject.status).toBe(201);
    ids.usdProjectId = usdProject.body.data.id;
  }, 90_000);

  afterAll(async () => {
    const payments = [ids.paymentId, ids.usdPaymentId, ids.partialPaymentId].filter(
      Boolean,
    );
    if (payments.length) {
      await prisma.paymentAllocation.deleteMany({
        where: { clientPaymentId: { in: payments } },
      });
      await prisma.clientPayment.deleteMany({
        where: { id: { in: payments } },
      });
    }
    if (ids.agreementId) {
      await prisma.maintenanceBillingCycle.deleteMany({
        where: { maintenanceAgreementId: ids.agreementId },
      });
      await prisma.maintenanceAgreement.deleteMany({
        where: { id: ids.agreementId },
      });
    }
    if (ids.projectId || ids.usdProjectId) {
      await prisma.project.deleteMany({
        where: { id: { in: [ids.projectId, ids.usdProjectId].filter(Boolean) } },
      });
    }
    if (ids.clientId) {
      await prisma.client.deleteMany({ where: { id: ids.clientId } });
    }
    await prisma.$disconnect();
  });

  it("creates maintenance agreement with explicit activation and generates cycles", async () => {
    const create = await agent.post("/api/maintenance/agreements").send({
      projectId: ids.projectId,
      billingFrequency: "MONTHLY",
      amount: "1000.00",
      currencyCode: "ETB",
      startDate: "2026-01-01",
      status: "ACTIVE",
      generateCycles: false,
    });
    expect(create.status).toBe(201);
    ids.agreementId = create.body.data.id;

    const generated = await agent
      .post(`/api/maintenance/agreements/${ids.agreementId}/generate-cycles`)
      .send({ asOf: "2026-03-01" });
    expect(generated.status).toBe(201);
    expect(generated.body.data.createdCount).toBe(3);

    const again = await agent
      .post(`/api/maintenance/agreements/${ids.agreementId}/generate-cycles`)
      .send({ asOf: "2026-03-01" });
    expect(again.status).toBe(201);
    expect(again.body.data.createdCount).toBe(0);
    expect(again.body.data.skipped).toBe(3);

    const cycles = await agent.get("/api/maintenance/cycles").query({
      maintenanceAgreementId: ids.agreementId,
      pageSize: 50,
    });
    expect(cycles.status).toBe(200);
    ids.cycleIds = cycles.body.data.map((cycle: { id: string }) => cycle.id);
    expect(ids.cycleIds.length).toBeGreaterThanOrEqual(3);
  });

  it("records a receipt and allocates across project + multiple cycles (partial)", async () => {
    const payment = await agent.post("/api/payments").send({
      clientId: ids.clientId,
      amount: "2500.00",
      currencyCode: "ETB",
      paidAt: "2026-02-15",
      reference: `RCPT-${suffix}`,
    });
    expect(payment.status).toBe(201);
    ids.paymentId = payment.body.data.id;
    expect(Number(payment.body.data.amountAllocated)).toBe(0);

    const batch = await agent
      .post(`/api/payments/${ids.paymentId}/allocations/batch`)
      .send({
        allocations: [
          { amount: "1500.00", projectId: ids.projectId },
          { amount: "400.00", billingCycleId: ids.cycleIds[0] },
          { amount: "300.00", billingCycleId: ids.cycleIds[1] },
        ],
      });
    expect(batch.status).toBe(201);
    expect(batch.body.data).toHaveLength(3);

    const detail = await agent.get(`/api/payments/${ids.paymentId}`);
    expect(detail.status).toBe(200);
    expect(Number(detail.body.data.amountAllocated)).toBe(2200);
    expect(detail.body.data.allocations).toHaveLength(3);

    const balances = await agent.get(`/api/balances/clients/${ids.clientId}`);
    expect(balances.status).toBe(200);
    const projectBalance = balances.body.data.projects.find(
      (row: { projectId: string }) => row.projectId === ids.projectId,
    );
    expect(Number(projectBalance.outstanding)).toBe(8500);

    const unapplied = balances.body.data.payments.find(
      (row: { paymentId: string }) => row.paymentId === ids.paymentId,
    );
    expect(Number(unapplied.unapplied)).toBe(300);
  });

  it("supports cross-currency payment with ETB snapshot and matching obligation currency", async () => {
    const rate = await prisma.exchangeRate.findFirst({
      where: { fromCurrencyCode: "USD", toCurrencyCode: "ETB" },
      orderBy: { effectiveAt: "desc" },
    });
    expect(rate).toBeTruthy();

    const payment = await agent.post("/api/payments").send({
      clientId: ids.clientId,
      amount: "100.00",
      currencyCode: "USD",
      exchangeRateId: rate!.id,
      paidAt: "2026-02-20",
    });
    expect(payment.status).toBe(201);
    ids.usdPaymentId = payment.body.data.id;
    expect(Number(payment.body.data.amountEtb)).toBeGreaterThan(0);

    const allocate = await agent
      .post(`/api/payments/${ids.usdPaymentId}/allocations`)
      .send({
        amount: "40.00",
        projectId: ids.usdProjectId,
      });
    expect(allocate.status).toBe(201);

    const mismatch = await agent
      .post(`/api/payments/${ids.usdPaymentId}/allocations`)
      .send({
        amount: "10.00",
        projectId: ids.projectId,
      });
    expect(mismatch.status).toBe(400);
  });

  it("prevents concurrent allocations from overpaying an obligation", async () => {
    const payment = await agent.post("/api/payments").send({
      clientId: ids.clientId,
      amount: "1000.00",
      currencyCode: "ETB",
      paidAt: "2026-03-01",
    });
    expect(payment.status).toBe(201);
    ids.partialPaymentId = payment.body.data.id;

    const cycleId = ids.cycleIds[2];
    expect(cycleId).toBeTruthy();

    const cycleBefore = await prisma.maintenanceBillingCycle.findUniqueOrThrow({
      where: { id: cycleId },
    });
    const remaining =
      Number(cycleBefore.amount) - Number(cycleBefore.amountAllocated);
    expect(remaining).toBeGreaterThan(0);

    const [first, second] = await Promise.all([
      agent.post(`/api/payments/${ids.partialPaymentId}/allocations`).send({
        amount: String(remaining),
        billingCycleId: cycleId,
      }),
      agent.post(`/api/payments/${ids.partialPaymentId}/allocations`).send({
        amount: String(remaining),
        billingCycleId: cycleId,
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toContain(201);
    expect(statuses.some((status) => status === 400 || status === 409)).toBe(
      true,
    );

    const cycleAfter = await prisma.maintenanceBillingCycle.findUniqueOrThrow({
      where: { id: cycleId },
    });
    expect(Number(cycleAfter.amountAllocated)).toBeLessThanOrEqual(
      Number(cycleAfter.amount),
    );
  });

  it("rejects mismatched amountEtb on ETB receipts", async () => {
    const mismatched = await agent.post("/api/payments").send({
      clientId: ids.clientId,
      amount: "100.00",
      currencyCode: "ETB",
      amountEtb: "999.00",
      paidAt: "2026-03-10",
    });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error).toBe("validation_error");

    const matching = await agent.post("/api/payments").send({
      clientId: ids.clientId,
      amount: "100.00",
      currencyCode: "ETB",
      amountEtb: "100.00",
      paidAt: "2026-03-10",
      reference: `ETB-OK-${suffix}`,
    });
    expect(matching.status).toBe(201);
    expect(Number(matching.body.data.amount)).toBe(100);
    expect(Number(matching.body.data.amountEtb)).toBe(100);

    await prisma.clientPayment.delete({
      where: { id: matching.body.data.id },
    });
  });

  it("does not auto-create agreements from project delivery", async () => {
    const project = await agent.post("/api/projects").send({
      clientId: ids.clientId,
      name: `No Auto Maint ${suffix}`,
      agreedPrice: "1000.00",
      currencyCode: "ETB",
      status: "COMPLETED",
      endDate: utcDateOnly(2026, 2, 1).toISOString().slice(0, 10),
    });
    expect(project.status).toBe(201);

    const detail = await agent.get(`/api/projects/${project.body.data.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.maintenanceAgreement).toBeFalsy();

    await prisma.project.delete({ where: { id: project.body.data.id } });
  });
});
