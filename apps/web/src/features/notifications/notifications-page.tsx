import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, MailWarning } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { PaginationBar } from "@/components/crud/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { emailJobsApi, notificationsApi } from "./api";

type Tab = "inbox" | "approval" | "failed";

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("inbox");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

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
      void queryClient.invalidateQueries({ queryKey: ["email-jobs"] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : "Reject failed",
      );
    },
  });

  const unreadCount = inboxQuery.data?.meta.unreadCount ?? 0;

  const tabs = useMemo(
    () =>
      [
        { id: "inbox" as const, label: "Inbox", count: unreadCount },
        { id: "approval" as const, label: "Email approval" },
        { id: "failed" as const, label: "Delivery failures" },
      ] as const,
    [unreadCount],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Notifications"
        description="In-app alerts, overdue email drafts awaiting approval, and failed deliveries."
        actions={
          tab === "inbox" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={markAllRead.isPending || unreadCount === 0}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setTab(item.id);
              setPage(1);
              setActionError(null);
            }}
          >
            {item.label}
            {"count" in item && item.count > 0 ? (
              <Badge className="ml-2">{item.count}</Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      {tab === "inbox" ? (
        inboxQuery.isLoading ? (
          <Spinner />
        ) : !inboxQuery.data?.data.length ? (
          <EmptyState
            icon={<Bell className="size-8" />}
            title="No notifications"
            description="Reminders and delivery alerts will appear here."
          />
        ) : (
          <div className="space-y-3">
            {inboxQuery.data.data.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`w-full rounded-lg border border-border px-4 py-3 text-left transition hover:bg-muted/40 ${
                  item.isRead ? "opacity-70" : "bg-muted/20"
                }`}
                onClick={() => {
                  if (!item.isRead) markRead.mutate(item.id);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>{formatDate(item.createdAt)}</div>
                    {!item.isRead ? (
                      <Badge className="mt-1" variant="secondary">
                        Unread
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
            <PaginationBar
              page={page}
              pageSize={inboxQuery.data.meta.pageSize}
              total={inboxQuery.data.meta.total}
              onPageChange={setPage}
            />
          </div>
        )
      ) : null}

      {tab === "approval" ? (
        approvalQuery.isLoading ? (
          <Spinner />
        ) : !approvalQuery.data?.data.length ? (
          <EmptyState
            icon={<MailWarning className="size-8" />}
            title="No drafts awaiting approval"
            description="Overdue payment emails are never sent automatically."
          />
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalQuery.data.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="font-medium">{job.subject}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {job.bodyText ?? "HTML draft"}
                      </p>
                    </TableCell>
                    <TableCell>{job.toEmail}</TableCell>
                    <TableCell>{formatDate(job.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(job.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reject.isPending}
                            onClick={() => reject.mutate(job.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Admin approval required
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              pageSize={approvalQuery.data.meta.pageSize}
              total={approvalQuery.data.meta.total}
              onPageChange={setPage}
            />
          </div>
        )
      ) : null}

      {tab === "failed" ? (
        failedQuery.isLoading ? (
          <Spinner />
        ) : !failedQuery.data?.data.length ? (
          <EmptyState
            icon={<MailWarning className="size-8" />}
            title="No delivery failures"
            description="Failed sends (after up to three attempts) will be listed here."
          />
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedQuery.data.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.subject}</TableCell>
                    <TableCell>{job.toEmail}</TableCell>
                    <TableCell>
                      {job.attemptCount}/{job.maxAttempts}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-destructive">
                      {job.lastError ?? "Delivery failed"}
                      {job.attempts?.length ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {job.attempts.map((attempt) => (
                            <li key={attempt.id}>
                              #{attempt.attemptNumber} {attempt.status}
                              {attempt.errorMessage
                                ? `: ${attempt.errorMessage}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              pageSize={failedQuery.data.meta.pageSize}
              total={failedQuery.data.meta.total}
              onPageChange={setPage}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
