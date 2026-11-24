import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatMoney } from "@/lib/format";
import { expensesApi } from "./api";

export function ExpenseDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["expenses", id],
    queryFn: () => expensesApi.get(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const expense = query.data?.data;
  if (!expense) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <EmptyState
          title="Expense not found"
          description="It may have been deleted or the link is invalid."
          action={
            <Button asChild variant="outline">
              <Link to="/expenses">Back to expenses</Link>
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
          <Link to="/expenses" aria-label="Back to expenses">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
        </Button>
        <PageHeader
          title={expense.description}
          description={`${expense.category?.name ?? "Expense"} · ${formatDate(expense.incurredAt)}`}
          actions={
            expense.isSubscriptionRenewal ? (
              <Badge variant="secondary">Subscription renewal</Badge>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums">
              {formatMoney(expense.amount, expense.currencyCode)}
            </p>
            {expense.currencyCode !== "ETB" ? (
              <p className="text-sm text-muted-foreground">
                {formatMoney(expense.amountEtb, "ETB")}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Category
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-lg font-semibold text-foreground">
              {expense.category?.name ?? "—"}
            </p>
            {expense.isSubscriptionRenewal ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Created by subscription renewal — edit via renewals.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payment method
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-lg font-semibold text-foreground">
              {expense.paymentMethod?.name ?? "Unspecified"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Incurred {formatDate(expense.incurredAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">ETB snapshot</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[28px] font-bold leading-9 tracking-tight tabular-nums">
            {formatMoney(expense.amountEtb, "ETB")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reporting currency amount used in dashboards and reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
