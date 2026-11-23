import { AttentionPanel } from "@/features/dashboard/components/attention-panel";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { FinancialOverviewChart } from "@/features/dashboard/components/financial-overview-chart";
import { FixtureBanner } from "@/features/dashboard/components/fixture-banner";
import { KpiCards } from "@/features/dashboard/components/kpi-cards";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { StatusSummaryCards } from "@/features/dashboard/components/status-summary-cards";
import { SubscriptionRenewals } from "@/features/dashboard/components/subscription-renewals";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function DashboardPage() {
  const { data, isLoading, isError, refetch, periodId, setPeriodId } =
    useDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Unable to load dashboard"
        description="Check your connection and try again."
        action={
          <Button type="button" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <DashboardHeader
        periods={data.availablePeriods}
        selectedPeriodId={periodId}
        onPeriodChange={setPeriodId}
      />

      {data.source === "fixture" ? <FixtureBanner /> : null}

      <KpiCards kpis={data.kpis} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <FinancialOverviewChart data={data.monthlyOverview} />
        </div>
        <div className="xl:col-span-2">
          <AttentionPanel items={data.attentionItems} />
        </div>
      </div>

      <StatusSummaryCards summaries={data.summaries} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <RecentTransactions transactions={data.recentTransactions} />
        </div>
        <div className="xl:col-span-2">
          <SubscriptionRenewals renewals={data.upcomingRenewals} />
        </div>
      </div>
    </div>
  );
}
