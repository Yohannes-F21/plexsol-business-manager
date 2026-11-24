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
  AlertTriangle,
  CalendarClock,
  FileSignature,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  maintenanceAgreementCreateSchema,
  type MaintenanceAgreementCreateInput,
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
import { projectsApi } from "@/features/projects/api";
import { fetchReport } from "@/features/reports/api";
import { ApiError } from "@/lib/api";
import { formatDate, formatMoney, labelize, toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listBillingCycles,
  maintenanceAgreementsApi,
  type BillingCycle,
  type MaintenanceAgreement,
} from "./api";

function currentMonthId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isDueThisMonth(dueDate: string) {
  const monthId = currentMonthId();
  return dueDate.slice(0, 7) === monthId;
}

const agreementStatusVariant: Record<
  MaintenanceAgreement["status"],
  "success" | "warning" | "muted"
> = {
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "muted",
};

const cycleStatusVariant: Record<
  string,
  "success" | "warning" | "danger" | "muted" | "default"
> = {
  PENDING: "warning",
  PARTIALLY_PAID: "default",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "muted",
};

type MaintenanceTab = "agreements" | "cycles";

function MaintenanceTabs({
  active,
  onChange,
}: {
  active: MaintenanceTab;
  onChange: (tab: MaintenanceTab) => void;
}) {
  const tabs: Array<{ id: MaintenanceTab; label: string }> = [
    { id: "agreements", label: "Agreements" },
    { id: "cycles", label: "Billing Cycles" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Maintenance views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              selected
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {selected ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [cycleStatus, setCycleStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<MaintenanceTab>("agreements");
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
    queryKey: ["billing-cycles", { page, cycleStatus }],
    queryFn: () =>
      listBillingCycles({
        page,
        pageSize: 20,
        status: cycleStatus === "all" ? undefined : cycleStatus,
      }),
    enabled: tab === "cycles",
  });

  const kpiQueries = useQueries({
    queries: [
      {
        queryKey: ["maintenance-agreements", "count", "ACTIVE"],
        queryFn: () =>
          maintenanceAgreementsApi.list({
            page: 1,
            pageSize: 1,
            status: "ACTIVE",
          }),
        staleTime: 30_000,
      },
      {
        queryKey: ["billing-cycles", "count", "OVERDUE"],
        queryFn: () =>
          listBillingCycles({ page: 1, pageSize: 1, status: "OVERDUE" }),
        staleTime: 30_000,
      },
      {
        queryKey: ["billing-cycles", "kpi", "pending-sample"],
        queryFn: () =>
          listBillingCycles({ page: 1, pageSize: 100, status: "PENDING" }),
        staleTime: 30_000,
      },
      {
        queryKey: ["billing-cycles", "kpi", "partial-sample"],
        queryFn: () =>
          listBillingCycles({
            page: 1,
            pageSize: 100,
            status: "PARTIALLY_PAID",
          }),
        staleTime: 30_000,
      },
    ],
  });

  const reportQuery = useQuery({
    queryKey: ["reports", "maintenance-kpi", currentMonthId()],
    queryFn: () => fetchReport({ preset: "month", month: currentMonthId() }),
    staleTime: 60_000,
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
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
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

  const activeAgreements = kpiQueries[0]?.data?.meta.total ?? 0;
  const overdueCycles = kpiQueries[1]?.data?.meta.total ?? 0;
  const dueThisMonth = useMemo(() => {
    const pending = kpiQueries[2]?.data?.data ?? [];
    const partial = kpiQueries[3]?.data?.data ?? [];
    return [...pending, ...partial].filter((cycle) =>
      isDueThisMonth(cycle.dueDate),
    ).length;
  }, [kpiQueries]);
  const monthlyRecurring =
    reportQuery.data?.data?.totals.recurringMaintenanceMonthlyEtb ?? null;

  const openCreate = () => {
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
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Maintenance"
        description="Maintenance agreements, billing cycles, and collections."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-5" />
            New Agreement
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <SummaryCard
          label="Active Agreements"
          value={activeAgreements}
          tone="primary"
          icon={<FileSignature className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Due This Month"
          value={dueThisMonth}
          tone="warning"
          hint="Pending or partially paid"
          icon={<CalendarClock className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Overdue"
          value={overdueCycles}
          tone="danger"
          icon={<AlertTriangle className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Monthly Recurring"
          value={
            monthlyRecurring !== null
              ? formatMoney(monthlyRecurring, "ETB")
              : "—"
          }
          tone="success"
          hint="Normalized to monthly ETB"
          icon={<Wallet className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <MaintenanceTabs
        active={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
      />

      {tab === "agreements" ? (
        <>
          <ListToolbar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search project, client, or notes…"
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
              action={
                <Button type="button" onClick={openCreate}>
                  <Plus className="size-5" />
                  New Agreement
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 md:pl-6">Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead className="text-right">Cycles</TableHead>
                    <TableHead className="pr-5 text-right md:pr-6">
                      Actions
                    </TableHead>
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
                <div className="border-t border-border px-4 py-3 md:px-6">
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
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={cycleStatus}
              onChange={(event) => {
                setCycleStatus(event.target.value);
                setPage(1);
              }}
              className="w-48"
              aria-label="Filter billing cycles by status"
            >
              <option value="all">Status: All</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>

          {cyclesQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-8" />
            </div>
          ) : cycles.length === 0 ? (
            <EmptyState
              title="No billing cycles"
              description="Generate cycles from an active agreement."
            />
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 md:pl-6">Project</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead className="pr-5 md:pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle) => (
                    <CycleRow key={cycle.id} cycle={cycle} />
                  ))}
                </TableBody>
              </Table>
              {cyclesQuery.data?.meta ? (
                <div className="border-t border-border px-4 py-3 md:px-6">
                  <PaginationBar
                    page={cyclesQuery.data.meta.page}
                    pageSize={cyclesQuery.data.meta.pageSize}
                    total={cyclesQuery.data.meta.total}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>
          )}
        </>
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
      <TableCell className="pl-5 md:pl-6">
        <p className="font-medium text-foreground">
          {agreement.project?.client?.name ?? "—"}
        </p>
      </TableCell>
      <TableCell>
        <Link
          to={`/projects/${agreement.projectId}`}
          className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
        >
          {agreement.project?.name ?? "—"}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {labelize(agreement.billingFrequency)}
      </TableCell>
      <TableCell className="tabular-nums font-medium">
        {formatMoney(agreement.amount, agreement.currencyCode)}
      </TableCell>
      <TableCell>
        <Badge variant={agreementStatusVariant[agreement.status]}>
          {labelize(agreement.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(agreement.startDate)}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {agreement._count?.billingCycles ?? 0}
      </TableCell>
      <TableCell className="pr-5 text-right md:pr-6">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={agreement.status !== "ACTIVE" || generating}
          onClick={onGenerate}
          aria-label={`Generate cycles for ${agreement.project?.name ?? "agreement"}`}
          title="Generate cycles"
        >
          <RefreshCw className="size-5" strokeWidth={1.75} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function CycleRow({ cycle }: { cycle: BillingCycle }) {
  const outstanding = Number(cycle.amount) - Number(cycle.amountAllocated);
  return (
    <TableRow>
      <TableCell className="pl-5 md:pl-6">
        <p className="font-medium text-foreground">
          {cycle.agreement?.project?.name ?? "—"}
        </p>
        <p className="text-xs leading-[18px] text-muted-foreground">
          {cycle.agreement?.project?.client?.name}
        </p>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(cycle.periodStart)} → {formatDate(cycle.periodEnd)}
      </TableCell>
      <TableCell className="text-sm tabular-nums text-muted-foreground">
        {formatDate(cycle.dueDate)}
      </TableCell>
      <TableCell className="tabular-nums font-medium">
        {formatMoney(cycle.amount, cycle.currencyCode)}
      </TableCell>
      <TableCell className="tabular-nums font-medium">
        {formatMoney(
          outstanding > 0 ? String(outstanding) : "0",
          cycle.currencyCode,
        )}
      </TableCell>
      <TableCell className="pr-5 md:pr-6">
        <Badge variant={cycleStatusVariant[cycle.status] ?? "outline"}>
          {labelize(cycle.status)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
