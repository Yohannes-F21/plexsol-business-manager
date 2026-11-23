import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatMoney, labelize } from "@/lib/format";
import { projectsApi } from "./api";

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
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Button asChild variant="outline">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/projects" aria-label="Back to projects">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title={project.name}
          description="Development project detail"
          actions={
            <Badge variant="outline">{labelize(project.status)}</Badge>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agreed price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(project.agreedPrice, project.currencyCode)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Independent of payment allocation status
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {project.client ? (
              <Link
                to={`/clients/${project.client.id}`}
                className="font-medium text-primary hover:underline"
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
        <CardHeader>
          <CardTitle className="text-base">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Start</p>
            <p>{formatDate(project.startDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">End</p>
            <p>{formatDate(project.endDate)}</p>
          </div>
        </CardContent>
      </Card>

      {project.description ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {project.description}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
