import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatusSummary } from "../types";

const toneClass: Record<StatusSummary["rows"][number]["tone"], string> = {
  default: "text-foreground",
  warning: "text-primary",
  danger: "text-red-600",
  success: "text-emerald-600",
};

type StatusSummaryCardsProps = {
  summaries: StatusSummary[];
};

export function StatusSummaryCards({ summaries }: StatusSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {summaries.map((summary) => (
        <Card key={summary.id} className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{summary.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {summary.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className={cn("font-semibold", toneClass[row.tone])}>
                  {row.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
