import { ApiError, apiFetch } from "@/lib/api";
import { getDashboardFixture } from "./fixtures";
import type { DashboardSnapshot } from "../types";

/**
 * Replaceable dashboard data-access layer.
 * Tries the real API first; falls back to labeled development fixtures
 * only when `/api/dashboard` is not implemented (404/501).
 */
export async function getDashboardSnapshot(
  periodId?: string,
): Promise<DashboardSnapshot> {
  const query = periodId
    ? `?period=${encodeURIComponent(periodId)}`
    : "";

  try {
    const data = await apiFetch<DashboardSnapshot>(`/api/dashboard${query}`);
    return {
      ...data,
      source: "api",
      reportingCurrency: "ETB",
    };
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 501)
    ) {
      return getDashboardFixture(periodId);
    }

    throw error;
  }
}
