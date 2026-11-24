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

const ORANGE = "#FF6500";
const PEACH = "#FFD9BF";
const CHARCOAL = "#111827";
const GRID = "#E7E9EF";
const TICK = "#64748B";

export function FinancialOverviewChart({ data }: FinancialOverviewChartProps) {
  const chartData = data.map((point) => ({
    month: point.month,
    Income: Number(point.income),
    Expenses: Number(point.expenses),
    "Net Cash Flow": Number(point.netCashFlow),
  }));

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold leading-6">
          Monthly Financial Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {chartData.length === 0 ? (
          <EmptyState
            title="No financial overview yet"
            description="Monthly income, expenses, and net cash flow will appear here."
            className="py-10"
          />
        ) : (
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                barGap={4}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke={GRID}
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK, fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: TICK, fontSize: 12 }}
                  width={40}
                  tickFormatter={(value: number) =>
                    value >= 1000
                      ? `${Math.round(value / 1000)}k`
                      : String(value)
                  }
                />
                <Tooltip
                  formatter={(value) =>
                    formatCompactEtb(
                      String(typeof value === "number" ? value : 0),
                    )
                  }
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: GRID,
                    background: "#FFFFFF",
                    boxShadow: "0 1px 2px rgb(17 24 39 / 0.04), 0 1px 3px rgb(17 24 39 / 0.06)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: CHARCOAL, fontWeight: 600 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingBottom: 16 }}
                />
                <Bar
                  dataKey="Income"
                  fill={ORANGE}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
                <Bar
                  dataKey="Expenses"
                  fill={PEACH}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
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
