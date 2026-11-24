import { apiFetch } from "@/lib/api";
import type { ListResponse } from "@/lib/crud-api";

export type NotificationItem = {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type EmailDeliveryAttempt = {
  id: string;
  attemptNumber: number;
  status: string;
  providerResponse: string | null;
  errorMessage: string | null;
  attemptedAt: string;
};

export type EmailJobItem = {
  id: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  attempts?: EmailDeliveryAttempt[];
  approvedBy?: { id: string; name: string; email: string } | null;
  scheduledEvent?: {
    id: string;
    type: string;
    requiresApproval: boolean;
  } | null;
};

export const notificationsApi = {
  list(params?: { page?: number; pageSize?: number; isRead?: boolean }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.isRead !== undefined) search.set("isRead", String(params.isRead));
    const qs = search.toString();
    return apiFetch<
      ListResponse<NotificationItem> & { meta: { unreadCount: number } }
    >(`/api/notifications${qs ? `?${qs}` : ""}`);
  },
  markRead(id: string) {
    return apiFetch<{ data: NotificationItem }>(`/api/notifications/${id}/read`, {
      method: "POST",
    });
  },
  markAllRead() {
    return apiFetch<{ data: { updated: number } }>("/api/notifications/read-all", {
      method: "POST",
    });
  },
};

export const emailJobsApi = {
  list(params?: { page?: number; pageSize?: number; status?: string; search?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.status) search.set("status", params.status);
    if (params?.search) search.set("search", params.search);
    const qs = search.toString();
    return apiFetch<ListResponse<EmailJobItem>>(
      `/api/email-jobs${qs ? `?${qs}` : ""}`,
    );
  },
  approve(id: string) {
    return apiFetch<{ data: EmailJobItem }>(`/api/email-jobs/${id}/approve`, {
      method: "POST",
    });
  },
  reject(id: string, reason?: string) {
    return apiFetch<{ data: EmailJobItem }>(`/api/email-jobs/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? null }),
    });
  },
};
