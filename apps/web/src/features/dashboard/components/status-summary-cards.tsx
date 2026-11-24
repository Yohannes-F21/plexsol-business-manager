import type { LucideIcon } from "lucide-react";
import { CreditCard, FolderKanban, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatusSummary } from "../types";

const toneClass: Record<StatusSummary["rows"][number]["tone"], string> = {
  default: "text-foreground",
  warning: "text-primary",
  danger: "text-danger",
  success: "text-success",
};

const iconById: Record<StatusSummary["id"], LucideIcon> = {
  subscriptions: CreditCard,
  maintenance: Wrench,
  projects: FolderKanban,
};

type StatusSummaryCardsProps = {
  summaries: StatusSummary[];
};

export function StatusSummaryCards({ summaries }: StatusSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:gap-5">
      {summaries.map((summary) => {
        const Icon = iconById[summary.id];
        return (
          <Card key={summary.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold leading-6">
                {summary.title}
              </CardTitle>
              <span className="inline-flex size-10 items-center justify-center rounded-[10px] bg-primary-subtle text-primary">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {summary.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 text-sm leading-5"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      toneClass[row.tone],
                    )}
                  >
                    {row.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
