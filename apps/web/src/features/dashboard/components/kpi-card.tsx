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
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        </div>

        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {formatEtb(kpi.value)}
            {kpi.suffix ? (
              <span className="ml-1 text-base font-medium text-muted-foreground">
                {kpi.suffix}
              </span>
            ) : null}
          </p>
          {kpi.footnote ? (
            <p className="mt-1 text-xs text-muted-foreground">{kpi.footnote}</p>
          ) : null}
        </div>

        {kpi.trend ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
              kpi.trend.sentiment === "positive" &&
                "bg-emerald-50 text-emerald-700",
              kpi.trend.sentiment === "negative" && "bg-red-50 text-red-700",
              kpi.trend.sentiment === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            {kpi.trend.direction === "up" ? (
              <ArrowUpRight className="size-3.5" />
            ) : null}
            {kpi.trend.direction === "down" ? (
              <ArrowDownRight className="size-3.5" />
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
