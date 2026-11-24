import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, labelize } from "@/lib/format";
import { clientsApi } from "./api";

const projectStatusVariant: Record<
  string,
  "success" | "default" | "warning" | "muted"
> = {
  IN_PROGRESS: "success",
  COMPLETED: "default",
  ON_HOLD: "warning",
  CANCELLED: "muted",
};

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["clients", id],
    queryFn: () => clientsApi.get(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const client = query.data?.data;
  if (!client) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <EmptyState
          title="Client not found"
          description="It may have been deleted or the link is invalid."
          action={
            <Button asChild variant="outline">
              <Link to="/clients">Back to clients</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0">
          <Link to="/clients" aria-label="Back to clients">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
        </Button>
        <PageHeader
          title={client.name}
          description={client.company ?? "Client detail"}
          actions={
            <Badge variant={client.isActive ? "success" : "muted"}>
              {client.isActive ? "Active" : "Inactive"}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm pt-0">
            <p className="flex items-center gap-2 text-foreground">
              <Mail className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
              {client.email ?? "No email"}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3.5" strokeWidth={1.75} />
              {client.phone ?? "No phone"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums">
              {client._count?.projects ?? client.projects?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums">
              {client._count?.payments ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {client.notes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="whitespace-pre-wrap text-sm leading-[22px] text-muted-foreground">
              {client.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold leading-6">
            Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2 sm:px-0 pt-0">
          {(client.projects?.length ?? 0) === 0 ? (
            <div className="px-5 md:px-6">
              <EmptyState
                title="No projects yet"
                description="Create a project for this client from the Projects page."
                className="py-10"
                action={
                  <Button asChild variant="outline">
                    <Link to="/projects" state={{ openCreate: true }}>
                      Add Project
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 md:pl-6">Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right md:pr-6">
                    Agreed price
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.projects?.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="pl-5 md:pl-6">
                      <Link
                        to={`/projects/${project.id}`}
                        className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          projectStatusVariant[project.status] ?? "muted"
                        }
                      >
                        {labelize(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right font-medium tabular-nums md:pr-6">
                      {formatMoney(project.agreedPrice, project.currencyCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
