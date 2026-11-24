import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  clientPaymentCreateSchema,
  type ClientPaymentCreateInput,
} from "@plexsol/shared";
import { FormField } from "@/components/crud/form-field";
import { ListToolbar } from "@/components/crud/list-toolbar";
import { PageHeader } from "@/components/crud/page-header";
import { PaginationBar } from "@/components/crud/pagination-bar";
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
import { listExchangeRates } from "@/features/subscriptions/api";
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { paymentsApi } from "./api";

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Payments"
        description="Record receipts once, then allocate across projects and maintenance cycles."
        actions={
          <Button
            type="button"
            onClick={() => {
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
            }}
          >
            <Plus className="size-4" />
            Record payment
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search reference or notes…"
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
        />
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Unapplied</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((payment) => {
                const unapplied =
                  Number(payment.amount) - Number(payment.amountAllocated);
                const amountLabel = formatMoney(
                  payment.amount,
                  payment.currencyCode,
                );
                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Link
                        to={`/payments/${payment.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {amountLabel}
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {payment.client?.name ?? "Unknown client"} ·{" "}
                          {formatDate(payment.paidAt)}
                          {payment.reference
                            ? ` · ${payment.reference}`
                            : ""}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {amountLabel}
                      {payment.currencyCode !== "ETB" ? (
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(payment.amountEtb, "ETB")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        unapplied > 0 ? String(unapplied) : "0",
                        payment.currencyCode,
                      )}
                    </TableCell>
                    <TableCell>{formatDate(payment.paidAt)}</TableCell>
                    <TableCell>{payment.reference ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
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
