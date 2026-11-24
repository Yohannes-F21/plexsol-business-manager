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
  CalendarClock,
  CheckCircle2,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import {
  subscriptionCreateSchema,
  type SubscriptionCreateInput,
} from "@plexsol/shared";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { FormField } from "@/components/crud/form-field";
import { ListToolbar } from "@/components/crud/list-toolbar";
import { PageHeader } from "@/components/crud/page-header";
import { PaginationBar } from "@/components/crud/pagination-bar";
import { SummaryCard } from "@/components/crud/summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { paymentMethodsApi } from "@/features/payment-methods/api";
import { ApiError } from "@/lib/api";
import {
  daysUntil,
  formatDate,
  formatMoney,
  labelize,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  confirmRenewal,
  listExchangeRates,
  subscriptionCategoriesApi,
  subscriptionsApi,
  type Subscription,
} from "./api";

const renewalFormSchema = z
  .object({
    renewedAt: z.string().min(1),
    newExpirationDate: z.string().min(1),
    amount: z.string().min(1),
    currencyCode: z.string().length(3),
    amountEtb: z.string().optional().nullable(),
    exchangeRateId: z.string().optional().nullable(),
    paymentMethodId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const currency = value.currencyCode.toUpperCase();
    if (currency === "ETB") return;
    if (!value.amountEtb && !value.exchangeRateId) {
      ctx.addIssue({
        code: "custom",
        path: ["amountEtb"],
        message:
          "Enter ETB amount or select an exchange rate for non-ETB renewals",
      });
    }
  });

type RenewalFormValues = z.infer<typeof renewalFormSchema>;

const statusVariant: Record<
  Subscription["status"],
  "success" | "warning" | "danger" | "muted"
> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  CANCELLED: "muted",
};

const statusTabs = [
  { id: "all", label: "All Subscriptions", value: "all" },
  { id: "ACTIVE", label: "Active", value: "ACTIVE" },
  { id: "EXPIRING_SOON", label: "Renewing Soon", value: "EXPIRING_SOON" },
  { id: "EXPIRED", label: "Expired", value: "EXPIRED" },
] as const;

