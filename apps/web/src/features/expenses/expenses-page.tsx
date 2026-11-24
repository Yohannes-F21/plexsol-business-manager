import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  expenseCreateSchema,
  type ExpenseCreateInput,
} from "@plexsol/shared";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { FormField } from "@/components/crud/form-field";
import { ListToolbar } from "@/components/crud/list-toolbar";
import { PageHeader } from "@/components/crud/page-header";
import { PaginationBar } from "@/components/crud/pagination-bar";
import { SummaryCard } from "@/components/crud/summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getDashboardSnapshot } from "@/features/dashboard/data/repository";
import { paymentMethodsApi } from "@/features/payment-methods/api";
import { fetchReport } from "@/features/reports/api";
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { expenseCategoriesApi, expensesApi, type Expense } from "./api";

const CHART_COLORS = [
  "#FF6500",
  "#FF9A5C",
  "#FFD9BF",
  "#111827",
  "#64748B",
  "#94A3B8",
  "#F59E0B",
  "#10B981",
];

const CATEGORY_BADGE_TONES = [
  "bg-primary-subtle text-primary",
  "bg-success-background text-success",
  "bg-warning-background text-warning",
  "bg-muted text-muted-foreground",
  "bg-danger-background text-danger",
] as const;

function currentMonthId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function categoryTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % CATEGORY_BADGE_TONES.length;
  }
  return CATEGORY_BADGE_TONES[hash] ?? CATEGORY_BADGE_TONES[0];
}

