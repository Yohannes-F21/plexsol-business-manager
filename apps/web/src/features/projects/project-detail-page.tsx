import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatMoney, labelize } from "@/lib/format";
import { projectsApi, type Project } from "./api";

const projectStatusVariant: Record<
  Project["status"],
  "success" | "default" | "warning" | "muted"
> = {
  IN_PROGRESS: "success",
  COMPLETED: "default",
  ON_HOLD: "warning",
  CANCELLED: "muted",
};

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.get(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const project = query.data?.data;
  if (!project) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <EmptyState
          title="Project not found"
          description="It may have been deleted or the link is invalid."
          action={
            <Button asChild variant="outline">
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0">
          <Link to="/projects" aria-label="Back to projects">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
        </Button>
        <PageHeader
          title={project.name}
          description="Development project detail — lifecycle is independent of payment status."
          actions={
            <Badge variant={projectStatusVariant[project.status]}>
              {labelize(project.status)}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agreed price
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums text-foreground">
              {formatMoney(project.agreedPrice, project.currencyCode)}
            </p>
            <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
              Independent of payment allocation status
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm pt-0">
            {project.client ? (
              <Link
                to={`/clients/${project.client.id}`}
                className="text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary"
              >
                {project.client.name}
              </Link>
            ) : (
              <p>—</p>
            )}
            <p className="text-muted-foreground">
              {project.client?.company ?? ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 pt-0">
          <div>
            <p className="text-muted-foreground">Start</p>
            <p className="mt-1 font-medium tabular-nums text-foreground">
              {formatDate(project.startDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">End</p>
            <p className="mt-1 font-medium tabular-nums text-foreground">
              {formatDate(project.endDate)}
            </p>
          </div>
        </CardContent>
      </Card>

      {project.description ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Description</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="whitespace-pre-wrap text-sm leading-[22px] text-muted-foreground">
              {project.description}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
