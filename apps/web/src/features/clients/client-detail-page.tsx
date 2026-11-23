import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p className="text-sm text-muted-foreground">Client not found.</p>
        <Button asChild variant="outline">
          <Link to="/clients">Back to clients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/clients" aria-label="Back to clients">
            <ArrowLeft className="size-4" />
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{client.email ?? "No email"}</p>
            <p className="text-muted-foreground">{client.phone ?? "No phone"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {client._count?.projects ?? client.projects?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {client._count?.payments ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {client.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {client.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {(client.projects?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agreed price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.projects?.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        to={`/projects/${project.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>{labelize(project.status)}</TableCell>
                    <TableCell>
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
