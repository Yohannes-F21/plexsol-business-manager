import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center rounded-[14px] border border-dashed border-border bg-card px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold leading-6 text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-[22px] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
