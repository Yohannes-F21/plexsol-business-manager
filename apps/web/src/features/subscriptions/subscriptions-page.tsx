import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RefreshCw } from "lucide-react";
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
import { formatDate, formatMoney, labelize, toDateInputValue } from "@/lib/format";
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
        message: "Enter ETB amount or select an exchange rate for non-ETB renewals",
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
          currency === "ETB"
            ? undefined
            : values.amountEtb || undefined,
        exchangeRateId:
          currency === "ETB"
            ? null
            : values.exchangeRateId || null,
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Track vendor subscriptions, renewals, and expiration."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" />
            Add subscription
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search name or vendor…"
        filters={
          <>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </>
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
              Add subscription
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      to={`/subscriptions/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                    {item.vendor ? (
                      <p className="text-xs text-muted-foreground">
                        {item.vendor}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{item.category?.name ?? "—"}</TableCell>
                  <TableCell>
                    {formatMoney(item.amount, item.currencyCode)}
                    <p className="text-xs text-muted-foreground">
                      {labelize(item.billingPeriod)}
                    </p>
                  </TableCell>
                  <TableCell>{formatDate(item.expirationDate)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[item.status]}>
                      {labelize(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRenew(item)}
                      >
                        <RefreshCw className="size-3.5" />
                        Renew
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(item)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {meta ? (
            <div className="border-t border-border px-4 py-3">
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
                <Input id="amount" {...form.register("amount")} />
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

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm renewal</DialogTitle>
            <DialogDescription>
              Records the payment, creates the renewal expense, updates
              expiration, and cancels obsolete reminders.
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
                <Input id="renewAmount" {...renewForm.register("amount")} />
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
                  <Input id="amountEtb" {...renewForm.register("amountEtb")} />
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
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {renewError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
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
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