function sumEtb(expenses: Expense[]) {
  return expenses.reduce((total, expense) => total + Number(expense.amountEtb), 0);
}

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const monthId = currentMonthId();

  const listQuery = useQuery({
    queryKey: ["expenses", { search, categoryId, page }],
    queryFn: () =>
      expensesApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        categoryId: categoryId === "all" ? undefined : categoryId,
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseCategoriesApi.list({ pageSize: 100 }),
  });

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.list({ pageSize: 100 }),
  });

  const reportQuery = useQuery({
    queryKey: ["reports", "expenses-kpi", monthId],
    queryFn: () => fetchReport({ preset: "month", month: monthId }),
    staleTime: 60_000,
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", monthId],
    queryFn: () => getDashboardSnapshot(monthId),
    staleTime: 30_000,
  });

  const categories = useMemo(
    () => categoriesQuery.data?.data ?? [],
    [categoriesQuery.data],
  );
  const renewalCategory = useMemo(
    () => categories.find((category) => category.slug === "subscription_renewal"),
    [categories],
  );

  const kpiQueries = useQueries({
    queries: [
      {
        queryKey: ["expenses", "kpi", "sample"],
        queryFn: () => expensesApi.list({ page: 1, pageSize: 100 }),
        staleTime: 30_000,
      },
      {
        queryKey: ["expenses", "kpi", "renewals", renewalCategory?.id],
        queryFn: () =>
          expensesApi.list({
            page: 1,
            pageSize: 100,
            categoryId: renewalCategory!.id,
          }),
        enabled: Boolean(renewalCategory?.id),
        staleTime: 30_000,
      },
    ],
  });

  const form = useForm<ExpenseCreateInput>({
    resolver: zodResolver(expenseCreateSchema) as never,
    defaultValues: {
      categoryId: "",
      amount: "",
      currencyCode: "ETB",
      description: "",
      incurredAt: toDateInputValue(new Date()),
      paymentMethodId: null,
    },
  });

  const selectableCategories = categories.filter(
    (category) => category.slug !== "subscription_renewal",
  );
  const methods = useMemo(
    () => (methodsQuery.data?.data ?? []).filter((method) => method.isActive),
    [methodsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: ExpenseCreateInput) => {
      const payload = {
        ...values,
        paymentMethodId: values.paymentMethodId || null,
        amountEtb:
          values.currencyCode === "ETB" || !values.currencyCode
            ? values.amount
            : values.amountEtb,
      };
      if (editing) return expensesApi.update(editing.id, payload);
      return expensesApi.create(payload);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to save expense",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    form.reset({
      categoryId: selectableCategories[0]?.id ?? "",
      amount: "",
      currencyCode: "ETB",
      description: "",
      incurredAt: toDateInputValue(new Date()),
      paymentMethodId: null,
    });
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (expense.isSubscriptionRenewal) return;
    setEditing(expense);
    setFormError(null);
    form.reset({
      categoryId: expense.categoryId,
      amount: expense.amount,
      currencyCode: expense.currencyCode,
      amountEtb: expense.amountEtb,
      description: expense.description,
      incurredAt: toDateInputValue(expense.incurredAt),
      paymentMethodId: expense.paymentMethodId,
    });
    setFormOpen(true);
  };

  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  const totalExpensesEtb =
    reportQuery.data?.data?.totals.expensesEtb ??
    dashboardQuery.data?.kpis.find((kpi) => kpi.id === "total_expenses")?.value
      .amount ??
    null;
  const expenseTrend = dashboardQuery.data?.kpis.find(
    (kpi) => kpi.id === "total_expenses",
  )?.trend;
  const periodLabel = reportQuery.data?.data?.period.label ?? "This period";

  const renewalsEtb = useMemo(() => {
    const renewals = kpiQueries[1]?.data?.data ?? [];
    return sumEtb(
      renewals.filter((expense) => expense.incurredAt.slice(0, 7) === monthId),
    );
  }, [kpiQueries, monthId]);

  const operatingEtb =
    totalExpensesEtb !== null
      ? Math.max(0, Number(totalExpensesEtb) - renewalsEtb)
      : null;

  const categoryChart = useMemo(() => {
    const sample = kpiQueries[0]?.data?.data ?? [];
    const inPeriod = sample.filter(
      (expense) => expense.incurredAt.slice(0, 7) === monthId,
    );
    const source = inPeriod.length > 0 ? inPeriod : sample;
    const totals = new Map<string, number>();
    for (const expense of source) {
      const name = expense.category?.name ?? "Uncategorized";
      totals.set(name, (totals.get(name) ?? 0) + Number(expense.amountEtb));
    }
    const rows = [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return {
      rows,
      total,
      truncated: (kpiQueries[0]?.data?.meta.total ?? 0) > sample.length,
      periodScoped: inPeriod.length > 0,
    };
  }, [kpiQueries, monthId]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Expenses"
        description="Track operating spend and subscription renewal expenses."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-5" />
            Add Expense
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
        <SummaryCard
          label={`Total Expenses (${periodLabel})`}
          value={
            totalExpensesEtb !== null
              ? formatMoney(totalExpensesEtb, "ETB")
              : "—"
          }
          tone="primary"
          hint={
            expenseTrend
              ? `${expenseTrend.label} ${expenseTrend.comparisonLabel}`
              : undefined
          }
          icon={<Wallet className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Subscription Renewals"
          value={formatMoney(renewalsEtb.toFixed(2), "ETB")}
          tone="warning"
          hint="Renewals create expenses automatically"
          icon={<RefreshCw className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Operating Expenses"
          value={
            operatingEtb !== null
              ? formatMoney(operatingEtb.toFixed(2), "ETB")
              : "—"
          }
          tone="success"
          hint="Period total minus renewals"
          icon={<Building2 className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold leading-6">
              Expenses by Category
              {categoryChart.periodScoped ? ` (${periodLabel})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {categoryChart.rows.length === 0 ? (
              <EmptyState
                title="No category breakdown yet"
                description="Record expenses to see the category mix."
                className="py-10"
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChart.rows}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {categoryChart.rows.map((row, index) => (
                        <Cell
                          key={row.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        formatMoney(
                          String(typeof value === "number" ? value : 0),
                          "ETB",
                        )
                      }
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#E7E9EF",
                        background: "#FFFFFF",
                        boxShadow:
                          "0 1px 2px rgb(17 24 39 / 0.04), 0 1px 3px rgb(17 24 39 / 0.06)",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {categoryChart.truncated ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Chart uses the latest 100 expenses
                {categoryChart.periodScoped ? " in this period" : ""}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold leading-6">
              Category mix
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {categoryChart.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Category shares will appear alongside the chart.
              </p>
            ) : (
              <ul className="space-y-3">
                {categoryChart.rows.slice(0, 6).map((row, index) => {
                  const share =
                    categoryChart.total > 0
                      ? (row.value / categoryChart.total) * 100
                      : 0;
                  return (
                    <li key={row.name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <span
                            className="size-2.5 rounded-full"
                            style={{
                              background:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                            aria-hidden
                          />
                          {row.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${share}%`,
                            background:
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatMoney(row.value.toFixed(2), "ETB")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search description…"
        filters={
          <Select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        }
      />

      {listQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Add an expense or confirm a subscription renewal."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="size-5" />
              Add Expense
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 md:pl-6">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="pl-5 text-sm tabular-nums text-muted-foreground md:pl-6">
                    {formatDate(expense.incurredAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/expenses/${expense.id}`}
                        className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {expense.description}
                      </Link>
                      {expense.isSubscriptionRenewal ? (
                        <Badge variant="secondary">Renewal</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {expense.category?.name ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-[18px]",
                          categoryTone(expense.category.name),
                        )}
                      >
                        {expense.category.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">
                    {formatMoney(expense.amount, expense.currencyCode)}
                    {expense.currencyCode !== "ETB" ? (
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatMoney(expense.amountEtb, "ETB")}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expense.paymentMethod?.name ?? "—"}
                  </TableCell>
                  <TableCell className="pr-5 text-right md:pr-6">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`View ${expense.description}`}
                      >
                        <Link to={`/expenses/${expense.id}`}>
                          <Eye className="size-5" strokeWidth={1.75} />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={expense.isSubscriptionRenewal}
                        aria-label={`Edit ${expense.description}`}
                        onClick={() => openEdit(expense)}
                      >
                        <Pencil className="size-5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={expense.isSubscriptionRenewal}
                        aria-label={`Delete ${expense.description}`}
                        onClick={() => setDeleting(expense)}
                      >
                        <Trash2 className="size-5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {meta ? (
            <div className="border-t border-border px-4 py-3 md:px-6">
              <PaginationBar
                page={meta.page}
                pageSize={meta.pageSize}
                total={meta.total}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit expense" : "Add expense"}
            </DialogTitle>
            <DialogDescription>
              Subscription renewal expenses must be created via renewals.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setFormError(null);
              saveMutation.mutate(values);
            })}
            noValidate
          >
            <FormField
              label="Category"
              htmlFor="categoryId"
              error={form.formState.errors.categoryId?.message}
            >
              <Select id="categoryId" {...form.register("categoryId")}>
                <option value="">Select category</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Description"
              htmlFor="description"
              error={form.formState.errors.description?.message}
            >
              <Input id="description" {...form.register("description")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Amount"
                htmlFor="amount"
                error={form.formState.errors.amount?.message}
              >
                <Input id="amount" {...form.register("amount")} />
              </FormField>
              <FormField label="Currency" htmlFor="currencyCode">
                <Input
                  id="currencyCode"
                  maxLength={3}
                  {...form.register("currencyCode")}
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Incurred on"
                htmlFor="incurredAt"
                error={form.formState.errors.incurredAt?.message}
              >
                <Input
                  id="incurredAt"
                  type="date"
                  {...form.register("incurredAt")}
                />
              </FormField>
              <FormField label="Payment method" htmlFor="paymentMethodId">
                <Select
                  id="paymentMethodId"
                  value={form.watch("paymentMethodId") ?? ""}
                  onChange={(event) =>
                    form.setValue(
                      "paymentMethodId",
                      event.target.value || null,
                    )
                  }
                >
                  <option value="">Unspecified</option>
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            {formError ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Spinner className="size-4" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete expense?"
        description={
          deleting
            ? `Delete “${deleting.description}”? Renewal expenses cannot be deleted.`
            : ""
        }
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
