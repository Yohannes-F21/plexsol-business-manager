import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const password =
  process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!";
const login = await fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@plexsol.com", password }),
});
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .join("; ");
const dash = await fetch("http://localhost:4000/api/dashboard?period=2026-11", {
  headers: { cookie },
});
const report = await fetch(
  "http://localhost:4000/api/reports?preset=month&month=2026-11",
  { headers: { cookie } },
);
const dashBody = await dash.json();
const reportBody = await report.json();
const incomeKpi = (dashBody.kpis ?? []).find((k) => k.id === "total_income");
const expenseKpi = (dashBody.kpis ?? []).find((k) => k.id === "total_expenses");
const netKpi = (dashBody.kpis ?? []).find((k) => k.id === "net_cash_flow");
const maintKpi = (dashBody.kpis ?? []).find(
  (k) => k.id === "recurring_maintenance",
);
console.log(
  JSON.stringify(
    {
      dashStatus: dash.status,
      dashError: dashBody.error ? dashBody : undefined,
      reportStatus: report.status,
      reportTotals: reportBody.data?.totals,
      dashKpis: {
        income: incomeKpi?.value?.amount,
        expenses: expenseKpi?.value?.amount,
        net: netKpi?.value?.amount,
        maintenance: maintKpi?.value?.amount,
      },
      match:
        incomeKpi?.value?.amount === reportBody.data?.totals?.incomeEtb &&
        expenseKpi?.value?.amount === reportBody.data?.totals?.expensesEtb &&
        netKpi?.value?.amount === reportBody.data?.totals?.netCashFlowEtb &&
        maintKpi?.value?.amount ===
          reportBody.data?.totals?.recurringMaintenanceMonthlyEtb,
      renewalsSample: (dashBody.upcomingRenewals ?? []).slice(0, 3),
    },
    null,
    2,
  ),
);
