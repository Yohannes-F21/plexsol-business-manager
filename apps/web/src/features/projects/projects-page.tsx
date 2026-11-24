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
  CirclePause,
  Eye,
  FolderKanban,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  projectCreateSchema,
  type ProjectCreateInput,
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
import { ClientsProjectsTabs } from "@/features/clients/clients-projects-tabs";
import { SummaryCard } from "@/components/crud/summary-card";
import { clientsApi } from "@/features/clients/api";
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, labelize, toDateInputValue } from "@/lib/format";
import { projectsApi, type Project } from "./api";

const projectStatusVariant: Record<
  Project["status"],
  "success" | "default" | "warning" | "muted"
> = {
  IN_PROGRESS: "success",
  COMPLETED: "default",
  ON_HOLD: "warning",
  CANCELLED: "muted",
};

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["projects", { search, status, page }],
    queryFn: () =>
      projectsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status === "all" ? undefined : status,
      }),
  });

  const countQueries = useQueries({
    queries: [
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
      {
        queryKey: ["projects", "count", "COMPLETED"],
        queryFn: () =>
          projectsApi.list({ page: 1, pageSize: 1, status: "COMPLETED" }),
        staleTime: 30_000,
      },
      {
        queryKey: ["projects", "count", "ON_HOLD"],
        queryFn: () =>
          projectsApi.list({ page: 1, pageSize: 1, status: "ON_HOLD" }),
        staleTime: 30_000,
      },
    ],
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", "options"],
    queryFn: () => clientsApi.list({ pageSize: 100, isActive: "true" }),
  });

  const form = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema) as never,
    defaultValues: {
      clientId: "",
      name: "",
      description: "",
      status: "IN_PROGRESS",
      agreedPrice: "",
      currencyCode: "ETB",
      startDate: "",
      endDate: "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ProjectCreateInput) => {
      const payload = {
        ...values,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      };
      if (editing) return projectsApi.update(editing.id, payload);
      return projectsApi.create(payload);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to save project",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const clientOptions = useMemo(
    () => clientsQuery.data?.data ?? [],
    [clientsQuery.data],
  );

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    form.reset({
      clientId: clientOptions[0]?.id ?? "",
      name: "",
      description: "",
      status: "IN_PROGRESS",
      agreedPrice: "",
      currencyCode: "ETB",
      startDate: "",
      endDate: "",
    });
    setFormOpen(true);
  };

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (!state?.openCreate) return;
    setEditing(null);
    setFormError(null);
    form.reset({
      clientId: clientOptions[0]?.id ?? "",
      name: "",
      description: "",
      status: "IN_PROGRESS",
      agreedPrice: "",
      currencyCode: "ETB",
      startDate: "",
      endDate: "",
    });
    setFormOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [clientOptions, form, location.pathname, location.state, navigate]);

  const openEdit = (project: Project) => {
    setEditing(project);
    setFormError(null);
    form.reset({
      clientId: project.clientId,
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      agreedPrice: project.agreedPrice,
      currencyCode: project.currencyCode,
      startDate: toDateInputValue(project.startDate),
      endDate: toDateInputValue(project.endDate),
    });
    setFormOpen(true);
  };

  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const totalProjects = countQueries[0]?.data?.meta.total ?? 0;
  const inProgress = countQueries[1]?.data?.meta.total ?? 0;
  const completed = countQueries[2]?.data?.meta.total ?? 0;
  const onHold = countQueries[3]?.data?.meta.total ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Projects"
        description="Manage clients, development projects, and project financials."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/clients" state={{ openCreate: true }}>
                <Plus className="size-5" />
                Add Client
              </Link>
            </Button>
            <Button type="button" onClick={openCreate}>
              <Plus className="size-5" />
              Add Project
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <SummaryCard
          label="Total Projects"
          value={totalProjects}
          tone="primary"
          icon={<FolderKanban className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="In Progress"
          value={inProgress}
          tone="success"
          icon={<CheckCircle2 className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Completed"
          value={completed}
          tone="primary"
          icon={<CheckCircle2 className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="On Hold"
          value={onHold}
          tone="warning"
          icon={<CirclePause className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <ClientsProjectsTabs active="projects" />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search projects by name or client…"
        filters={
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="all">Status: All</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On hold</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        }
      />

      {listQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project with an agreed development price."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="size-5" />
              Add Project
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 md:pl-6">Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Agreed Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="pl-5 md:pl-6">
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {project.client ? (
                      <Link
                        to={`/clients/${project.client.id}`}
                        className="text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {project.client.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(project.agreedPrice, project.currencyCode)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={projectStatusVariant[project.status]}>
                      {labelize(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatDate(project.startDate)} →{" "}
                    {formatDate(project.endDate)}
                  </TableCell>
                  <TableCell className="pr-5 text-right md:pr-6">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`View ${project.name}`}
                      >
                        <Link to={`/projects/${project.id}`}>
                          <Eye className="size-5" strokeWidth={1.75} />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => openEdit(project)}
                      >
                        <Pencil className="size-5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => setDeleting(project)}
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit project" : "Add project"}
            </DialogTitle>
            <DialogDescription>
              Agreed price is contractual scope — not payment status.
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
              label="Client"
              htmlFor="clientId"
              error={form.formState.errors.clientId?.message}
            >
              <Select id="clientId" {...form.register("clientId")}>
                <option value="">Select client</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Name"
              htmlFor="name"
              error={form.formState.errors.name?.message}
            >
              <Input id="name" {...form.register("name")} />
            </FormField>
            <FormField
              label="Description"
              htmlFor="description"
              error={form.formState.errors.description?.message}
            >
              <Textarea id="description" {...form.register("description")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Agreed price"
                htmlFor="agreedPrice"
                error={form.formState.errors.agreedPrice?.message}
              >
                <Input
                  id="agreedPrice"
                  className="tabular-nums"
                  {...form.register("agreedPrice")}
                />
              </FormField>
              <FormField
                label="Currency"
                htmlFor="currencyCode"
                error={form.formState.errors.currencyCode?.message}
              >
                <Input
                  id="currencyCode"
                  maxLength={3}
                  {...form.register("currencyCode")}
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Status" htmlFor="status">
                <Select id="status" {...form.register("status")}>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ON_HOLD">On hold</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </FormField>
              <FormField label="Start date" htmlFor="startDate">
                <Input
                  id="startDate"
                  type="date"
                  {...form.register("startDate")}
                />
              </FormField>
              <FormField label="End date" htmlFor="endDate">
                <Input id="endDate" type="date" {...form.register("endDate")} />
              </FormField>
            </div>
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
        title="Delete project?"
        description={
          deleting
            ? `Delete ${deleting.name}? Projects with payments or maintenance must be cancelled instead.`
            : ""
        }
        loading={deleteMutation.isPending}
        destructive
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
