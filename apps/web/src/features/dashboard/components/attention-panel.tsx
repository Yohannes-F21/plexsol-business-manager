import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { AttentionItem, AttentionSeverity } from "../types";

const badgeStyles: Record<AttentionSeverity, string> = {
  action: "bg-danger-background text-danger",
  pending: "bg-warning-background text-warning",
  retrying: "bg-muted text-muted-foreground",
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
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold leading-6">
          Upcoming &amp; Attention
        </CardTitle>
        <Link
          to="/notifications"
          className="text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
        >
          View All →
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No subscription, maintenance, or email items need attention."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-divider">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium leading-[18px] text-muted-foreground">
                    {item.category}
                  </p>
                  <p className="text-sm font-medium leading-5 text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs leading-[18px] text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium leading-[18px]",
                    badgeStyles[item.severity],
                  )}
                >
                  {badgeLabels[item.severity]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
