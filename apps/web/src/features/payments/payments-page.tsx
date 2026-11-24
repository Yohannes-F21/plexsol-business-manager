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
  CircleDollarSign,
  Eye,
  PieChart,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  clientPaymentCreateSchema,
  type ClientPaymentCreateInput,
} from "@plexsol/shared";
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
import { clientsApi } from "@/features/clients/api";
import { paymentMethodsApi } from "@/features/payment-methods/api";
import { fetchReport } from "@/features/reports/api";
import { listExchangeRates } from "@/features/subscriptions/api";
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { paymentsApi, type ClientPayment } from "./api";

function currentMonthId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function allocationState(payment: ClientPayment) {
  const amount = Number(payment.amount);
  const allocated = Number(payment.amountAllocated);
  if (allocated <= 0) {
    return { label: "Unallocated", variant: "danger" as const, unallocated: amount };
  }
  if (allocated + 0.0001 < amount) {
    return {
      label: "Partial",
      variant: "warning" as const,
      unallocated: Math.max(0, amount - allocated),
    };
  }
  return { label: "Allocated", variant: "success" as const, unallocated: 0 };
}

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["payments", { search, clientFilter, page }],
    queryFn: () =>
      paymentsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        clientId: clientFilter === "all" ? undefined : clientFilter,
      }),
  });

  const kpiQueries = useQueries({
    queries: [
      {
        queryKey: ["payments", "count", "all"],
        queryFn: () => paymentsApi.list({ page: 1, pageSize: 1 }),
        staleTime: 30_000,
      },
      {
        queryKey: ["payments", "kpi", "sample"],
        queryFn: () => paymentsApi.list({ page: 1, pageSize: 100 }),
        staleTime: 30_000,
      },
    ],
  });

  const reportQuery = useQuery({
    queryKey: ["reports", "payments-kpi", currentMonthId()],
    queryFn: () => fetchReport({ preset: "month", month: currentMonthId() }),
    staleTime: 60_000,
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", "options"],
    queryFn: () => clientsApi.list({ pageSize: 100, isActive: "true" }),
  });

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.list({ pageSize: 100 }),
  });

  const form = useForm<ClientPaymentCreateInput>({
    resolver: zodResolver(clientPaymentCreateSchema) as never,
    defaultValues: {
      clientId: "",
      amount: "",
      currencyCode: "ETB",
      amountEtb: "",
      exchangeRateId: null,
      paymentMethodId: null,
      paidAt: toDateInputValue(new Date()),
      reference: "",
      notes: "",
    },
  });

  const currency = (form.watch("currencyCode") || "ETB").toUpperCase();
  const needsFx = currency !== "ETB";

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates", currency],
    queryFn: () =>
      listExchangeRates({
        fromCurrencyCode: currency,
        toCurrencyCode: "ETB",
        pageSize: 20,
      }),
    enabled: formOpen && needsFx,
  });

  const saveMutation = useMutation({
    mutationFn: (values: ClientPaymentCreateInput) =>
      paymentsApi.create({
        ...values,
        currencyCode: values.currencyCode?.toUpperCase() ?? "ETB",
        amountEtb:
          (values.currencyCode ?? "ETB").toUpperCase() === "ETB"
            ? undefined
            : values.amountEtb || undefined,
        exchangeRateId:
          (values.currencyCode ?? "ETB").toUpperCase() === "ETB"
            ? null
            : values.exchangeRateId || null,
      }),
    onSuccess: async () => {
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to record payment",
      );
    },
  });

  const clients = useMemo(() => clientsQuery.data?.data ?? [], [clientsQuery.data]);
  const methods = useMemo(
    () => (methodsQuery.data?.data ?? []).filter((m) => m.isActive),
    [methodsQuery.data],
  );
  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  const totalReceipts = kpiQueries[0]?.data?.meta.total ?? 0;
  const allocationTotals = useMemo(() => {
    const sample = kpiQueries[1]?.data?.data ?? [];
    let allocatedEtb = 0;
    let unallocatedEtb = 0;
    for (const payment of sample) {
      const allocated = Number(payment.amountAllocated);
      const amount = Number(payment.amount);
      const unallocated = Math.max(0, amount - allocated);
      // Prefer ETB snapshot when present for cross-currency receipts.
      const scale =
        payment.currencyCode === "ETB" || !Number(payment.amountEtb)
          ? 1
          : Number(payment.amountEtb) / Math.max(amount, Number.EPSILON);
      allocatedEtb += allocated * scale;
      unallocatedEtb += unallocated * scale;
    }
    return {
      allocatedEtb,
      unallocatedEtb,
      sampleSize: sample.length,
      truncated: (kpiQueries[1]?.data?.meta.total ?? 0) > sample.length,
    };
  }, [kpiQueries]);

  const outstanding =
    reportQuery.data?.data?.totals.outstandingClientsEtb ?? null;
  const periodIncome = reportQuery.data?.data?.totals.incomeEtb ?? null;
  const periodLabel = reportQuery.data?.data?.period.label ?? "This period";

  const openCreate = () => {
    setFormError(null);
    form.reset({
      clientId: clients[0]?.id ?? "",
      amount: "",
      currencyCode: "ETB",
      amountEtb: "",
      exchangeRateId: null,
      paymentMethodId: null,
      paidAt: toDateInputValue(new Date()),
      reference: "",
      notes: "",
    });
    setFormOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Payments"
        description="Client receipts, allocations, and balances."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-5" />
            New Receipt
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <SummaryCard
          label={`Receipts (${periodLabel})`}
          value={
            periodIncome !== null ? formatMoney(periodIncome, "ETB") : "—"
          }
          tone="primary"
          hint={`${totalReceipts} recorded receipt${totalReceipts === 1 ? "" : "s"}`}
          icon={<Receipt className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Allocated"
          value={formatMoney(
            allocationTotals.allocatedEtb.toFixed(2),
            "ETB",
          )}
          tone="success"
          hint={
            allocationTotals.truncated
              ? `From latest ${allocationTotals.sampleSize} receipts`
              : undefined
          }
          icon={<PieChart className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Unallocated"
          value={formatMoney(
            allocationTotals.unallocatedEtb.toFixed(2),
            "ETB",
          )}
          tone="warning"
          hint={
            allocationTotals.truncated
              ? `From latest ${allocationTotals.sampleSize} receipts`
              : undefined
          }
          icon={<CircleDollarSign className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Outstanding Balances"
          value={
            outstanding !== null ? formatMoney(outstanding, "ETB") : "—"
          }
          tone="danger"
          hint="Across clients (ETB)"
          icon={<Wallet className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search reference, notes, or client…"
        filters={
          <Select
            value={clientFilter}
            onChange={(event) => {
              setClientFilter(event.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
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
          title="No payments yet"
          description="Record a client receipt, then allocate it to obligations."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="size-5" />
              New Receipt
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 md:pl-6">Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Unallocated</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((payment) => {
                const state = allocationState(payment);
                const receiptLabel =
                  payment.reference?.trim() ||
                  `RCPT-${payment.id.slice(0, 8).toUpperCase()}`;
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="pl-5 text-sm tabular-nums text-muted-foreground md:pl-6">
                      {formatDate(payment.paidAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/payments/${payment.id}`}
                        className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {receiptLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {payment.client?.name ?? "Unknown client"}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {formatMoney(payment.amount, payment.currencyCode)}
                      {payment.currencyCode !== "ETB" ? (
                        <p className="text-xs font-normal text-muted-foreground">
                          {formatMoney(payment.amountEtb, "ETB")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatMoney(
                        payment.amountAllocated,
                        payment.currencyCode,
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {formatMoney(
                        String(state.unallocated),
                        payment.currencyCode,
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.paymentMethod?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right md:pr-6">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`View ${receiptLabel}`}
                      >
                        <Link to={`/payments/${payment.id}`}>
                          <Eye className="size-5" strokeWidth={1.75} />
                        </Link>
                      </Button>
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
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Income is counted once on the receipt. Allocate separately to
              projects or billing cycles.
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
            <FormField label="Client" htmlFor="clientId">
              <Select id="clientId" {...form.register("clientId")}>
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Amount" htmlFor="amount">
                <Input id="amount" {...form.register("amount")} />
              </FormField>
              <FormField label="Currency" htmlFor="currencyCode">
                <Input
                  id="currencyCode"
                  maxLength={3}
                  {...form.register("currencyCode")}
                />
              </FormField>
              <FormField label="Paid on" htmlFor="paidAt">
                <Input id="paidAt" type="date" {...form.register("paidAt")} />
              </FormField>
            </div>
            {needsFx ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Amount in ETB" htmlFor="amountEtb">
                  <Input id="amountEtb" {...form.register("amountEtb")} />
                </FormField>
                <FormField label="Exchange rate" htmlFor="exchangeRateId">
                  <Select
                    id="exchangeRateId"
                    value={form.watch("exchangeRateId") ?? ""}
                    onChange={(event) =>
                      form.setValue(
                        "exchangeRateId",
                        event.target.value || null,
                      )
                    }
                  >
                    <option value="">Select rate (optional)</option>
                    {(ratesQuery.data?.data ?? []).map((rate) => (
                      <option key={rate.id} value={rate.id}>
                        1 {rate.fromCurrencyCode} = {rate.rate} ETB
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            ) : null}
            <FormField label="Payment method" htmlFor="paymentMethodId">
              <Select
                id="paymentMethodId"
                value={form.watch("paymentMethodId") ?? ""}
                onChange={(event) =>
                  form.setValue("paymentMethodId", event.target.value || null)
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
            <FormField label="Reference" htmlFor="reference">
              <Input id="reference" {...form.register("reference")} />
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
                Save receipt
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
