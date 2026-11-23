import { Card, CardContent } from "@/components/ui/card";

function Block({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Block className="h-8 w-48" />
        <Block className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="shadow-sm">
            <CardContent className="space-y-4 p-5">
              <Block className="h-4 w-24" />
              <Block className="h-8 w-32" />
              <Block className="h-5 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="shadow-sm xl:col-span-3">
          <CardContent className="p-5">
            <Block className="h-72 w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-sm xl:col-span-2">
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Block key={index} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
