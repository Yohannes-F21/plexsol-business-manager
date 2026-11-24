import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PrismaClient,
  addMonthsClamped,
  generateBillingCycles,
  utcDateOnly,
  utcParts,
} from "../src/index.js";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
loadEnv({ path: rootEnv });

const prisma = new PrismaClient();
const suffix = `bc${Date.now()}`;

describe("billing cycle generation", () => {
  let clientId = "";
  let projectId = "";
  let agreementId = "";
  let monthEndAgreementId = "";

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL required");
    }
    await prisma.currency.upsert({
      where: { code: "ETB" },
      update: {},
      create: {
        code: "ETB",
        name: "Ethiopian Birr",
        symbol: "Br",
        isReporting: true,
      },
    });

    const client = await prisma.client.create({
      data: { name: `BC Client ${suffix}` },
    });
    clientId = client.id;

    const project = await prisma.project.create({
      data: {
        clientId,
        name: `BC Project ${suffix}`,
        agreedPrice: "5000.0000",
        currencyCode: "ETB",
      },
    });
    projectId = project.id;

    const agreement = await prisma.maintenanceAgreement.create({
      data: {
        projectId,
        billingFrequency: "MONTHLY",
        amount: "1000.0000",
        currencyCode: "ETB",
        startDate: utcDateOnly(2026, 1, 1),
        status: "ACTIVE",
      },
    });
    agreementId = agreement.id;

    const project2 = await prisma.project.create({
      data: {
        clientId,
        name: `BC MonthEnd ${suffix}`,
        agreedPrice: "3000.0000",
        currencyCode: "ETB",
      },
    });
    const monthEnd = await prisma.maintenanceAgreement.create({
      data: {
        projectId: project2.id,
        billingFrequency: "MONTHLY",
        amount: "500.0000",
        currencyCode: "ETB",
        startDate: utcDateOnly(2026, 1, 31),
        status: "ACTIVE",
      },
    });
    monthEndAgreementId = monthEnd.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.maintenanceBillingCycle.deleteMany({
      where: {
        maintenanceAgreementId: { in: [agreementId, monthEndAgreementId] },
      },
    });
    await prisma.maintenanceAgreement.deleteMany({
      where: { id: { in: [agreementId, monthEndAgreementId] } },
    });
    await prisma.project.deleteMany({ where: { clientId } });
    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.$disconnect();
  });

  it("clamps month-end activation days across short months", () => {
    const jan31 = utcDateOnly(2026, 1, 31);
    const feb = addMonthsClamped(jan31, 1, 31);
    const mar = addMonthsClamped(jan31, 2, 31);
    const apr = addMonthsClamped(jan31, 3, 31);

    expect(utcParts(feb)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(utcParts(mar)).toEqual({ year: 2026, month: 3, day: 31 });
    expect(utcParts(apr)).toEqual({ year: 2026, month: 4, day: 30 });

    const jan30 = utcDateOnly(2026, 1, 30);
    expect(utcParts(addMonthsClamped(jan30, 1, 30)).day).toBe(28);
    expect(utcParts(addMonthsClamped(jan30, 2, 30)).day).toBe(30);

    const jan29 = utcDateOnly(2026, 1, 29);
    expect(utcParts(addMonthsClamped(jan29, 1, 29)).day).toBe(28);
    expect(utcParts(addMonthsClamped(jan29, 2, 29)).day).toBe(29);
  });

  it("generates cycles idempotently", async () => {
    const first = await generateBillingCycles(prisma, {
      agreementId,
      asOf: utcDateOnly(2026, 3, 15),
    });
    expect(first.created.length).toBe(3); // Jan, Feb, Mar
    expect(first.skipped).toBe(0);

    const second = await generateBillingCycles(prisma, {
      agreementId,
      asOf: utcDateOnly(2026, 3, 15),
    });
    expect(second.created.length).toBe(0);
    expect(second.skipped).toBe(3);

    const third = await generateBillingCycles(prisma, {
      agreementId,
      asOf: utcDateOnly(2026, 4, 1),
    });
    expect(third.created.length).toBe(1);
    expect(third.skipped).toBe(3);
  });

  it("generates month-end periods with clamped starts and due dates", async () => {
    const result = await generateBillingCycles(prisma, {
      agreementId: monthEndAgreementId,
      asOf: utcDateOnly(2026, 4, 30),
    });
    expect(result.created.length).toBe(4);

    const cycles = await prisma.maintenanceBillingCycle.findMany({
      where: { maintenanceAgreementId: monthEndAgreementId },
      orderBy: { periodStart: "asc" },
    });

    expect(utcParts(cycles[0]!.periodStart)).toEqual({
      year: 2026,
      month: 1,
      day: 31,
    });
    expect(utcParts(cycles[1]!.periodStart)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(utcParts(cycles[2]!.periodStart)).toEqual({
      year: 2026,
      month: 3,
      day: 31,
    });
    expect(utcParts(cycles[3]!.periodStart)).toEqual({
      year: 2026,
      month: 4,
      day: 30,
    });

    // Due date is next period start
    expect(utcParts(cycles[0]!.dueDate)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });
});
