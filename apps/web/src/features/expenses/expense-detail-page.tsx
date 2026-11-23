import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/crud/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p className="text-sm text-muted-foreground">Expense not found.</p>
        <Button asChild variant="outline">
          <Link to="/expenses">Back to expenses</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/expenses" aria-label="Back to expenses">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title={expense.description}
          description="Expense detail"
          actions={
            expense.isSubscriptionRenewal ? (
              <Badge variant="secondary">Subscription renewal</Badge>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">
              {formatMoney(expense.amount, expense.currencyCode)}
            </p>
            <p className="text-sm text-muted-foreground">
              ETB {formatMoney(expense.amountEtb, "ETB")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Category: </span>
              {expense.category?.name ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Date: </span>
              {formatDate(expense.incurredAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Payment method: </span>
              {expense.paymentMethod?.name ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
