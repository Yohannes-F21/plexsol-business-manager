import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactEtb } from "../format";
import type { MonthlyPoint } from "../types";

type FinancialOverviewChartProps = {
  data: MonthlyPoint[];
};

const ORANGE = "#F15A24";
const PEACH = "#F8C9B5";
const CHARCOAL = "#1A1A1A";

export function FinancialOverviewChart({ data }: FinancialOverviewChartProps) {
  const chartData = data.map((point) => ({
    month: point.month,
    Income: Number(point.income),
    Expenses: Number(point.expenses),
    "Net Cash Flow": Number(point.netCashFlow),
  }));

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">
          Monthly Financial Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {chartData.length === 0 ? (
          <EmptyState
            title="No financial overview yet"
            description="Monthly income, expenses, and net cash flow will appear here."
            className="py-10"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                  }
                />
                <Tooltip
                  formatter={(value) =>
                    formatCompactEtb(String(typeof value === "number" ? value : 0))
                  }
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#E5E7EB",
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingBottom: 12 }}
                />
                <Bar
                  dataKey="Income"
                  fill={ORANGE}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="Expenses"
                  fill={PEACH}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="Net Cash Flow"
                  stroke={CHARCOAL}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHARCOAL, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
