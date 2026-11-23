import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  clientCreateSchema,
  type ClientCreateInput,
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
import { ApiError } from "@/lib/api";
import { clientsApi, type Client } from "./api";

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ["clients", { search, activeFilter, page }] as const,
    [search, activeFilter, page],
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      clientsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        isActive: activeFilter === "all" ? undefined : activeFilter,
      }),
  });

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema) as never,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      notes: "",
      isActive: true,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ClientCreateInput) => {
      if (editing) {
        return clientsApi.update(editing.id, values);
      }
      return clientsApi.create(values);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to save client",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    form.reset({
      name: "",
      email: "",
      phone: "",
      company: "",
      notes: "",
      isActive: true,
    });
    setFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setFormError(null);
    form.reset({
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      company: client.company ?? "",
      notes: client.notes ?? "",
      isActive: client.isActive,
    });
    setFormOpen(true);
  };

  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Clients"
        description="Manage client records used by projects and payments."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" />
            Add client
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search name, company, email…"
        filters={
          <Select
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value as typeof activeFilter);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="all">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        }
      />

      {listQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add your first client to start tracking projects."
          action={
            <Button type="button" onClick={openCreate}>
              Add client
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      to={`/clients/${client.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.company ?? "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-sm">
                      <p>{client.email ?? "—"}</p>
                      <p className="text-muted-foreground">
                        {client.phone ?? ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{client._count?.projects ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? "success" : "muted"}>
                      {client.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(client)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(client)}
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
            <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>
              Client details are shared across projects and payments.
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
              <FormField
                label="Email"
                htmlFor="email"
                error={form.formState.errors.email?.message}
              >
                <Input id="email" type="email" {...form.register("email")} />
              </FormField>
              <FormField
                label="Phone"
                htmlFor="phone"
                error={form.formState.errors.phone?.message}
              >
                <Input id="phone" {...form.register("phone")} />
              </FormField>
            </div>
            <FormField
              label="Company"
              htmlFor="company"
              error={form.formState.errors.company?.message}
            >
              <Input id="company" {...form.register("company")} />
            </FormField>
            <FormField
              label="Notes"
              htmlFor="notes"
              error={form.formState.errors.notes?.message}
            >
              <Textarea id="notes" {...form.register("notes")} />
            </FormField>
            <FormField label="Status" htmlFor="isActive">
              <Select
                id="isActive"
                value={form.watch("isActive") ? "true" : "false"}
                onChange={(event) =>
                  form.setValue("isActive", event.target.value === "true")
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
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

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete client?"
        description={
          deleting
            ? `Delete ${deleting.name}? Clients with projects or payments must be deactivated instead.`
            : ""
        }
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
