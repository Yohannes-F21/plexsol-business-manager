import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@plexsol/database";
import { createApp } from "../src/app.js";
import { loadApiEnv } from "../src/env.js";
import "./setup-env.js";

const env = loadApiEnv();
const app = createApp(env);
const agent = request.agent(app);
const suffix = `rn${Date.now()}`;

describe("reports, dashboard, notifications API", () => {
  beforeAll(async () => {
    const login = await agent.post("/api/auth/login").send({
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@plexsol.com",
      password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!",
    });
    if (login.status !== 200) {
      // Ensure seed admin exists for CI/dev
      throw new Error(
        `Admin login failed (${login.status}). Run pnpm db:seed before API tests.`,
      );
    }
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { title: { contains: suffix } },
    });
    await prisma.$disconnect();
  });

  it("requires auth for reports and dashboard", async () => {
    const bare = request(app);
    expect((await bare.get("/api/reports")).status).toBe(401);
    expect((await bare.get("/api/dashboard")).status).toBe(401);
  });

  it("returns a monthly ETB report", async () => {
    const res = await agent.get("/api/reports").query({
      preset: "month",
      month: "2026-11",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.reportingCurrency).toBe("ETB");
    expect(res.body.data.totals).toHaveProperty("incomeEtb");
    expect(res.body.data.totals).toHaveProperty("netCashFlowEtb");
    expect(Array.isArray(res.body.data.projectSummaries)).toBe(true);
  });

  it("returns a live dashboard snapshot", async () => {
    const res = await agent.get("/api/dashboard").query({ period: "2026-11" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("api");
    expect(res.body.reportingCurrency).toBe("ETB");
    expect(res.body.kpis.length).toBeGreaterThanOrEqual(4);
  });

  it("exposes readiness health with database check", async () => {
    const live = await request(app).get("/health");
    expect(live.status).toBe(200);
    expect(live.body.status).toBe("ok");

    const ready = await request(app).get("/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.checks.database).toBe("up");
  });

  it("lists notifications for the authenticated user", async () => {
    await prisma.notification.create({
      data: {
        type: "INFO",
        title: `Phase8 ${suffix}`,
        body: "Test notification",
      },
    });

    const res = await agent.get("/api/notifications");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty("unreadCount");
  });

  it("lists email jobs without allowing unauthenticated access", async () => {
    expect((await request(app).get("/api/email-jobs")).status).toBe(401);
    const res = await agent.get("/api/email-jobs").query({ pageSize: 5 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("approves and rejects overdue email drafts over HTTP", async () => {
    const draft = await prisma.emailJob.create({
      data: {
        toEmail: `approve-${suffix}@example.com`,
        subject: `Approve draft ${suffix}`,
        bodyHtml: "<p>draft</p>",
        bodyText: "draft",
        status: "AWAITING_APPROVAL",
        maxAttempts: 3,
        idempotencyKey: `http-approve:${suffix}`,
      },
    });

    const approve = await agent.post(`/api/email-jobs/${draft.id}/approve`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("APPROVED");

    // Reset to awaiting so reject path can be exercised on a fresh draft.
    const draft2 = await prisma.emailJob.create({
      data: {
        toEmail: `reject-${suffix}@example.com`,
        subject: `Reject draft ${suffix}`,
        bodyHtml: "<p>draft</p>",
        bodyText: "draft",
        status: "AWAITING_APPROVAL",
        maxAttempts: 3,
        idempotencyKey: `http-reject:${suffix}`,
      },
    });
    const reject = await agent
      .post(`/api/email-jobs/${draft2.id}/reject`)
      .send({ reason: "Not needed" });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe("CANCELLED");

    await prisma.emailJob.deleteMany({
      where: { id: { in: [draft.id, draft2.id] } },
    });
  });

  it("reads and updates ops settings", async () => {
    const list = await agent.get("/api/settings");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);

    const put = await agent.put("/api/settings/payment_instructions").send({
      key: "payment_instructions",
      value: `Pay via bank transfer (${suffix})`,
    });
    expect(put.status).toBe(200);
    expect(put.body.data.value).toContain(suffix);
  });

  it("creates historical exchange rates without overwriting", async () => {
    expect((await request(app).post("/api/exchange-rates").send({})).status).toBe(
      401,
    );

    const effectiveAt = `2026-08-${String((Date.now() % 27) + 1).padStart(2, "0")}`;
    const create = await agent.post("/api/exchange-rates").send({
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "57.25000000",
      effectiveAt,
      source: `audit-${suffix}`,
    });
    expect(create.status).toBe(201);
    expect(Number(create.body.data.rate)).toBeCloseTo(57.25);

    const duplicate = await agent.post("/api/exchange-rates").send({
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "58.00000000",
      effectiveAt,
      source: `audit-dup-${suffix}`,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("conflict");

    await prisma.exchangeRate.delete({ where: { id: create.body.data.id } });
  });
});
