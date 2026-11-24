import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatEtb } from "../format";
import type { DashboardKpi } from "../types";

const iconById: Record<DashboardKpi["id"], LucideIcon> = {
  total_income: Layers,
  total_expenses: Wallet,
  net_cash_flow: TrendingUp,
  recurring_maintenance: RefreshCw,
};

type KpiCardProps = {
  kpi: DashboardKpi;
};

export function KpiCard({ kpi }: KpiCardProps) {
  const Icon = iconById[kpi.id];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col justify-center gap-4 p-6 pt-6 md:p-6 md:pt-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium leading-5 text-muted-foreground">
            {kpi.label}
          </p>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-subtle text-primary">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums text-foreground">
            {formatEtb(kpi.value)}
            {kpi.suffix ? (
              <span className="ml-1 whitespace-nowrap text-base font-medium text-muted-foreground">
                {kpi.suffix}
              </span>
            ) : null}
          </p>
          {kpi.footnote ? (
            <p className="text-xs leading-[18px] text-muted-foreground">
              {kpi.footnote}
            </p>
          ) : null}
        </div>

        {kpi.trend ? (
          <div
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-[18px]",
              kpi.trend.sentiment === "positive" &&
                "bg-success-background text-success",
              kpi.trend.sentiment === "negative" &&
                "bg-danger-background text-danger",
              kpi.trend.sentiment === "neutral" &&
                "bg-muted text-muted-foreground",
            )}
          >
            {kpi.trend.direction === "up" ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : null}
            {kpi.trend.direction === "down" ? (
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
            ) : null}
            <span>
              {kpi.trend.label}{" "}
              <span className="font-normal opacity-80">
                {kpi.trend.comparisonLabel}
              </span>
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
