import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { FormField } from "@/components/crud/form-field";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  expenseCategoriesApi,
  type ExpenseCategory,
} from "@/features/expenses/api";
import {
  paymentMethodsApi,
  type PaymentMethod,
} from "@/features/payment-methods/api";
import {
  subscriptionCategoriesApi,
  type SubscriptionCategory,
} from "@/features/subscriptions/api";
import { ApiError } from "@/lib/api";
import { labelize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "payment-methods" | "expense-categories" | "subscription-categories";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("payment-methods");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Settings"
        description="Reference data for payment methods and categories."
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            ["payment-methods", "Payment methods"],
            ["expense-categories", "Expense categories"],
            ["subscription-categories", "Subscription categories"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              tab === id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "payment-methods" ? <PaymentMethodsPanel /> : null}
      {tab === "expense-categories" ? <ExpenseCategoriesPanel /> : null}
      {tab === "subscription-categories" ? (
        <SubscriptionCategoriesPanel />
      ) : null}
    </div>
  );
}

function PaymentMethodsPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.list({ pageSize: 100 }),
  });

  const form = useForm<{
    name: string;
    type: PaymentMethod["type"];
    isActive: boolean;
  }>({
    defaultValues: { name: "", type: "BANK_TRANSFER", isActive: true },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: {
      name: string;
      type: PaymentMethod["type"];
      isActive: boolean;
    }) => {
      if (editing) return paymentMethodsApi.update(editing.id, values);
      return paymentMethodsApi.create(values);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Save failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentMethodsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });

  const items = query.data?.data ?? [];

  return (
    <ReferencePanel
      title="Payment methods"
      onAdd={() => {
        setEditing(null);
        setError(null);
        form.reset({ name: "", type: "BANK_TRANSFER", isActive: true });
        setOpen(true);
      }}
      loading={query.isLoading}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{labelize(item.type)}</TableCell>
              <TableCell>
                <Badge variant={item.isActive ? "success" : "muted"}>
                  {item.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(item);
                      setError(null);
                      form.reset({
                        name: item.name,
                        type: item.type,
                        isActive: item.isActive,
                      });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit payment method" : "Add payment method"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setError(null);
              saveMutation.mutate(values);
            })}
          >
            <FormField label="Name" htmlFor="pm-name">
              <Input id="pm-name" {...form.register("name", { required: true })} />
            </FormField>
            <FormField label="Type" htmlFor="pm-type">
              <Select id="pm-type" {...form.register("type")}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="OTHER">Other</option>
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="pm-active">
              <Select
                id="pm-active"
                value={form.watch("isActive") ? "true" : "false"}
                onChange={(event) =>
                  form.setValue("isActive", event.target.value === "true")
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </FormField>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title="Remove payment method?"
        description="Methods in use are deactivated instead of deleted."
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </ReferencePanel>
  );
}

function ExpenseCategoriesPanel() {
  return (
    <CategoryPanel
      title="Expense categories"
      queryKey="expense-categories"
      list={() => expenseCategoriesApi.list({ pageSize: 100 })}
      create={(body) => expenseCategoriesApi.create(body)}
      update={(id, body) => expenseCategoriesApi.update(id, body)}
      remove={(id) => expenseCategoriesApi.remove(id)}
      mapRow={(item: ExpenseCategory) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        locked: item.isSystem,
        meta: item.isSystem ? "System" : undefined,
        count: item._count?.expenses,
      })}
    />
  );
}

function SubscriptionCategoriesPanel() {
  return (
    <CategoryPanel
      title="Subscription categories"
      queryKey="subscription-categories"
      list={() => subscriptionCategoriesApi.list({ pageSize: 100 })}
      create={(body) => subscriptionCategoriesApi.create(body)}
      update={(id, body) => subscriptionCategoriesApi.update(id, body)}
      remove={(id) => subscriptionCategoriesApi.remove(id)}
      mapRow={(item: SubscriptionCategory) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        locked: false,
        count: item._count?.subscriptions,
      })}
    />
  );
}

function CategoryPanel<T>({
  title,
  queryKey,
  list,
  create,
  update,
  remove,
  mapRow,
}: {
  title: string;
  queryKey: string;
  list: () => Promise<{ data: T[] }>;
  create: (body: {
    name: string;
    slug: string;
    description?: string | null;
  }) => Promise<unknown>;
  update: (
    id: string,
    body: { name: string; slug: string; description?: string | null },
  ) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  mapRow: (item: T) => {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    locked?: boolean;
    meta?: string;
    count?: number;
  };
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [queryKey],
    queryFn: list,
  });

  const form = useForm<{
    name: string;
    slug: string;
    description: string;
  }>({
    defaultValues: { name: "", slug: "", description: "" },
  });

  const rows = useMemo(
    () => (query.data?.data ?? []).map(mapRow),
    [query.data, mapRow],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: {
      name: string;
      slug: string;
      description: string;
    }) => {
      const body = {
        name: values.name,
        slug: values.slug || slugify(values.name),
        description: values.description || null,
      };
      if (editingId) return update(editingId, body);
      return create(body);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Save failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove(id),
    onSuccess: async () => {
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  return (
    <ReferencePanel
      title={title}
      onAdd={() => {
        setEditingId(null);
        setError(null);
        form.reset({ name: "", slug: "", description: "" });
        setOpen(true);
      }}
      loading={query.isLoading}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {row.name}
                  {row.meta ? <Badge variant="muted">{row.meta}</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.slug}</TableCell>
              <TableCell>{row.count ?? 0}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(row.id);
                      setError(null);
                      form.reset({
                        name: row.name,
                        slug: row.slug,
                        description: row.description ?? "",
                      });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={row.locked}
                    onClick={() => setDeletingId(row.id)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit category" : "Add category"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setError(null);
              saveMutation.mutate(values);
            })}
          >
            <FormField label="Name" htmlFor="cat-name">
              <Input
                id="cat-name"
                {...form.register("name", {
                  required: true,
                  onChange: (event) => {
                    if (!editingId) {
                      form.setValue("slug", slugify(event.target.value));
                    }
                  },
                })}
              />
            </FormField>
            <FormField label="Slug" htmlFor="cat-slug">
              <Input id="cat-slug" {...form.register("slug", { required: true })} />
            </FormField>
            <FormField label="Description" htmlFor="cat-description">
              <Textarea id="cat-description" {...form.register("description")} />
            </FormField>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingId)}
        onOpenChange={(value) => !value && setDeletingId(null)}
        title="Delete category?"
        description="Categories with linked records cannot be deleted."
        loading={deleteMutation.isPending}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />
    </ReferencePanel>
  );
}

function ReferencePanel({
  title,
  onAdd,
  loading,
  children,
}: {
  title: string;
  onAdd: () => void;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button type="button" onClick={onAdd}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">{children}</div>
      )}
    </div>
  );
}
