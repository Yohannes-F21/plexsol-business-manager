import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { SummaryCard } from "@/components/crud/summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, formatMoney, labelize, toDateInputValue } from "@/lib/format";
import { fetchReport, type ReportPreset } from "./api";

const ORANGE = "#FF6500";
const PEACH = "#FFD9BF";
const CHARCOAL = "#111827";
const GRID = "#E7E9EF";
const TICK = "#64748B";

function currentMonthId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ReportsPage() {
  const [preset, setPreset] = useState<ReportPreset>("month");
  const [month, setMonth] = useState(currentMonthId());
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [from, setFrom] = useState(
    toDateInputValue(new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))),
  );
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

  const chartData = useMemo(
    () =>
      (report?.monthlySeries ?? []).map((point) => ({
        month: point.label,
        Income: Number(point.incomeEtb),
        Expenses: Number(point.expensesEtb),
        "Net Cash Flow": Number(point.netCashFlowEtb),
      })),
    [report?.monthlySeries],
  );

  const outstandingBars = useMemo(() => {
    const rows = report?.outstandingBalances ?? [];
    const total = rows.reduce(
      (sum, row) => sum + Number(row.totalOutstandingEtb),
      0,
    );
    return rows
      .slice()
      .sort(
        (a, b) =>
          Number(b.totalOutstandingEtb) - Number(a.totalOutstandingEtb),
      )
      .slice(0, 6)
      .map((row) => ({
        ...row,
        share:
          total > 0 ? (Number(row.totalOutstandingEtb) / total) * 100 : 0,
      }));
  }, [report?.outstandingBalances]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Reports"
        description="ETB financial reporting using historical exchange-rate snapshots on receipts and expenses."
      />

      <section
        aria-label="Report period filters"
        className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted-foreground">Period type</span>
          <Select
            value={preset}
            onChange={(event) => setPreset(event.target.value as ReportPreset)}
            aria-label="Period type"
            className="w-full sm:w-44"
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="custom">Custom range</option>
          </Select>
        </label>

        {preset === "month" ? (
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Month</span>
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              aria-label="Report month"
              className="w-full sm:w-44"
            />
          </label>
        ) : null}

        {preset === "year" ? (
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Year</span>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              aria-label="Report year"
              className="w-full sm:w-36"
            />
          </label>
        ) : null}

        {preset === "custom" ? (
          <>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-muted-foreground">From</span>
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="Custom from date"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-muted-foreground">To</span>
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
        <div
          className="flex justify-center py-16"
          role="status"
          aria-live="polite"
        >
          <Spinner className="size-8" />
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
            Showing{" "}
            <span className="font-medium text-foreground">
              {report.period.label}
            </span>{" "}
            ({formatDate(report.period.from)} – {formatDate(report.period.to)})
            · reporting currency ETB
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            <SummaryCard
              label="Total Income"
              value={formatMoney(report.totals.incomeEtb, "ETB")}
              tone="primary"
              icon={<TrendingUp className="size-[18px]" strokeWidth={1.75} />}
            />
            <SummaryCard
              label="Total Expenses"
              value={formatMoney(report.totals.expensesEtb, "ETB")}
              tone="warning"
              icon={<TrendingDown className="size-[18px]" strokeWidth={1.75} />}
            />
            <SummaryCard
              label="Net Profit"
              value={formatMoney(report.totals.netCashFlowEtb, "ETB")}
              tone={
                Number(report.totals.netCashFlowEtb) >= 0
                  ? "success"
                  : "danger"
              }
              icon={<Wallet className="size-[18px]" strokeWidth={1.75} />}
            />
            <SummaryCard
              label="Recurring (Monthly)"
              value={formatMoney(
                report.totals.recurringMaintenanceMonthlyEtb,
                "ETB",
              )}
              tone="primary"
              hint="Maintenance agreements"
              icon={<RefreshCw className="size-[18px]" strokeWidth={1.75} />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] xl:gap-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-6">
                  Income vs Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {chartData.length === 0 ? (
                  <EmptyState
                    title="No cash-flow points"
                    description="No payments or expenses in this window."
                    className="py-10"
                  />
                ) : (
                  <div className="h-72 w-full sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        barGap={4}
                        barCategoryGap="28%"
                      >
                        <CartesianGrid
                          strokeDasharray="4 4"
                          vertical={false}
                          stroke={GRID}
                        />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: TICK, fontSize: 12 }}
                          dy={8}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: TICK, fontSize: 12 }}
                          width={48}
                          tickFormatter={(value: number) =>
                            value >= 1000
                              ? `${Math.round(value / 1000)}k`
                              : String(value)
                          }
                        />
                        <Tooltip
                          formatter={(value) =>
                            formatMoney(
                              String(typeof value === "number" ? value : 0),
                              "ETB",
                            )
                          }
                          contentStyle={{
                            borderRadius: 12,
                            borderColor: GRID,
                            background: "#FFFFFF",
                            boxShadow:
                              "0 1px 2px rgb(17 24 39 / 0.04), 0 1px 3px rgb(17 24 39 / 0.06)",
                            fontSize: 12,
                          }}
                          labelStyle={{ color: CHARCOAL, fontWeight: 600 }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 12, paddingBottom: 16 }}
                        />
                        <Bar
                          dataKey="Income"
                          fill={ORANGE}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={26}
                        />
                        <Bar
                          dataKey="Expenses"
                          fill={PEACH}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={26}
                        />
                        <Line
                          type="monotone"
                          dataKey="Net Cash Flow"
                          stroke={CHARCOAL}
                          strokeWidth={2}
                          dot={{ r: 4, fill: CHARCOAL, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-6">
                  Outstanding by client
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {outstandingBars.length === 0 ? (
                  <EmptyState
                    title="No outstanding balances"
                    description="All tracked projects and cycles are settled."
                    className="py-10"
                  />
                ) : (
                  <ul className="space-y-3">
                    {outstandingBars.map((row) => (
                      <li key={row.clientId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-foreground">
                            {row.clientName}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatMoney(row.totalOutstandingEtb, "ETB")}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${row.share}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.share.toFixed(1)}% of outstanding · projects{" "}
                          {formatMoney(row.projectOutstandingEtb, "ETB")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Total outstanding{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(report.totals.outstandingClientsEtb, "ETB")}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3" aria-labelledby="outstanding-heading">
            <h2
              id="outstanding-heading"
              className="text-base font-semibold text-foreground"
            >
              Outstanding client balances
            </h2>
            {!report.outstandingBalances.length ? (
              <EmptyState
                title="No outstanding balances"
                description="All tracked projects and cycles are settled."
                className="py-10"
              />
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 md:pl-6">Client</TableHead>
                      <TableHead className="text-right">Projects</TableHead>
                      <TableHead className="text-right">Billing</TableHead>
                      <TableHead className="pr-5 text-right md:pr-6">
                        Total (ETB)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.outstandingBalances.map((row) => (
                      <TableRow key={row.clientId}>
                        <TableCell className="pl-5 font-medium md:pl-6">
                          {row.clientName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatMoney(row.projectOutstandingEtb)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatMoney(row.billingOutstandingEtb)}
                        </TableCell>
                        <TableCell className="pr-5 text-right tabular-nums font-medium md:pr-6">
                          {formatMoney(row.totalOutstandingEtb)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="renewals-heading">
            <h2
              id="renewals-heading"
              className="text-base font-semibold text-foreground"
            >
              Subscription renewal forecasts (90 days)
            </h2>
            {!report.renewalForecasts.length ? (
              <EmptyState
                title="No renewals in forecast window"
                description="No active subscriptions expire in the next 90 days from period end."
                className="py-10"
              />
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 md:pl-6">Subscription</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead className="pr-5 text-right md:pr-6">
                        ETB
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.renewalForecasts.map((row) => (
                      <TableRow key={row.subscriptionId}>
                        <TableCell className="pl-5 md:pl-6">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.vendor ?? row.billingPeriod}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.expirationDate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.daysRemaining <= 7
                                ? "danger"
                                : row.daysRemaining <= 30
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {row.daysRemaining}d
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-5 text-right tabular-nums font-medium md:pr-6">
                          {formatMoney(row.amountEtb)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="projects-heading">
            <h2
              id="projects-heading"
              className="text-base font-semibold text-foreground"
            >
              Project financial summaries
            </h2>
            {!report.projectSummaries.length ? (
              <EmptyState
                title="No projects"
                description="Create a project to see agreed price vs allocated balances."
                className="py-10"
              />
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 md:pl-6">Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Agreed (ETB)</TableHead>
                      <TableHead className="text-right">
                        Allocated (ETB)
                      </TableHead>
                      <TableHead className="pr-5 text-right md:pr-6">
                        Outstanding
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.projectSummaries.map((row) => (
                      <TableRow key={row.projectId}>
                        <TableCell className="pl-5 font-medium md:pl-6">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.clientName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{labelize(row.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatMoney(row.agreedPriceEtb)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatMoney(row.amountAllocatedEtb)}
                        </TableCell>
                        <TableCell className="pr-5 text-right tabular-nums font-medium md:pr-6">
                          {formatMoney(row.outstandingEtb)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="maint-heading">
            <h2
              id="maint-heading"
              className="text-base font-semibold text-foreground"
            >
              Maintenance recurring revenue
            </h2>
            {!report.maintenanceRecurring.length ? (
              <EmptyState
                title="No active maintenance agreements"
                description="Recurring revenue appears when agreements are ACTIVE."
                className="py-10"
              />
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 md:pl-6">Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="pr-5 text-right md:pr-6">
                        Monthly ETB
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.maintenanceRecurring.map((row) => (
                      <TableRow key={row.agreementId}>
                        <TableCell className="pl-5 font-medium md:pl-6">
                          {row.projectName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.clientName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {labelize(row.billingFrequency)}
                        </TableCell>
                        <TableCell className="pr-5 text-right tabular-nums font-medium md:pr-6">
                          {formatMoney(row.monthlyEtb)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
