"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";

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

const config = {
  revenueAfn: { label: "Revenue", color: "var(--color-chart-1)" },
  cogsAfn: { label: "Direct cost", color: "var(--color-chart-3)" },
  grossProfitAfn: { label: "Gross profit", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

export function RevenueChart({
  data,
  months,
}: {
  data: MonthlyPoint[];
  months: number;
}) {
  const sliced = React.useMemo(() => data.slice(-months), [data, months]);

  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <AreaChart data={sliced} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
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
          cursor={{ strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              formatter={(value) => formatAfn(Number(value))}
              indicator="dot"
            />
          }
        />
        <Area
          type="monotone"
          dataKey="revenueAfn"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#fillRevenue)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="cogsAfn"
          stroke="var(--color-chart-3)"
          strokeWidth={1.5}
          fill="url(#fillCost)"
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="grossProfitAfn"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
