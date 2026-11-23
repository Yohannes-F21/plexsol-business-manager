import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
