import { useQuery } from "@tanstack/react-query";
import { PLEXSOL_BRAND, healthResponseSchema } from "@plexsol/shared";
import { Button } from "@/components/ui/button";

async function fetchHealth() {
  const response = await fetch("/health");
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  const json: unknown = await response.json();
  return healthResponseSchema.parse(json);
}

export function HomePage() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Phase 1 foundation</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {PLEXSOL_BRAND.productName}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Internal subscription, client project, maintenance billing, and
          financial management for Plexsol Technologies. Business modules will
          land in later phases — this shell establishes branding, routing, and
          API connectivity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">
            Brand palette
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: PLEXSOL_BRAND.colors.orange }}
              title="Plexsol Orange"
            />
            <span
              className="h-10 w-10 rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: PLEXSOL_BRAND.colors.charcoal }}
              title="Charcoal"
            />
            <span
              className="h-10 w-10 rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: PLEXSOL_BRAND.colors.offWhite }}
              title="Off-white"
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Orange accent on white / off-white surfaces with charcoal typography.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">
            API health
          </h2>
          <div className="mt-4 space-y-2">
            {healthQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : null}
            {healthQuery.isError ? (
              <p className="text-sm text-destructive">
                API unreachable. Start the API with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  pnpm dev:api
                </code>
                .
              </p>
            ) : null}
            {healthQuery.data ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium text-foreground">Status:</span>{" "}
                  {healthQuery.data.status}
                </p>
                <p>
                  <span className="font-medium text-foreground">Service:</span>{" "}
                  {healthQuery.data.service}
                </p>
                <p className="text-muted-foreground">
                  {healthQuery.data.timestamp}
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void healthQuery.refetch()}
            >
              Recheck
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
