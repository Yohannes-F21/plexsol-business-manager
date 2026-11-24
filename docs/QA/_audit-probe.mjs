/**
 * Read-only QA probe — temporary; safe to delete after audit.
 * Does not mutate production business data except isolated QA rows that are cleaned up.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, confirmSubscriptionRenewal } from "../../packages/database/dist/index.js";

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

const API = process.env.AUDIT_API_URL ?? "http://localhost:4000";
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@plexsol.com";
const password =
  process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!";

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, cookie: cookieFrom(res) || cookie, body: await json(res) };
}

const out = {};

const unauth = await api("/api/clients");
out.unauthClients = unauth.status;

const login = await api("/api/auth/login", {
  method: "POST",
  body: { email, password },
});
out.login = login.status;
const cookie = login.cookie;
if (login.status !== 200) {
  console.log(JSON.stringify({ out, loginBody: login.body }, null, 2));
  process.exit(1);
}

const dash = await api("/api/dashboard?period=2026-11", { cookie });
const report = await api("/api/reports?preset=month&month=2026-11", { cookie });
const dashTotals =
  dash.body?.data?.totals ??
  dash.body?.totals ??
  dash.body?.kpis ??
  null;
const reportTotals = report.body?.data?.totals ?? report.body?.totals ?? null;
out.dashboard = {
  status: dash.status,
  source: dash.body?.source,
  topKeys: dash.body ? Object.keys(dash.body) : [],
  totals: dashTotals,
};
out.report = {
  status: report.status,
  totals: reportTotals,
};
out.dashMatchesReport =
  dashTotals &&
  reportTotals &&
  String(dashTotals.incomeEtb ?? dashTotals.income) ===
    String(reportTotals.incomeEtb) &&
  String(dashTotals.expensesEtb ?? dashTotals.expenses) ===
    String(reportTotals.expensesEtb);

const fxPost = await api("/api/exchange-rates", {
  method: "POST",
  cookie,
  body: {
    fromCurrencyCode: "USD",
    toCurrencyCode: "ETB",
    rate: "55.00",
    effectiveAt: new Date().toISOString(),
  },
});
out.fxPostStatus = fxPost.status;
out.fxPostError = fxPost.body?.error ?? fxPost.body?.message;

const fxGet = await api("/api/exchange-rates?fromCurrencyCode=USD&pageSize=1", {
  cookie,
});
out.fxGet = { status: fxGet.status, total: fxGet.body?.meta?.total };

const settingsGet = await api("/api/settings", { cookie });
out.settingsRoute = settingsGet.status;

const worker = await fetch("http://localhost:4010/health").then(
  (r) => r.status,
  () => "DOWN",
);
out.workerHealth = worker;

// Renewal ETB amountEtb mismatch (isolated temp subscription)
const prisma = new PrismaClient();
const suffix = `qa${Date.now()}`;
try {
  const subCat = await prisma.subscriptionCategory.findFirst();
  const sub = await prisma.subscription.create({
    data: {
      name: `QA ETB mismatch ${suffix}`,
      vendor: "QA-AUDIT",
      amount: "100.00",
      currencyCode: "ETB",
      billingPeriod: "YEARLY",
      startDate: new Date("2026-01-01"),
      expirationDate: new Date("2026-12-01"),
      categoryId: subCat?.id,
      status: "ACTIVE",
    },
  });
  try {
    const renewal = await confirmSubscriptionRenewal(prisma, {
      subscriptionId: sub.id,
      newExpirationDate: new Date("2027-12-01"),
      amount: "100.00",
      currencyCode: "ETB",
      amountEtb: "999.00",
    });
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: renewal.expenseId },
    });
    out.renewalEtbMismatch = {
      result: "ACCEPTED_MISMATCH",
      amount: renewal.amount.toString(),
      amountEtb: expense.amountEtb.toString(),
    };
  } catch (e) {
    out.renewalEtbMismatch = {
      result: "REJECTED",
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await prisma.subscriptionRenewal.deleteMany({
      where: { subscriptionId: sub.id },
    });
    await prisma.expense.deleteMany({
      where: { description: { contains: sub.name } },
    });
    await prisma.emailJob.deleteMany({
      where: { scheduledEvent: { entityId: sub.id } },
    }).catch(() => {});
    await prisma.scheduledEvent.deleteMany({ where: { entityId: sub.id } });
    await prisma.subscription.delete({ where: { id: sub.id } }).catch(() => {});
  }
} finally {
  await prisma.$disconnect();
}

console.log(JSON.stringify(out, null, 2));
