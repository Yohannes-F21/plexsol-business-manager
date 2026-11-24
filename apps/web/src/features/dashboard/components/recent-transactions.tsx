import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatEtb } from "../format";
import type { RecentTransaction } from "../types";

type RecentTransactionsProps = {
  transactions: RecentTransaction[];
};

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold leading-6">
          Recent Transactions
        </CardTitle>
        <Link
          to="/payments"
          className="text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
        >
          View All →
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-0 sm:px-0">
        {transactions.length === 0 ? (
          <div className="px-5 md:px-6">
            <EmptyState
              title="No recent transactions"
              description="Income and expense activity will show up here."
              className="py-8"
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 md:pl-6">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="pr-5 text-right md:pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap pl-5 text-muted-foreground tabular-nums md:pl-6">
                    {tx.date}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {tx.description}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium leading-[18px]",
                        tx.type === "income"
                          ? "bg-success-background text-success"
                          : "bg-danger-background text-danger",
                      )}
                    >
                      {tx.type === "income" ? "Income" : "Expense"}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-5 text-right font-medium tabular-nums md:pr-6",
                      tx.type === "income" ? "text-success" : "text-foreground",
                    )}
                  >
                    {tx.type === "expense" ? "−" : ""}
                    {formatEtb(tx.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
