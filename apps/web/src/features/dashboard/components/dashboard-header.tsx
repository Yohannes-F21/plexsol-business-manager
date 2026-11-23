import { Bell, CalendarDays, CircleHelp, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Overview of your subscriptions, maintenance, and finances.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative inline-flex items-center">
          <span className="sr-only">Reporting period</span>
          <CalendarDays className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <select
            className={cn(
              "h-10 appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-9 text-sm font-medium text-foreground shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
        </label>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          asChild
          aria-label="Notifications"
        >
          <Link to="/notifications">
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
          </Link>
        </Button>

        <Button variant="ghost" size="icon" aria-label="Help">
          <CircleHelp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
