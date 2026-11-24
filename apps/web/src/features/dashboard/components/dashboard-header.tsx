import { CalendarDays, CircleHelp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardPeriod } from "../types";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  periods: DashboardPeriod[];
  selectedPeriodId: string;
  onPeriodChange: (periodId: string) => void;
};

export function DashboardHeader({
  periods,
  selectedPeriodId,
  onPeriodChange,
}: DashboardHeaderProps) {
  const selected =
    periods.find((period) => period.id === selectedPeriodId) ?? periods[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-[32px] font-bold leading-10 tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="max-w-xl text-sm leading-[22px] text-muted-foreground">
          Overview of your subscriptions, maintenance, and finances.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative inline-flex items-center">
          <span className="sr-only">Reporting period</span>
          <CalendarDays
            className="pointer-events-none absolute left-3 size-5 text-muted-foreground"
            strokeWidth={1.75}
          />
          <select
            className={cn(
              "h-11 min-w-[148px] appearance-none rounded-[10px] border border-border bg-card py-2 pl-10 pr-10 text-sm font-medium text-foreground",
              "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            value={selected?.id}
            onChange={(event) => onPeriodChange(event.target.value)}
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 size-5 text-muted-foreground"
            aria-hidden="true"
          />
        </label>

        <Button variant="ghost" size="icon" aria-label="Help">
          <CircleHelp className="size-5" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}
