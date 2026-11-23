import { KpiCard } from "./kpi-card";
import type { DashboardKpi } from "../types";

type KpiCardsProps = {
  kpis: DashboardKpi[];
};

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
