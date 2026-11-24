import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
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
import { projectsApi } from "@/features/projects/api";
import { fetchReport } from "@/features/reports/api";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { clientsApi, type Client } from "./api";
import { ClientsProjectsTabs } from "./clients-projects-tabs";
import { SummaryCard } from "@/components/crud/summary-card";

function currentMonthId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ClientsPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
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

  const countQueries = useQueries({
    queries: [
      {
        queryKey: ["clients", "count", "all"],
        queryFn: () => clientsApi.list({ page: 1, pageSize: 1 }),
        staleTime: 30_000,
      },
      {
        queryKey: ["clients", "count", "active"],
        queryFn: () =>
          clientsApi.list({ page: 1, pageSize: 1, isActive: "true" }),
        staleTime: 30_000,
      },
      {
        queryKey: ["projects", "count", "all"],
        queryFn: () => projectsApi.list({ page: 1, pageSize: 1 }),
        staleTime: 30_000,
      },
      {
        queryKey: ["projects", "count", "IN_PROGRESS"],
        queryFn: () =>
          projectsApi.list({ page: 1, pageSize: 1, status: "IN_PROGRESS" }),
        staleTime: 30_000,
      },
    ],
  });

  const reportQuery = useQuery({
    queryKey: ["reports", "clients-kpi", currentMonthId()],
    queryFn: () => fetchReport({ preset: "month", month: currentMonthId() }),
    staleTime: 60_000,
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

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (!state?.openCreate) return;
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
    navigate(location.pathname, { replace: true, state: {} });
  }, [form, location.pathname, location.state, navigate]);

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
  const totalClients = countQueries[0]?.data?.meta.total ?? 0;
  const activeClients = countQueries[1]?.data?.meta.total ?? 0;
  const totalProjects = countQueries[2]?.data?.meta.total ?? 0;
  const activeProjects = countQueries[3]?.data?.meta.total ?? 0;
  const outstanding =
    reportQuery.data?.data?.totals.outstandingClientsEtb ?? null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Clients"
        description="Manage clients, development projects, and project financials."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/projects" state={{ openCreate: true }}>
                <Plus className="size-5" />
                Add Project
              </Link>
            </Button>
            <Button type="button" onClick={openCreate}>
              <Plus className="size-5" />
              Add Client
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <SummaryCard
          label="Total Clients"
          value={totalClients}
          tone="primary"
          icon={<UserRound className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Total Projects"
          value={totalProjects}
          tone="primary"
          icon={<FolderKanban className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Active Projects"
          value={activeProjects}
          tone="success"
          hint={`${activeClients} active clients`}
          icon={<FolderKanban className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Outstanding Balance"
          value={
            outstanding !== null ? formatMoney(outstanding, "ETB") : "—"
          }
          tone="warning"
          hint="Across clients (ETB)"
          icon={<Wallet className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <ClientsProjectsTabs active="clients" />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search clients by name, contact, or company…"
        filters={
          <Select
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value as typeof activeFilter);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="all">Status: All</option>
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
              <Plus className="size-5" />
              Add Client
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-5 md:pl-6">#</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((client, index) => {
                const rowNumber =
                  ((meta?.page ?? page) - 1) * (meta?.pageSize ?? 20) +
                  index +
                  1;
                return (
                  <TableRow key={client.id}>
                    <TableCell className="pl-5 tabular-nums text-muted-foreground md:pl-6">
                      {rowNumber}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/clients/${client.id}`}
                        className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {client.name}
                      </Link>
                      {client.company ? (
                        <p className="text-xs leading-[18px] text-muted-foreground">
                          {client.company}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {client.email ? (
                          <p className="flex items-center gap-1.5 text-foreground">
                            <Mail
                              className="size-[18px] shrink-0 text-muted-foreground"
                              strokeWidth={1.75}
                            />
                            <span className="truncate">{client.email}</span>
                          </p>
                        ) : (
                          <p className="text-muted-foreground">—</p>
                        )}
                        {client.phone ? (
                          <p className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone
                              className="size-[18px] shrink-0"
                              strokeWidth={1.75}
                            />
                            {client.phone}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {client._count?.projects ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.isActive ? "success" : "muted"}>
                        {client.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right md:pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label={`View ${client.name}`}
                        >
                          <Link to={`/clients/${client.id}`}>
                            <Eye className="size-5" strokeWidth={1.75} />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${client.name}`}
                          onClick={() => openEdit(client)}
                        >
                          <Pencil className="size-5" strokeWidth={1.75} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${client.name}`}
                          onClick={() => setDeleting(client)}
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
        destructive
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
