import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  allocatePaymentBatch,
  createClientPayment,
} from "../../packages/database/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq);
  let value = trimmed.slice(eq + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (process.env[key] === undefined) process.env[key] = value;
}

const prisma = new PrismaClient();
const tag = `e2e${Date.now()}`;
function moneyEq(a, b) {
  return Number(a) === Number(b);
}

async function cleanupClient(clientId) {
  const projects = await prisma.project.findMany({ where: { clientId }, select: { id: true } });
  const projectIds = projects.map((p) => p.id);
  const payments = await prisma.clientPayment.findMany({
    where: { clientId },
    select: { id: true },
  });
  const paymentIds = payments.map((p) => p.id);
  await prisma.paymentAllocation.deleteMany({
    where: {
      OR: [{ clientPaymentId: { in: paymentIds } }, { projectId: { in: projectIds } }],
    },
  });
  await prisma.clientPayment.deleteMany({ where: { clientId } });
  await prisma.project.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
}

async function scenario7() {
  const ms = Date.now() % 1000;
  const rate1 = await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "50.00000000",
      effectiveAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, ms)),
      source: `qa-s7-${tag}`,
    },
  });
  const rate2 = await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "60.00000000",
      effectiveAt: new Date(Date.UTC(2026, 5, 1, 0, 0, 0, ms)),
      source: `qa-s7-${tag}`,
    },
  });
  const client = await prisma.client.create({
    data: {
      name: `QA S7 ${tag}`,
      email: `qa-s7-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const payment = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "10.00",
      currencyCode: "USD",
      exchangeRateId: rate1.id,
      paidAt: new Date("2026-02-01"),
      reference: `S7-${tag}`,
    });
    const after = await prisma.clientPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const ok = moneyEq(after.amountEtb, 500) && Boolean(rate2.id);
    console.log(
      JSON.stringify({
        id: "S7_historical_fx_snapshot",
        status: ok ? "PASS" : "FAIL",
        detail: { amountEtb: String(after.amountEtb), rate2: String(rate2.rate) },
      }),
    );
  } finally {
    await cleanupClient(client.id);
    await prisma.exchangeRate.deleteMany({ where: { source: `qa-s7-${tag}` } });
  }
}

async function scenario8() {
  const client = await prisma.client.create({
    data: {
      name: `QA S8 ${tag}`,
      email: `qa-s8-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S8 Project ${tag}`,
        agreedPrice: "1000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const payment = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "1000.00",
      currencyCode: "ETB",
    });
    const attempts = await Promise.allSettled([
      allocatePaymentBatch(prisma, {
        clientPaymentId: payment.id,
        allocations: [{ amount: "1000.00", target: { projectId: project.id } }],
      }),
      allocatePaymentBatch(prisma, {
        clientPaymentId: payment.id,
        allocations: [{ amount: "1000.00", target: { projectId: project.id } }],
      }),
    ]);
    const successes = attempts.filter((a) => a.status === "fulfilled").length;
    const failures = attempts.filter((a) => a.status === "rejected").length;
    const refreshed = await prisma.clientPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const allocSum = await prisma.paymentAllocation.aggregate({
      where: { clientPaymentId: payment.id },
      _sum: { amount: true },
    });
    const ok =
      successes === 1 &&
      failures === 1 &&
      moneyEq(refreshed.amountAllocated, 1000) &&
      moneyEq(allocSum._sum.amount, 1000);
    console.log(
      JSON.stringify({
        id: "S8_concurrency_rollback",
        status: ok ? "PASS" : "FAIL",
        detail: {
          successes,
          failures,
          amountAllocated: String(refreshed.amountAllocated),
          allocSum: String(allocSum._sum.amount),
        },
      }),
    );
  } finally {
    await cleanupClient(client.id);
  }
}

await scenario7();
await scenario8();
await prisma.$disconnect();
