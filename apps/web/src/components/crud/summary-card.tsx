import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SummaryCard({
  label,
  value,
  icon,
  tone = "primary",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
  hint?: string;
}) {
  const toneClass = {
    primary: "bg-primary-subtle text-primary",
    success: "bg-success-background text-success",
    warning: "bg-warning-background text-warning",
    danger: "bg-danger-background text-danger",
  }[tone];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-center justify-between gap-4 p-6 pt-6 md:p-6 md:pt-6">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium leading-5 text-muted-foreground">
            {label}
          </p>
          <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="text-xs leading-[18px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center self-center rounded-[12px]",
            toneClass,
          )}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}
