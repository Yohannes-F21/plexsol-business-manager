import { useLocation } from "react-router-dom";

export function PlaceholderPage({ title }: { title: string }) {
  const location = useLocation();

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="text-muted-foreground">
        This module is reserved for a later phase. Route:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
          {location.pathname}
        </code>
      </p>
    </div>
  );
}
