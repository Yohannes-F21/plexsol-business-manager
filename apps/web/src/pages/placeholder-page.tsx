import { Inbox } from "lucide-react";
import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";

export function PlaceholderPage({ title }: { title: string }) {
  const location = useLocation();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Module route: {location.pathname}
        </p>
      </div>

      <EmptyState
        icon={<Inbox className="size-8" />}
        title={`${title} coming soon`}
        description="This module is reserved for a later phase. Layout, navigation, and authentication are ready."
      />
    </div>
  );
}
