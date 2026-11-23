import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { AttentionItem, AttentionSeverity } from "../types";

const badgeStyles: Record<AttentionSeverity, string> = {
  action: "bg-red-50 text-red-700",
  pending: "bg-orange-50 text-orange-700",
  retrying: "bg-slate-100 text-slate-600",
};

const badgeLabels: Record<AttentionSeverity, string> = {
  action: "Action Needed",
  pending: "Pending",
  retrying: "Retrying",
};

type AttentionPanelProps = {
  items: AttentionItem[];
};

export function AttentionPanel({ items }: AttentionPanelProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">
          Upcoming &amp; Attention
        </CardTitle>
        <Link
          to="/notifications"
          className="text-sm font-medium text-primary hover:underline"
        >
          View All →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No subscription, maintenance, or email items need attention."
            className="py-8"
          />
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.category}
                </p>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  badgeStyles[item.severity],
                )}
              >
                {badgeLabels[item.severity]}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