function ServiceMark({ name }: { name: string }) {
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-sm font-semibold text-primary"
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [renewing, setRenewing] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [renewError, setRenewError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["subscriptions", { search, status, categoryId, page }],
    queryFn: () =>
      subscriptionsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status === "all" ? undefined : status,
        categoryId: categoryId === "all" ? undefined : categoryId,
      }),
  });

  const countQueries = useQueries({
    queries: [
      {
        queryKey: ["subscriptions", "count", "all"],
        queryFn: () => subscriptionsApi.list({ page: 1, pageSize: 1 }),
        staleTime: 30_000,
      },
      {
        queryKey: ["subscriptions", "count", "ACTIVE"],
        queryFn: () =>
          subscriptionsApi.list({ page: 1, pageSize: 1, status: "ACTIVE" }),
        staleTime: 30_000,
      },
      {
        queryKey: ["subscriptions", "count", "EXPIRING_SOON"],
        queryFn: () =>
          subscriptionsApi.list({
            page: 1,
            pageSize: 1,
            status: "EXPIRING_SOON",
          }),
        staleTime: 30_000,
      },
      {
        queryKey: ["subscriptions", "count", "EXPIRED"],
        queryFn: () =>
          subscriptionsApi.list({ page: 1, pageSize: 1, status: "EXPIRED" }),
        staleTime: 30_000,
      },
    ],
  });

  const counts = {
    all: countQueries[0]?.data?.meta.total ?? 0,
    ACTIVE: countQueries[1]?.data?.meta.total ?? 0,
    EXPIRING_SOON: countQueries[2]?.data?.meta.total ?? 0,
    EXPIRED: countQueries[3]?.data?.meta.total ?? 0,
  };

  const categoriesQuery = useQuery({
    queryKey: ["subscription-categories"],
    queryFn: () => subscriptionCategoriesApi.list({ pageSize: 100 }),
  });

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.list({ pageSize: 100 }),
  });

  const form = useForm<SubscriptionCreateInput>({
    resolver: zodResolver(subscriptionCreateSchema) as never,
    defaultValues: {
      name: "",
      vendor: "",
      categoryId: null,
      amount: "",
      currencyCode: "ETB",
      billingPeriod: "YEARLY",
      startDate: "",
      expirationDate: "",
      status: "ACTIVE",
      url: "",
      notes: "",
    },
  });

  const renewForm = useForm<RenewalFormValues>({
    resolver: zodResolver(renewalFormSchema) as never,
    defaultValues: {
      renewedAt: toDateInputValue(new Date()),
      newExpirationDate: "",
      amount: "",
      currencyCode: "ETB",
      amountEtb: "",
      exchangeRateId: "",
      paymentMethodId: "",
      notes: "",
    },
  });

  const renewCurrency = (renewForm.watch("currencyCode") || "ETB").toUpperCase();
  const needsFx = renewCurrency !== "ETB";

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates", renewCurrency],
    queryFn: () =>
      listExchangeRates({
        fromCurrencyCode: renewCurrency,
        toCurrencyCode: "ETB",
        pageSize: 20,
      }),
    enabled: renewOpen && needsFx,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SubscriptionCreateInput) => {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        vendor: values.vendor || null,
        url: values.url || null,
      };
      if (editing) return subscriptionsApi.update(editing.id, payload);
      return subscriptionsApi.create(payload);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to save subscription",
      );
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (values: RenewalFormValues) => {
      if (!renewing) throw new Error("No subscription selected");
      const currency = values.currencyCode.toUpperCase();
      return confirmRenewal(renewing.id, {
        renewedAt: values.renewedAt,
        newExpirationDate: values.newExpirationDate,
        amount: values.amount,
        currencyCode: currency,
        amountEtb:
          currency === "ETB" ? undefined : values.amountEtb || undefined,
        exchangeRateId:
          currency === "ETB" ? null : values.exchangeRateId || null,
        paymentMethodId: values.paymentMethodId || null,
        notes: values.notes || null,
      });
    },
    onSuccess: async () => {
      setRenewOpen(false);
      setRenewing(null);
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (error) => {
      setRenewError(
        error instanceof ApiError ? error.message : "Unable to confirm renewal",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  const categories = useMemo(
    () => categoriesQuery.data?.data ?? [],
    [categoriesQuery.data],
  );
  const methods = useMemo(
    () => (methodsQuery.data?.data ?? []).filter((method) => method.isActive),
    [methodsQuery.data],
  );

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    form.reset({
      name: "",
      vendor: "",
      categoryId: null,
      amount: "",
      currencyCode: "ETB",
      billingPeriod: "YEARLY",
      startDate: toDateInputValue(new Date()),
      expirationDate: "",
      status: "ACTIVE",
      url: "",
      notes: "",
    });
    setFormOpen(true);
  };

  const openEdit = (item: Subscription) => {
    setEditing(item);
    setFormError(null);
    form.reset({
      name: item.name,
      vendor: item.vendor ?? "",
      categoryId: item.categoryId,
      amount: item.amount,
      currencyCode: item.currencyCode,
      billingPeriod: item.billingPeriod,
      startDate: toDateInputValue(item.startDate),
      expirationDate: toDateInputValue(item.expirationDate),
      status: item.status,
      url: item.url ?? "",
      notes: item.notes ?? "",
    });
    setFormOpen(true);
  };

  const openRenew = (item: Subscription) => {
    setRenewing(item);
    setRenewError(null);
    const nextYear = new Date(item.expirationDate);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    renewForm.reset({
      renewedAt: toDateInputValue(new Date()),
      newExpirationDate: toDateInputValue(nextYear),
      amount: item.amount,
      currencyCode: item.currencyCode,
      amountEtb: "",
      exchangeRateId: "",
      paymentMethodId: methods[0]?.id ?? "",
      notes: "",
    });
    setRenewOpen(true);
  };

  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  const tabCount = (value: string) => {
    if (value === "all") return counts.all;
    if (value === "ACTIVE") return counts.ACTIVE;
    if (value === "EXPIRING_SOON") return counts.EXPIRING_SOON;
    if (value === "EXPIRED") return counts.EXPIRED;
    return 0;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Manage software subscriptions, renewal dates, and related expenses."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-5" />
            Add Subscription
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <SummaryCard
          label="Total Subscriptions"
          value={counts.all}
          tone="primary"
          icon={<Layers className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Active"
          value={counts.ACTIVE}
          tone="success"
          icon={<CheckCircle2 className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Renewing Soon"
          value={counts.EXPIRING_SOON}
          tone="warning"
          icon={<CalendarClock className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Expired"
          value={counts.EXPIRED}
          tone="danger"
          icon={<XCircle className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <div
        role="tablist"
        aria-label="Subscription status"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {statusTabs.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums text-muted-foreground">
                ({tabCount(tab.value)})
              </span>
              {active ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search subscription, software, or vendor…"
        filters={
          <Select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="all">Category: All</option>
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
          title="No subscriptions yet"
          description="Add a subscription to track renewals and expenses."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="size-5" />
              Add Subscription
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 md:pl-6">Software / Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Renewal Date</TableHead>
                <TableHead>Billing Cycle</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const remaining = daysUntil(item.expirationDate);
                const showCountdown =
                  item.status === "EXPIRING_SOON" ||
                  (remaining !== null && remaining <= 14 && remaining >= 0);

                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5 md:pl-6">
                      <div className="flex items-center gap-3">
                        <ServiceMark name={item.name} />
                        <div className="min-w-0">
                          <Link
                            to={`/subscriptions/${item.id}`}
                            className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                          >
                            {item.name}
                          </Link>
                          {item.vendor ? (
                            <p className="truncate text-xs leading-[18px] text-muted-foreground">
                              {item.vendor}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <p className="tabular-nums text-foreground">
                        {formatDate(item.expirationDate)}
                      </p>
                      {showCountdown && remaining !== null ? (
                        <p
                          className={cn(
                            "text-xs font-medium leading-[18px]",
                            remaining <= 7 ? "text-danger" : "text-primary",
                          )}
                        >
                          {remaining === 0
                            ? "Today"
                            : remaining === 1
                              ? "1 day"
                              : `${remaining} days`}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {labelize(item.billingPeriod)}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-medium tabular-nums text-foreground">
                        {formatMoney(item.amount, item.currencyCode)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[item.status]}>
                        {item.status === "EXPIRING_SOON"
                          ? "Renewing Soon"
                          : labelize(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right md:pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Renew ${item.name}`}
                          onClick={() => openRenew(item)}
                        >
                          <RefreshCw className="size-5" strokeWidth={1.75} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="size-5" strokeWidth={1.75} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 className="size-5" strokeWidth={1.75} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit subscription" : "Add subscription"}
            </DialogTitle>
            <DialogDescription>
              Capture vendor billing period and expiration for reminders.
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
              label="Name"
              htmlFor="name"
              error={form.formState.errors.name?.message}
            >
              <Input id="name" {...form.register("name")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Vendor" htmlFor="vendor">
                <Input id="vendor" {...form.register("vendor")} />
              </FormField>
              <FormField label="Category" htmlFor="categoryId">
                <Select
                  id="categoryId"
                  value={form.watch("categoryId") ?? ""}
                  onChange={(event) =>
                    form.setValue(
                      "categoryId",
                      event.target.value ? event.target.value : null,
                    )
                  }
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Amount"
                htmlFor="amount"
                error={form.formState.errors.amount?.message}
              >
                <Input id="amount" className="tabular-nums" {...form.register("amount")} />
              </FormField>
              <FormField label="Currency" htmlFor="currencyCode">
                <Input
                  id="currencyCode"
                  maxLength={3}
                  {...form.register("currencyCode")}
                />
              </FormField>
              <FormField label="Billing period" htmlFor="billingPeriod">
                <Select id="billingPeriod" {...form.register("billingPeriod")}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Start date"
                htmlFor="startDate"
                error={form.formState.errors.startDate?.message}
              >
                <Input
                  id="startDate"
                  type="date"
                  {...form.register("startDate")}
                />
              </FormField>
              <FormField
                label="Expiration"
                htmlFor="expirationDate"
                error={form.formState.errors.expirationDate?.message}
              >
                <Input
                  id="expirationDate"
                  type="date"
                  {...form.register("expirationDate")}
                />
              </FormField>
              <FormField label="Status" htmlFor="status">
                <Select id="status" {...form.register("status")}>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRING_SOON">Expiring soon</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </FormField>
            </div>
            <FormField label="URL" htmlFor="url">
              <Input id="url" {...form.register("url")} />
            </FormField>
            <FormField label="Notes" htmlFor="notes">
              <Textarea id="notes" {...form.register("notes")} />
            </FormField>
            {formError ? (
              <p className="rounded-[10px] bg-danger-background px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
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

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm renewal</DialogTitle>
            <DialogDescription>
              {renewing
                ? `Renew ${renewing.name}. Records the payment, creates the renewal expense, updates expiration, and cancels obsolete reminders.`
                : "Records the payment, creates the renewal expense, updates expiration, and cancels obsolete reminders."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={renewForm.handleSubmit((values) => {
              setRenewError(null);
              renewMutation.mutate(values);
            })}
            noValidate
          >
            <FormField
              label="Paid on"
              htmlFor="renewedAt"
              error={renewForm.formState.errors.renewedAt?.message}
            >
              <Input
                id="renewedAt"
                type="date"
                {...renewForm.register("renewedAt")}
              />
            </FormField>
            <FormField
              label="New expiration"
              htmlFor="newExpirationDate"
              error={renewForm.formState.errors.newExpirationDate?.message}
            >
              <Input
                id="newExpirationDate"
                type="date"
                {...renewForm.register("newExpirationDate")}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Amount paid"
                htmlFor="renewAmount"
                error={renewForm.formState.errors.amount?.message}
              >
                <Input
                  id="renewAmount"
                  className="tabular-nums"
                  {...renewForm.register("amount")}
                />
              </FormField>
              <FormField label="Currency" htmlFor="renewCurrency">
                <Input
                  id="renewCurrency"
                  maxLength={3}
                  {...renewForm.register("currencyCode")}
                />
              </FormField>
            </div>
            {needsFx ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Amount in ETB"
                  htmlFor="amountEtb"
                  error={renewForm.formState.errors.amountEtb?.message}
                  hint="Required for non-ETB renewals unless you pick a rate"
                >
                  <Input
                    id="amountEtb"
                    className="tabular-nums"
                    {...renewForm.register("amountEtb")}
                  />
                </FormField>
                <FormField
                  label="Exchange rate"
                  htmlFor="exchangeRateId"
                  hint="Optional if ETB amount is entered"
                >
                  <Select
                    id="exchangeRateId"
                    {...renewForm.register("exchangeRateId")}
                  >
                    <option value="">Select rate (optional)</option>
                    {(ratesQuery.data?.data ?? []).map((rate) => (
                      <option key={rate.id} value={rate.id}>
                        1 {rate.fromCurrencyCode} = {rate.rate}{" "}
                        {rate.toCurrencyCode} (
                        {new Date(rate.effectiveAt).toISOString().slice(0, 10)})
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            ) : null}
            <FormField label="Payment method" htmlFor="paymentMethodId">
              <Select
                id="paymentMethodId"
                {...renewForm.register("paymentMethodId")}
              >
                <option value="">Unspecified</option>
                {methods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Notes" htmlFor="renewNotes">
              <Textarea id="renewNotes" {...renewForm.register("notes")} />
            </FormField>
            {renewError ? (
              <p className="rounded-[10px] bg-danger-background px-3 py-2 text-sm text-danger">
                {renewError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenewOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renewMutation.isPending}>
                {renewMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : null}
                Confirm renewal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete subscription?"
        description={
          deleting
            ? `Delete ${deleting.name}? Subscriptions with renewals must be cancelled instead.`
            : ""
        }
        loading={deleteMutation.isPending}
        destructive
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
