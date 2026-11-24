import { AlertTriangle } from "lucide-react";

export function FixtureBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-[10px] border border-warning/30 bg-warning-background px-3 py-2.5 text-sm text-warning"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <p className="leading-[22px]">
        <span className="font-medium">Development fixtures</span> — sample layout
        data in ETB, not live production metrics. Replaced automatically when{" "}
        <code className="rounded bg-card/60 px-1 text-xs">/api/dashboard</code>{" "}
        is available.
      </p>
    </div>
  );
}
