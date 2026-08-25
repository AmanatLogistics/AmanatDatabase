"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAfn, formatAfnCompact } from "@/lib/format";
import type { MonthlyPoint } from "@/lib/finance";

/**
 * The twelve-month bar chart, in a module of its own.
 *
 * Not a separation of concerns — a separation of *weight*. Recharts is the
 * heaviest dependency this app has, and while it was imported at the top of the
 * finance screen every visitor to that screen downloaded and evaluated it
 * before seeing a single figure. Here, the page loads and the chart follows.
 */
export function FinanceTrendChart({
  monthly,
  config,
}: {
  monthly: MonthlyPoint[];
  config: ChartConfig;
}) {
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-[260px] w-full"
    >
      <BarChart data={monthly} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          opacity={0.35}
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={11}
          tickFormatter={(value: number) => formatAfnCompact(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(value) =>
                formatAfn(Number(value), { unit: "suffix" })
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="revenueAfn"
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={18}
        />
        <Bar
          dataKey="cogsAfn"
          fill="var(--color-chart-3)"
          radius={[4, 4, 0, 0]}
          maxBarSize={18}
        />
        <Bar
          dataKey="profitAfn"
          fill="var(--color-chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ChartContainer>
  );
}
