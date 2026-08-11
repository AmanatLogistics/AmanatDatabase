"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ORDER_STATUS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";

const SLICE_COLOR: Partial<Record<OrderStatus, string>> = {
  requested: "var(--color-chart-6)",
  quoted: "var(--color-chart-3)",
  confirmed: "var(--color-chart-1)",
  purchasing: "var(--color-chart-2)",
  purchased: "var(--color-chart-2)",
  in_transit: "var(--color-chart-3)",
  arrived: "var(--color-chart-5)",
  ready_for_pickup: "var(--color-chart-2)",
  delivered: "var(--color-chart-4)",
  cancelled: "var(--color-muted-foreground)",
  refunded: "var(--color-destructive)",
};

export function StatusDonut({
  data,
  total,
}: {
  data: Array<{ status: OrderStatus; label: string; count: number }>;
  total: number;
}) {
  const config = Object.fromEntries(
    data.map((slice) => [
      slice.status,
      { label: slice.label, color: SLICE_COLOR[slice.status] },
    ]),
  ) satisfies ChartConfig;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer
        config={config}
        className="aspect-square size-[172px] shrink-0"
      >
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="96%"
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {data.map((slice) => (
              <Cell
                key={slice.status}
                fill={SLICE_COLOR[slice.status] ?? "var(--color-chart-1)"}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="grid w-full flex-1 gap-x-4 gap-y-1.5 sm:grid-cols-1">
        {data.slice(0, 7).map((slice) => (
          <li
            key={slice.status}
            className="flex items-center justify-between gap-2 text-[13px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    SLICE_COLOR[slice.status] ?? "var(--color-chart-1)",
                }}
              />
              <span className="text-muted-foreground truncate">
                {ORDER_STATUS[slice.status].label}
              </span>
            </span>
            <span className="tabular shrink-0 font-medium">
              {slice.count}
              <span className="text-muted-foreground ml-1 text-xs">
                {total > 0 ? `${Math.round((slice.count / total) * 100)}%` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
