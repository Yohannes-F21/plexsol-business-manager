import { Card, CardContent } from "@/components/ui/card";

function Block({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Block className="h-10 w-48" />
          <Block className="h-4 w-80 max-w-full" />
        </div>
        <Block className="h-10 w-40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between">
                <Block className="h-4 w-24" />
                <Block className="size-9 rounded-[10px]" />
              </div>
              <Block className="h-9 w-36" />
              <Block className="h-5 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5 xl:gap-5">
        <Card className="xl:col-span-3">
          <CardContent className="space-y-4 p-5">
            <Block className="h-5 w-56" />
            <Block className="h-72 w-full sm:h-80" />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardContent className="space-y-3 p-5">
            <Block className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Block key={index} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:gap-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Block className="h-5 w-28" />
              <Block className="h-4 w-full" />
              <Block className="h-4 w-full" />
              <Block className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
