import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RefreshCw } from "lucide-react";
import {
  maintenanceAgreementCreateSchema,
  type MaintenanceAgreementCreateInput,
} from "@plexsol/shared";
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
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, labelize, toDateInputValue } from "@/lib/format";
import {
  listBillingCycles,
  maintenanceAgreementsApi,
  type MaintenanceAgreement,
} from "./api";

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"agreements" | "cycles">("agreements");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const agreementsQuery = useQuery({
    queryKey: ["maintenance-agreements", { search, status, page }],
    queryFn: () =>
      maintenanceAgreementsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status === "all" ? undefined : status,
      }),
    enabled: tab === "agreements",
  });

  const cyclesQuery = useQuery({
    queryKey: ["billing-cycles", { page }],
    queryFn: () => listBillingCycles({ page, pageSize: 20 }),
    enabled: tab === "cycles",
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "options"],
    queryFn: () => projectsApi.list({ pageSize: 100 }),
  });

  const form = useForm<MaintenanceAgreementCreateInput>({
    resolver: zodResolver(maintenanceAgreementCreateSchema) as never,
    defaultValues: {
      projectId: "",
      billingFrequency: "MONTHLY",
      amount: "",
      currencyCode: "ETB",
      startDate: toDateInputValue(new Date()),
      endDate: null,
      status: "ACTIVE",
      notes: "",
      generateCycles: true,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: MaintenanceAgreementCreateInput) =>
      maintenanceAgreementsApi.create(values),
    onSuccess: async () => {
      setFormOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["maintenance-agreements"],
      });
      await queryClient.invalidateQueries({ queryKey: ["billing-cycles"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to save agreement",
      );
    },
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => maintenanceAgreementsApi.generateCycles(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["maintenance-agreements"],
      });
      await queryClient.invalidateQueries({ queryKey: ["billing-cycles"] });
    },
  });

  const projects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data],
  );
  const agreements = agreementsQuery.data?.data ?? [];
  const cycles = cyclesQuery.data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Maintenance"
        description="Explicit activation dates, monthly/yearly cycles, and outstanding balances per cycle."
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              form.reset({
                projectId: projects[0]?.id ?? "",
                billingFrequency: "MONTHLY",
                amount: "",
                currencyCode: projects[0]?.currencyCode ?? "ETB",
                startDate: toDateInputValue(new Date()),
                endDate: null,
                status: "ACTIVE",
                notes: "",
                generateCycles: true,
              });
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add agreement
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "agreements" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("agreements")}
        >
          Agreements
        </Button>
        <Button
          type="button"
          variant={tab === "cycles" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("cycles")}
        >
          Billing cycles
        </Button>
      </div>

      {tab === "agreements" ? (
        <>
          <ListToolbar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search project or notes…"
            filters={
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
                <option value="PAUSED">Paused</option>
                <option value="ENDED">Ended</option>
              </Select>
            }
          />

          {agreementsQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-8" />
            </div>
          ) : agreements.length === 0 ? (
            <EmptyState
              title="No maintenance agreements"
              description="Create an agreement with an explicit activation date — not tied to project delivery."
            />
          ) : (
            <div className="space-y-4 rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead>Cycles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map((agreement) => (
                    <AgreementRow
                      key={agreement.id}
                      agreement={agreement}
                      generating={generateMutation.isPending}
                      onGenerate={() => generateMutation.mutate(agreement.id)}
                    />
                  ))}
                </TableBody>
              </Table>
              {agreementsQuery.data?.meta ? (
                <div className="border-t border-border px-4 py-3">
                  <PaginationBar
                    page={agreementsQuery.data.meta.page}
                    pageSize={agreementsQuery.data.meta.pageSize}
                    total={agreementsQuery.data.meta.total}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : cyclesQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : cycles.length === 0 ? (
        <EmptyState
          title="No billing cycles"
          description="Generate cycles from an active agreement."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((cycle) => {
                const outstanding =
                  Number(cycle.amount) - Number(cycle.amountAllocated);
                return (
                  <TableRow key={cycle.id}>
                    <TableCell>
                      {cycle.agreement?.project?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {formatDate(cycle.periodStart)} →{" "}
                      {formatDate(cycle.periodEnd)}
                    </TableCell>
                    <TableCell>{formatDate(cycle.dueDate)}</TableCell>
                    <TableCell>
                      {formatMoney(cycle.amount, cycle.currencyCode)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        outstanding > 0 ? String(outstanding) : "0",
                        cycle.currencyCode,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{labelize(cycle.status)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New maintenance agreement</DialogTitle>
            <DialogDescription>
              Activation is explicit. Project delivery never auto-starts billing.
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
            <FormField label="Project" htmlFor="projectId">
              <Select id="projectId" {...form.register("projectId")}>
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
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
              <FormField label="Frequency" htmlFor="billingFrequency">
                <Select
                  id="billingFrequency"
                  {...form.register("billingFrequency")}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Activation date" htmlFor="startDate">
                <Input
                  id="startDate"
                  type="date"
                  {...form.register("startDate")}
                />
              </FormField>
              <FormField label="End date (optional)" htmlFor="endDate">
                <Input id="endDate" type="date" {...form.register("endDate")} />
              </FormField>
            </div>
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
                Create & generate cycles
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgreementRow({
  agreement,
  onGenerate,
  generating,
}: {
  agreement: MaintenanceAgreement;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link
          to={`/projects/${agreement.projectId}`}
          className="font-medium text-primary hover:underline"
        >
          {agreement.project?.name ?? "—"}
        </Link>
        <p className="text-xs text-muted-foreground">
          {agreement.project?.client?.name}
        </p>
      </TableCell>
      <TableCell>
        {formatMoney(agreement.amount, agreement.currencyCode)}
      </TableCell>
      <TableCell>{labelize(agreement.billingFrequency)}</TableCell>
      <TableCell>{formatDate(agreement.startDate)}</TableCell>
      <TableCell>{agreement._count?.billingCycles ?? 0}</TableCell>
      <TableCell>
        <Badge variant="outline">{labelize(agreement.status)}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={agreement.status !== "ACTIVE" || generating}
          onClick={onGenerate}
        >
          <RefreshCw className="size-3.5" />
          Generate
        </Button>
      </TableCell>
    </TableRow>
  );
}
