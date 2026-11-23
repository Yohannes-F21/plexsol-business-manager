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
import { formatDate, formatMoney, labelize } from "@/lib/format";
import { subscriptionsApi } from "./api";

export function SubscriptionDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["subscriptions", id],
    queryFn: () => subscriptionsApi.get(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const item = query.data?.data;
  if (!item) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted-foreground">Subscription not found.</p>
        <Button asChild variant="outline">
          <Link to="/subscriptions">Back to subscriptions</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/subscriptions" aria-label="Back to subscriptions">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title={item.name}
          description={item.vendor ?? "Subscription detail"}
          actions={<Badge variant="outline">{labelize(item.status)}</Badge>}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(item.amount, item.currencyCode)}
            </p>
            <p className="text-xs text-muted-foreground">
              {labelize(item.billingPeriod)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatDate(item.expirationDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              Started {formatDate(item.startDate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {item.category?.name ?? "Uncategorized"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Renewal history</CardTitle>
        </CardHeader>
        <CardContent>
          {(item.renewals?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No confirmed renewals yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Renewed</TableHead>
                  <TableHead>Previous expiry</TableHead>
                  <TableHead>New expiry</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Expense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.renewals?.map((renewal) => (
                  <TableRow key={renewal.id}>
                    <TableCell>{formatDate(renewal.renewedAt)}</TableCell>
                    <TableCell>
                      {formatDate(renewal.previousExpirationDate)}
                    </TableCell>
                    <TableCell>
                      {formatDate(renewal.newExpirationDate)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(renewal.amount, renewal.currencyCode)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {renewal.expense?.description ?? renewal.expenseId}
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
