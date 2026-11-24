import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Mail,
  MailWarning,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { PaginationBar } from "@/components/crud/pagination-bar";
import { SummaryCard } from "@/components/crud/summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  emailJobsApi,
  notificationsApi,
  type EmailJobItem,
  type NotificationItem,
} from "./api";

type Tab = "inbox" | "approval" | "failed";

function NotificationTabs({
  active,
  onChange,
  unreadCount,
  approvalCount,
  failedCount,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  unreadCount: number;
  approvalCount: number;
  failedCount: number;
}) {
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "inbox", label: "Inbox", count: unreadCount },
    { id: "approval", label: "Pending Approvals", count: approvalCount },
    { id: "failed", label: "Delivery Failures", count: failedCount },
  ];

  return (
    <div
      role="tablist"
      aria-label="Notification views"
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
              "relative inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              selected
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {selected ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function EmailPreview({
  job,
  footer,
}: {
  job: EmailJobItem | null;
  footer?: ReactNode;
}) {
  if (!job) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-72 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">
            Select a message to preview.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-6">
            {job.subject}
          </CardTitle>
          <Badge
            variant={
              job.status === "AWAITING_APPROVAL"
                ? "warning"
                : job.status === "FAILED"
                  ? "danger"
                  : "muted"
            }
          >
            {job.status === "AWAITING_APPROVAL"
              ? "Needs Approval"
              : job.status === "FAILED"
                ? "Failed"
                : job.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          To {job.toEmail}
          {job.scheduledEvent?.type
            ? ` · ${job.scheduledEvent.type.replaceAll("_", " ")}`
            : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-0">
        <div className="min-h-48 flex-1 overflow-auto rounded-[14px] border border-border bg-muted/20 p-4">
          {job.bodyHtml ? (
            <div
              className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: job.bodyHtml }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
              {job.bodyText ?? "No preview body."}
            </pre>
          )}
        </div>
        {footer ? <div className="flex flex-wrap gap-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function InboxPreview({ item }: { item: NotificationItem | null }) {
  if (!item) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-72 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">
            Select a notification to read.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-6">
            {item.title}
          </CardTitle>
          <Badge variant={item.isRead ? "muted" : "warning"}>
            {item.isRead ? "Read" : "Unread"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(item.createdAt)}
          {item.type ? ` · ${item.type.replaceAll("_", " ")}` : ""}
        </p>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {item.body}
        </p>
      </CardContent>
    </Card>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("inbox");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const countQueries = useQueries({
    queries: [
      {
        queryKey: ["notifications", "count", "unread"],
        queryFn: () =>
          notificationsApi.list({ page: 1, pageSize: 1, isRead: false }),
        staleTime: 30_000,
      },
      {
        queryKey: ["email-jobs", "count", "AWAITING_APPROVAL"],
        queryFn: () =>
          emailJobsApi.list({
            page: 1,
            pageSize: 1,
            status: "AWAITING_APPROVAL",
          }),
        staleTime: 30_000,
      },
      {
        queryKey: ["email-jobs", "count", "FAILED"],
        queryFn: () =>
          emailJobsApi.list({ page: 1, pageSize: 1, status: "FAILED" }),
        staleTime: 30_000,
      },
    ],
  });

  const inboxQuery = useQuery({
    queryKey: ["notifications", { page }],
    queryFn: () => notificationsApi.list({ page, pageSize: 20 }),
    enabled: tab === "inbox",
  });

  const approvalQuery = useQuery({
    queryKey: ["email-jobs", "approval", { page }],
    queryFn: () =>
      emailJobsApi.list({
        page,
        pageSize: 20,
        status: "AWAITING_APPROVAL",
      }),
    enabled: tab === "approval",
  });

  const failedQuery = useQuery({
    queryKey: ["email-jobs", "failed", { page }],
    queryFn: () =>
      emailJobsApi.list({
        page,
        pageSize: 20,
        status: "FAILED",
      }),
    enabled: tab === "failed",
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => emailJobsApi.approve(id),
    onSuccess: () => {
      setActionError(null);
      setSelectedJobId(null);
      void queryClient.invalidateQueries({ queryKey: ["email-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : "Approval failed",
      );
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) => emailJobsApi.reject(id),
    onSuccess: () => {
      setActionError(null);
      setSelectedJobId(null);
      void queryClient.invalidateQueries({ queryKey: ["email-jobs"] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : "Reject failed",
      );
    },
  });

  const unreadCount =
    countQueries[0]?.data?.meta.unreadCount ??
    inboxQuery.data?.meta.unreadCount ??
    0;
  const approvalCount = countQueries[1]?.data?.meta.total ?? 0;
  const failedCount = countQueries[2]?.data?.meta.total ?? 0;

  const inboxItems = inboxQuery.data?.data ?? [];
  const approvalItems = approvalQuery.data?.data ?? [];
  const failedItems = failedQuery.data?.data ?? [];

  const effectiveInboxId = selectedInboxId ?? inboxItems[0]?.id ?? null;
  const effectiveJobId =
    selectedJobId ??
    (tab === "approval" ? approvalItems[0]?.id : failedItems[0]?.id) ??
    null;

  const selectedInbox = useMemo(
    () => inboxItems.find((item) => item.id === effectiveInboxId) ?? null,
    [inboxItems, effectiveInboxId],
  );
  const selectedApproval = useMemo(
    () => approvalItems.find((job) => job.id === effectiveJobId) ?? null,
    [approvalItems, effectiveJobId],
  );
  const selectedFailed = useMemo(
    () => failedItems.find((job) => job.id === effectiveJobId) ?? null,
    [failedItems, effectiveJobId],
  );

  useEffect(() => {
    if (tab === "inbox") {
      if (!selectedInboxId && inboxItems[0]) {
        setSelectedInboxId(inboxItems[0].id);
      } else if (
        selectedInboxId &&
        inboxItems.length > 0 &&
        !inboxItems.some((item) => item.id === selectedInboxId)
      ) {
        setSelectedInboxId(inboxItems[0]?.id ?? null);
      }
      return;
    }

    const jobs = tab === "approval" ? approvalItems : failedItems;
    if (!selectedJobId && jobs[0]) {
      setSelectedJobId(jobs[0].id);
    } else if (
      selectedJobId &&
      jobs.length > 0 &&
      !jobs.some((job) => job.id === selectedJobId)
    ) {
      setSelectedJobId(jobs[0]?.id ?? null);
    }
  }, [
    tab,
    inboxItems,
    approvalItems,
    failedItems,
    selectedInboxId,
    selectedJobId,
  ]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
    setActionError(null);
    setSelectedInboxId(null);
    setSelectedJobId(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Notifications"
        description="In-app alerts, overdue email drafts awaiting approval, and failed deliveries."
        actions={
          tab === "inbox" ? (
            <Button
              variant="outline"
              disabled={markAllRead.isPending || unreadCount === 0}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="size-5" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 xl:gap-5">
        <SummaryCard
          label="Unread"
          value={unreadCount}
          tone="primary"
          icon={<Bell className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Pending Approvals"
          value={approvalCount}
          tone="warning"
          hint="Overdue emails never send automatically"
          icon={<ShieldAlert className="size-5" strokeWidth={1.75} />}
        />
        <SummaryCard
          label="Delivery Failures"
          value={failedCount}
          tone="danger"
          hint="After up to three attempts"
          icon={<MailWarning className="size-5" strokeWidth={1.75} />}
        />
      </div>

      <NotificationTabs
        active={tab}
        onChange={changeTab}
        unreadCount={unreadCount}
        approvalCount={approvalCount}
        failedCount={failedCount}
      />

      {actionError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {tab === "inbox" ? (
        inboxQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-8" />
          </div>
        ) : inboxItems.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-8" />}
            title="No notifications"
            description="Reminders and delivery alerts will appear here."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-5">
            <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
              <ul className="divide-y divide-border">
                {inboxItems.map((item) => {
                  const selected = item.id === effectiveInboxId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 md:px-5",
                          selected
                            ? "bg-primary-subtle/60"
                            : "hover:bg-muted/40",
                          !item.isRead && !selected ? "bg-muted/20" : null,
                        )}
                        onClick={() => {
                          setSelectedInboxId(item.id);
                          if (!item.isRead) markRead.mutate(item.id);
                        }}
                      >
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                            item.isRead
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary-subtle text-primary",
                          )}
                        >
                          <Bell className="size-5" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className={cn(
                                "truncate text-sm text-foreground",
                                !item.isRead && "font-semibold",
                              )}
                            >
                              {item.title}
                            </p>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.body}
                          </p>
                          {!item.isRead ? (
                            <Badge variant="warning" className="mt-2">
                              Unread
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {inboxQuery.data?.meta ? (
                <div className="border-t border-border px-4 py-3 md:px-5">
                  <PaginationBar
                    page={page}
                    pageSize={inboxQuery.data.meta.pageSize}
                    total={inboxQuery.data.meta.total}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>
            <InboxPreview item={selectedInbox} />
          </div>
        )
      ) : null}

      {tab === "approval" ? (
        approvalQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-8" />
          </div>
        ) : approvalItems.length === 0 ? (
          <EmptyState
            icon={<MailWarning className="size-8" />}
            title="No drafts awaiting approval"
            description="Overdue payment emails are never sent automatically."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-5">
            <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 md:pl-6">Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="pr-5 md:pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalItems.map((job) => {
                    const selected = job.id === effectiveJobId;
                    return (
                      <TableRow
                        key={job.id}
                        className={cn(
                          "cursor-pointer",
                          selected && "bg-primary-subtle/50",
                        )}
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        <TableCell className="pl-5 md:pl-6">
                          <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-warning-background text-warning">
                            <Mail className="size-5" strokeWidth={1.75} />
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {job.subject}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {job.scheduledEvent?.type?.replaceAll("_", " ") ??
                              "Email draft"}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.toEmail}
                        </TableCell>
                        <TableCell className="pr-5 md:pr-6">
                          <span className="text-sm font-medium text-warning">
                            Needs Approval
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {approvalQuery.data?.meta ? (
                <div className="border-t border-border px-4 py-3 md:px-6">
                  <PaginationBar
                    page={page}
                    pageSize={approvalQuery.data.meta.pageSize}
                    total={approvalQuery.data.meta.total}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>

            <EmailPreview
              job={selectedApproval}
              footer={
                selectedApproval ? (
                  isAdmin ? (
                    <>
                      <Button
                        type="button"
                        disabled={approve.isPending || reject.isPending}
                        onClick={() => approve.mutate(selectedApproval.id)}
                      >
                        Approve & Send
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={approve.isPending || reject.isPending}
                        onClick={() => reject.mutate(selectedApproval.id)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Admin approval required
                    </p>
                  )
                ) : null
              }
            />
          </div>
        )
      ) : null}

      {tab === "failed" ? (
        failedQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-8" />
          </div>
        ) : failedItems.length === 0 ? (
          <EmptyState
            icon={<MailWarning className="size-8" />}
            title="No delivery failures"
            description="Failed sends (after up to three attempts) will be listed here."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-5">
            <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 md:pl-6">Subject</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead className="pr-5 md:pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedItems.map((job) => {
                    const selected = job.id === effectiveJobId;
                    return (
                      <TableRow
                        key={job.id}
                        className={cn(
                          "cursor-pointer",
                          selected && "bg-danger-background/40",
                        )}
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        <TableCell className="pl-5 font-medium md:pl-6">
                          {job.subject}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.toEmail}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {job.attemptCount}/{job.maxAttempts}
                        </TableCell>
                        <TableCell className="pr-5 md:pr-6">
                          <Badge variant="danger">Failed</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {failedQuery.data?.meta ? (
                <div className="border-t border-border px-4 py-3 md:px-6">
                  <PaginationBar
                    page={page}
                    pageSize={failedQuery.data.meta.pageSize}
                    total={failedQuery.data.meta.total}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>

            <EmailPreview
              job={selectedFailed}
              footer={
                selectedFailed ? (
                  <div className="w-full space-y-2">
                    <p className="text-sm text-destructive">
                      {selectedFailed.lastError ?? "Delivery failed"}
                    </p>
                    {selectedFailed.attempts?.length ? (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {selectedFailed.attempts.map((attempt) => (
                          <li key={attempt.id}>
                            Attempt #{attempt.attemptNumber}: {attempt.status}
                            {attempt.errorMessage
                              ? ` — ${attempt.errorMessage}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null
              }
            />
          </div>
        )
      ) : null}
    </div>
  );
}
