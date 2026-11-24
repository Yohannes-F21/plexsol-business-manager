import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { FormField } from "@/components/crud/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  allocatePaymentBatch,
  getClientBalances,
  paymentsApi,
} from "./api";

type AllocateForm = {
  lines: Array<{
    amount: string;
    targetType: "project" | "cycle";
    targetId: string;
  }>;
};

export function PaymentDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const paymentQuery = useQuery({
    queryKey: ["payments", id],
    queryFn: () => paymentsApi.get(id),
    enabled: Boolean(id),
  });

  const payment = paymentQuery.data?.data;
  const balancesQuery = useQuery({
    queryKey: ["balances", payment?.clientId],
    queryFn: () => getClientBalances(payment!.clientId),
    enabled: Boolean(payment?.clientId),
  });

  const form = useForm<AllocateForm>({
    defaultValues: {
      lines: [{ amount: "", targetType: "project", targetId: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const balances = balancesQuery.data?.data;
  const projects = useMemo(
    () =>
      (balances?.projects ?? []).filter(
        (project) =>
          project.currencyCode === payment?.currencyCode &&
          Number(project.outstanding) > 0,
      ),
    [balances, payment?.currencyCode],
  );
  const cycles = useMemo(
    () =>
      (balances?.billingCycles ?? []).filter(
        (cycle) =>
          cycle.currencyCode === payment?.currencyCode &&
          Number(cycle.outstanding) > 0,
      ),
    [balances, payment?.currencyCode],
  );

  const allocateMutation = useMutation({
    mutationFn: async (values: AllocateForm) => {
      const allocations = values.lines.map((line) => {
        if (!line.amount || !line.targetId) {
          throw new Error("Each line needs an amount and target");
        }
        return line.targetType === "project"
          ? { amount: line.amount, projectId: line.targetId }
          : { amount: line.amount, billingCycleId: line.targetId };
      });
      return allocatePaymentBatch(id, allocations);
    },
    onSuccess: async () => {
      setError(null);
      form.reset({
        lines: [{ amount: "", targetType: "project", targetId: "" }],
      });
      await queryClient.invalidateQueries({ queryKey: ["payments", id] });
      await queryClient.invalidateQueries({
        queryKey: ["balances", payment?.clientId],
      });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Allocation failed");
    },
  });

  if (paymentQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted-foreground">Payment not found.</p>
        <Button asChild variant="outline">
          <Link to="/payments">Back to payments</Link>
        </Button>
      </div>
    );
  }

  const unapplied = Math.max(
    0,
    Number(payment.amount) - Number(payment.amountAllocated),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/payments" aria-label="Back to payments">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title={`Payment · ${formatMoney(payment.amount, payment.currencyCode)}`}
          description={payment.client?.name ?? "Client payment"}
          actions={
            <Badge variant={unapplied > 0 ? "warning" : "success"}>
              {unapplied > 0
                ? `${formatMoney(String(unapplied), payment.currencyCode)} unapplied`
                : "Fully applied"}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{formatDate(payment.paidAt)}</p>
            <p className="text-muted-foreground">
              {payment.reference ?? "No reference"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(payment.amountAllocated, payment.currencyCode)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ETB snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(payment.amountEtb, "ETB")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          {(payment.allocations?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No allocations yet. Apply this receipt to one or more obligations.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.allocations?.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>
                      {allocation.project
                        ? `Project · ${allocation.project.name}`
                        : allocation.billingCycle
                          ? `Cycle · ${formatDate(allocation.billingCycle.periodStart)} – ${formatDate(allocation.billingCycle.periodEnd)}`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {formatMoney(allocation.amount, payment.currencyCode)}
                    </TableCell>
                    <TableCell>{allocation.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {unapplied > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocate receipt</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                setError(null);
                allocateMutation.mutate(values);
              })}
            >
              {fields.map((field, index) => {
                const targetType = form.watch(`lines.${index}.targetType`);
                return (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1.4fr_1fr_auto]"
                  >
                    <FormField label="Type" htmlFor={`type-${index}`}>
                      <Select
                        id={`type-${index}`}
                        {...form.register(`lines.${index}.targetType`)}
                      >
                        <option value="project">Project</option>
                        <option value="cycle">Billing cycle</option>
                      </Select>
                    </FormField>
                    <FormField label="Target" htmlFor={`target-${index}`}>
                      <Select
                        id={`target-${index}`}
                        {...form.register(`lines.${index}.targetId`)}
                      >
                        <option value="">Select…</option>
                        {targetType === "project"
                          ? projects.map((project) => (
                              <option
                                key={project.projectId}
                                value={project.projectId}
                              >
                                {project.name} · due{" "}
                                {formatMoney(
                                  project.outstanding,
                                  project.currencyCode,
                                )}
                              </option>
                            ))
                          : cycles.map((cycle) => (
                              <option key={cycle.cycleId} value={cycle.cycleId}>
                                {cycle.projectName} ·{" "}
                                {formatDate(cycle.periodStart)} · due{" "}
                                {formatMoney(
                                  cycle.outstanding,
                                  cycle.currencyCode,
                                )}
                              </option>
                            ))}
                      </Select>
                    </FormField>
                    <FormField label="Amount" htmlFor={`amount-${index}`}>
                      <Input
                        id={`amount-${index}`}
                        {...form.register(`lines.${index}.amount`)}
                      />
                    </FormField>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    append({
                      amount: "",
                      targetType: "project",
                      targetId: "",
                    })
                  }
                >
                  <Plus className="size-4" />
                  Add line
                </Button>
                <Button type="submit" disabled={allocateMutation.isPending}>
                  {allocateMutation.isPending ? (
                    <Spinner className="size-4" />
                  ) : null}
                  Apply allocations
                </Button>
              </div>
              {error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {balances ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client outstanding</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Projects</h3>
              <ul className="space-y-2 text-sm">
                {balances.projects.map((project) => (
                  <li
                    key={project.projectId}
                    className="flex justify-between gap-3"
                  >
                    <span>{project.name}</span>
                    <span>
                      {formatMoney(project.outstanding, project.currencyCode)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Billing cycles</h3>
              <ul className="space-y-2 text-sm">
                {balances.billingCycles.map((cycle) => (
                  <li
                    key={cycle.cycleId}
                    className="flex justify-between gap-3"
                  >
                    <span>
                      {cycle.projectName} · {formatDate(cycle.dueDate)}
                    </span>
                    <span>
                      {formatMoney(cycle.outstanding, cycle.currencyCode)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
