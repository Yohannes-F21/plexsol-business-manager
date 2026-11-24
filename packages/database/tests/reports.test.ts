import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PrismaClient,
  buildFinancialReport,
  createClientPayment,
  money,
  resolveReportPeriod,
} from "../src/index.js";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
loadEnv({ path: rootEnv });

describe("report period resolution", () => {
  it("resolves monthly, yearly, and custom windows", () => {
    const month = resolveReportPeriod({
      preset: "month",
      month: "2026-11",
    });
    expect(month.from.toISOString().startsWith("2026-11-01")).toBe(true);
    expect(month.to.toISOString().startsWith("2026-11-30")).toBe(true);

    const year = resolveReportPeriod({ preset: "year", year: "2026" });
    expect(year.from.toISOString().startsWith("2026-01-01")).toBe(true);
    expect(year.to.toISOString().startsWith("2026-12-31")).toBe(true);

    const custom = resolveReportPeriod({
      preset: "custom",
      from: "2026-02-01",
      to: "2026-02-15",
    });
    expect(custom.label).toContain("2026-02-01");
  });

  it("rejects invalid custom ranges", () => {
    expect(() =>
      resolveReportPeriod({
        preset: "custom",
        from: "2026-03-01",
        to: "2026-02-01",
      }),
    ).toThrow(/on or after/);
  });
});

describe("financial report ETB snapshots", () => {
  const prisma = new PrismaClient();
  const suffix = `r${Date.now()}`;
  let clientId = "";
  let paymentId = "";

  beforeAll(async () => {
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

    const client = await prisma.client.create({
      data: { name: `Report Client ${suffix}` },
    });
    clientId = client.id;

    // Snapshot amountEtb directly — reports must use stored historical ETB, not re-convert.
    const payment = await createClientPayment(prisma, {
      clientId,
      amount: "10.00",
      currencyCode: "USD",
      amountEtb: "500.00",
      paidAt: new Date("2026-11-10T12:00:00.000Z"),
    });
    paymentId = payment.id;
    expect(money(payment.amountEtb).toFixed(2)).toBe("500.00");
  });

  afterAll(async () => {
    if (paymentId) {
      await prisma.clientPayment.deleteMany({ where: { id: paymentId } });
    }
    if (clientId) {
      await prisma.client.deleteMany({ where: { id: clientId } });
    }
    await prisma.$disconnect();
  });

  it("includes historical amountEtb in monthly income", async () => {
    const report = await buildFinancialReport(prisma, {
      preset: "month",
      month: "2026-11",
      asOf: new Date("2026-11-23T00:00:00.000Z"),
    });

    expect(money(report.totals.incomeEtb).gte(money("500"))).toBe(true);
    expect(report.reportingCurrency).toBe("ETB");
    expect(report.monthlySeries.length).toBeGreaterThan(0);
  });
});
