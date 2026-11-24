import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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
import { formatDate, formatMoney, labelize } from "@/lib/format";
import { subscriptionsApi, type Subscription } from "./api";

const statusVariant: Record<
  Subscription["status"],
  "success" | "warning" | "danger" | "muted"
> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  CANCELLED: "muted",
};

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
        <EmptyState
          title="Subscription not found"
          description="It may have been deleted or the link is invalid."
          action={
            <Button asChild variant="outline">
              <Link to="/subscriptions">Back to subscriptions</Link>
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
          <Link to="/subscriptions" aria-label="Back to subscriptions">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
        </Button>
        <PageHeader
          title={item.name}
          description={item.vendor ?? "Subscription detail"}
          actions={
            <Badge variant={statusVariant[item.status]}>
              {item.status === "EXPIRING_SOON"
                ? "Renewing Soon"
                : labelize(item.status)}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 xl:gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums text-foreground">
              {formatMoney(item.amount, item.currencyCode)}
            </p>
            <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
              {labelize(item.billingPeriod)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expiration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums text-foreground">
              {formatDate(item.expirationDate)}
            </p>
            <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
              Started {formatDate(item.startDate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Category
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-lg font-semibold leading-7 text-foreground">
              {item.category?.name ?? "Uncategorized"}
            </p>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block truncate text-xs text-primary hover:text-primary-hover"
              >
                {item.url}
              </a>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {item.notes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-[22px] text-muted-foreground whitespace-pre-wrap">
              {item.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold leading-6">
            Renewal history
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2 sm:px-0 pt-0">
          {(item.renewals?.length ?? 0) === 0 ? (
            <div className="px-5 md:px-6">
              <EmptyState
                title="No confirmed renewals yet"
                description="Renewals confirmed from the subscriptions list will appear here with linked expenses."
                className="py-10"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 md:pl-6">Renewed</TableHead>
                  <TableHead>Previous expiry</TableHead>
                  <TableHead>New expiry</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="pr-5 md:pr-6">Expense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.renewals?.map((renewal) => (
                  <TableRow key={renewal.id}>
                    <TableCell className="pl-5 tabular-nums md:pl-6">
                      {formatDate(renewal.renewedAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(renewal.previousExpirationDate)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(renewal.newExpirationDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(renewal.amount, renewal.currencyCode)}
                    </TableCell>
                    <TableCell className="pr-5 text-xs text-muted-foreground md:pr-6">
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
