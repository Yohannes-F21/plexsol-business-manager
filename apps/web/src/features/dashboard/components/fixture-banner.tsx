import { AlertTriangle } from "lucide-react";

export function FixtureBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-medium">Development fixtures</span> — sample layout
        data in ETB, not live production metrics. Replaced automatically when{" "}
        <code className="rounded bg-amber-100 px-1 text-xs">/api/dashboard</code>{" "}
        is available.
      </p>
    </div>
  );
}
