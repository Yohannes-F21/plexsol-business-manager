import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  expenseCreateSchema,
  type ExpenseCreateInput,
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
import { paymentMethodsApi } from "@/features/payment-methods/api";
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { expenseCategoriesApi, expensesApi, type Expense } from "./api";

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  const categories = useMemo(
    () => categoriesQuery.data?.data ?? [],
    [categoriesQuery.data],
  );
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Expenses"
        description="Record operating expenses. Subscription renewals create expenses automatically."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" />
            Add expense
          </Button>
        }
      />

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
              Add expense
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <Link
                      to={`/expenses/${expense.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {expense.description}
                    </Link>
                    {expense.isSubscriptionRenewal ? (
                      <Badge variant="secondary" className="ml-2">
                        Renewal
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{expense.category?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div>
                      {formatMoney(expense.amount, expense.currencyCode)}
                    </div>
                    {expense.currencyCode !== "ETB" ? (
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(expense.amountEtb, "ETB")}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(expense.incurredAt)}</TableCell>
                  <TableCell>
                    {expense.paymentMethod?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={expense.isSubscriptionRenewal}
                        onClick={() => openEdit(expense)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={expense.isSubscriptionRenewal}
                        onClick={() => setDeleting(expense)}
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
