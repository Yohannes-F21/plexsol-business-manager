import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { fetchReport, type ReportPreset } from "./api";

function currentMonthId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {formatMoney(value, "ETB")}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ReportsPage() {
  const [preset, setPreset] = useState<ReportPreset>("month");
  const [month, setMonth] = useState(currentMonthId());
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [from, setFrom] = useState(toDateInputValue(new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))));
  const [to, setTo] = useState(toDateInputValue(new Date()));

  const queryKey = useMemo(
    () => ({ preset, month, year, from, to }),
    [preset, month, year, from, to],
  );

  const reportQuery = useQuery({
    queryKey: ["reports", queryKey],
    queryFn: () =>
      fetchReport(
        preset === "month"
          ? { preset, month }
          : preset === "year"
            ? { preset, year }
            : { preset, from, to },
      ),
  });

  const report = reportQuery.data?.data;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Reports"
        description="ETB financial reporting using historical exchange-rate snapshots on receipts and expenses."
      />

      <section
        aria-label="Report period filters"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Period type</span>
          <Select
            value={preset}
            onChange={(event) => setPreset(event.target.value as ReportPreset)}
            aria-label="Period type"
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="custom">Custom range</option>
          </Select>
        </label>

        {preset === "month" ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Month</span>
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              aria-label="Report month"
            />
          </label>
        ) : null}

        {preset === "year" ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Year</span>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              aria-label="Report year"
            />
          </label>
        ) : null}

        {preset === "custom" ? (
          <>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">From</span>
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="Custom from date"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">To</span>
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="Custom to date"
              />
            </label>
          </>
        ) : null}
      </section>

      {reportQuery.isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Spinner />
          <span className="sr-only">Loading report</span>
        </div>
      ) : null}

      {reportQuery.isError ? (
        <EmptyState
          icon={<BarChart3 className="size-8" />}
          title="Unable to load report"
          description="Check your connection and try again."
          action={
            <Button type="button" onClick={() => void reportQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {report ? (
        <>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{report.period.label}</span>
            {" "}({formatDate(report.period.from)} – {formatDate(report.period.to)}) · reporting currency ETB
          </p>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Monthly / period income" value={report.totals.incomeEtb} />
            <StatCard label="Monthly / period expenses" value={report.totals.expensesEtb} />
            <StatCard label="Net cash flow" value={report.totals.netCashFlowEtb} />
            <StatCard
              label="Maintenance recurring"
              value={report.totals.recurringMaintenanceMonthlyEtb}
              hint="Monthly ETB equivalent"
            />
            <StatCard
              label="Outstanding clients"
              value={report.totals.outstandingClientsEtb}
              hint="Projects + billing cycles"
            />
          </div>

          <section className="rounded-xl border border-border bg-card p-4" aria-label="Cash flow chart">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Income, expenses & net cash flow
            </h2>
            {report.monthlySeries.length === 0 ? (
              <EmptyState
                title="No cash-flow points"
                description="No payments or expenses in this window."
                className="py-10"
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="incomeEtb" name="Income" fill="var(--color-primary, #0f766e)" />
                    <Bar dataKey="expensesEtb" name="Expenses" fill="var(--color-destructive, #b91c1c)" />
                    <Bar dataKey="netCashFlowEtb" name="Net" fill="var(--color-muted-foreground, #64748b)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="outstanding-heading">
            <h2 id="outstanding-heading" className="text-sm font-semibold text-foreground">
              Outstanding client balances
            </h2>
            {!report.outstandingBalances.length ? (
              <EmptyState
                title="No outstanding balances"
                description="All tracked projects and cycles are settled."
                className="py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead className="text-right">Billing</TableHead>
                    <TableHead className="text-right">Total (ETB)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.outstandingBalances.map((row) => (
                    <TableRow key={row.clientId}>
                      <TableCell className="font-medium">{row.clientName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.projectOutstandingEtb)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.billingOutstandingEtb)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(row.totalOutstandingEtb)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="renewals-heading">
            <h2 id="renewals-heading" className="text-sm font-semibold text-foreground">
              Subscription renewal forecasts (90 days)
            </h2>
            {!report.renewalForecasts.length ? (
              <EmptyState
                title="No renewals in forecast window"
                description="No active subscriptions expire in the next 90 days from period end."
                className="py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead className="text-right">ETB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.renewalForecasts.map((row) => (
                    <TableRow key={row.subscriptionId}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.vendor ?? row.billingPeriod}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(row.expirationDate)}</TableCell>
                      <TableCell>{row.daysRemaining}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.amountEtb)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="text-sm font-semibold text-foreground">
              Project financial summaries
            </h2>
            {!report.projectSummaries.length ? (
              <EmptyState
                title="No projects"
                description="Create a project to see agreed price vs allocated balances."
                className="py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Agreed (ETB)</TableHead>
                    <TableHead className="text-right">Allocated (ETB)</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.projectSummaries.map((row) => (
                    <TableRow key={row.projectId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.agreedPriceEtb)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.amountAllocatedEtb)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.outstandingEtb)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="maint-heading">
            <h2 id="maint-heading" className="text-sm font-semibold text-foreground">
              Maintenance recurring revenue
            </h2>
            {!report.maintenanceRecurring.length ? (
              <EmptyState
                title="No active maintenance agreements"
                description="Recurring revenue appears when agreements are ACTIVE."
                className="py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Monthly ETB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.maintenanceRecurring.map((row) => (
                    <TableRow key={row.agreementId}>
                      <TableCell className="font-medium">{row.projectName}</TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.billingFrequency}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.monthlyEtb)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
