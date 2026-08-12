"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRightIcon, BanknoteIcon, ReceiptTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  useMonthlySeries,
  usePnL,
  useReceivablesAging,
  useToday,
} from "@/lib/api";
import { AGING_BUCKET_LABEL, deltaPercent } from "@/lib/finance";
import {
  formatAfn,
  formatAfnCompact,
  formatDate,
  formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type RangeKey = "this_month" | "last_month" | "quarter" | "ytd" | "all";

const RANGE_LABEL: Record<RangeKey, string> = {
  this_month: "This month",
  last_month: "Last month",
  quarter: "Last 3 months",
  ytd: "Year to date",
  all: "All time",
};

function rangeToDates(range: RangeKey, today: Date): { from: Date; to: Date } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (range) {
    case "this_month":
      return { from: new Date(Date.UTC(y, m, 1)), to: today };
    case "last_month":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
      };
    case "quarter":
      return { from: new Date(Date.UTC(y, m - 2, 1)), to: today };
    case "ytd":
      return { from: new Date(Date.UTC(y, 0, 1)), to: today };
    case "all":
      return { from: new Date(Date.UTC(2020, 0, 1)), to: today };
  }
}

const trendConfig = {
  grossProfitAfn: { label: "Gross profit", color: "var(--color-chart-2)" },
  expensesAfn: { label: "Expenses", color: "var(--color-chart-3)" },
  netProfitAfn: { label: "Net profit", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

export function FinanceScreen() {
  const today = useToday();
  const [range, setRange] = React.useState<RangeKey>("ytd");

  const { from, to } = React.useMemo(
    () => rangeToDates(range, today),
    [range, today],
  );
  const pnl = usePnL(from, to);

  // Same-length window immediately before, for the delta pills.
  const previous = React.useMemo(() => {
    const span = to.getTime() - from.getTime();
    return {
      from: new Date(from.getTime() - span),
      to: new Date(from.getTime() - 1),
    };
  }, [from, to]);
  const previousPnl = usePnL(previous.from, previous.to);

  const monthly = useMonthlySeries(12);
  const aging = useReceivablesAging();

  const expenseConfig = React.useMemo(
    () =>
      Object.fromEntries(
        pnl.expenseBreakdown.map((row) => [
          row.categoryId,
          { label: row.name, color: row.color },
        ]),
      ) satisfies ChartConfig,
    [pnl.expenseBreakdown],
  );

  return (
    <>
      <PageHeader
        title="Finance &amp; accounting"
        description="What the business earned, what it cost, and what is left."
        actions={
          <>
            <Select
              value={range}
              onValueChange={(value) => setRange(value as RangeKey)}
            >
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABEL) as RangeKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {RANGE_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" asChild>
              <Link href="/finance/expenses">
                <ReceiptTextIcon />
                Expenses
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/finance/balances">
                <BanknoteIcon />
                Balances
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatAfn(pnl.revenueAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.revenueAfn, previousPnl.revenueAfn)}
          deltaSuffix="vs previous period"
          caption={`${pnl.orderCount} billable orders`}
          icon={ArrowRightIcon}
          accent="brand"
        />
        <StatCard
          label="Gross profit"
          value={formatAfn(pnl.grossProfitAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.grossProfitAfn, previousPnl.grossProfitAfn)}
          deltaSuffix="vs previous period"
          caption={`${formatPercent(pnl.grossMarginPercent)} margin`}
          accent="gold"
        />
        <StatCard
          label="Operating expenses"
          value={formatAfn(pnl.expensesAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.expensesAfn, previousPnl.expensesAfn)}
          deltaSuffix="vs previous period"
          caption={`${pnl.expenseBreakdown.length} categories`}
          accent="destructive"
        />
        <StatCard
          label="Net profit"
          value={formatAfn(pnl.netProfitAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.netProfitAfn, previousPnl.netProfitAfn)}
          deltaSuffix="vs previous period"
          caption={`${formatPercent(pnl.netMarginPercent)} net margin`}
          accent={pnl.netProfitAfn >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_400px]">
        {/* P&L statement -------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit &amp; loss</CardTitle>
            <p className="text-muted-foreground text-xs">
              {formatDate(from)} — {formatDate(to)}
            </p>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <PnlRow label="Revenue from clients" value={pnl.revenueAfn} strong />
            <PnlRow
              label="Cost of goods, freight and duty"
              value={-pnl.cogsAfn}
              muted
            />
            <Separator className="my-2" />
            <PnlRow
              label="Gross profit"
              value={pnl.grossProfitAfn}
              strong
              suffix={formatPercent(pnl.grossMarginPercent)}
            />

            <div className="pt-3 pb-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Operating expenses
              </p>
            </div>
            {pnl.expenseBreakdown.map((row) => (
              <div
                key={row.categoryId}
                className="flex items-center justify-between py-0.5"
              >
                <span className="text-muted-foreground flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  {row.name}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground tabular text-xs">
                    {row.share.toFixed(0)}%
                  </span>
                  <Money value={-row.amountAfn} tone="muted" />
                </span>
              </div>
            ))}
            <Separator className="my-2" />
            <PnlRow label="Total expenses" value={-pnl.expensesAfn} />
            <Separator className="my-2" />
            <div className="bg-muted/40 -mx-2 flex items-center justify-between rounded-lg px-2 py-2.5">
              <span className="font-semibold">Net profit</span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground tabular text-xs">
                  {formatPercent(pnl.netMarginPercent)}
                </span>
                <Money
                  value={pnl.netProfitAfn}
                  tone="signed"
                  className="text-base font-semibold"
                />
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* Expense mix ------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense mix</CardTitle>
              <p className="text-muted-foreground text-xs">
                Where the operating money goes
              </p>
            </CardHeader>
            <CardContent>
              {pnl.expenseBreakdown.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No expenses recorded in this period.
                </p>
              ) : (
                <ChartContainer
                  config={expenseConfig}
                  className="aspect-square h-[220px] w-full"
                >
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value) => formatAfn(Number(value), { unit: "suffix" })}
                        />
                      }
                    />
                    <Pie
                      data={pnl.expenseBreakdown}
                      dataKey="amountAfn"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius="48%"
                      outerRadius="78%"
                      paddingAngle={2}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {pnl.expenseBreakdown.map((row) => (
                        <Cell key={row.categoryId} fill={row.color} />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      height={40}
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => (
                        <span className="text-muted-foreground text-xs">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Receivables ------------------------------------------- */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Receivables ageing</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    {aging.rows.length} clients owe money
                  </p>
                </div>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href="/finance/balances">Details</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {(
                Object.keys(AGING_BUCKET_LABEL) as Array<
                  keyof typeof AGING_BUCKET_LABEL
                >
              ).map((bucket) => {
                const value = aging.totals[bucket] ?? 0;
                const share =
                  aging.grandTotal > 0 ? (value / aging.grandTotal) * 100 : 0;
                return (
                  <div key={bucket} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {AGING_BUCKET_LABEL[bucket]}
                      </span>
                      <Money value={value} />
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          bucket === "current" && "bg-success",
                          bucket === "d1_30" && "bg-info",
                          bucket === "d31_60" && "bg-warning",
                          bucket === "d60_plus" && "bg-destructive",
                        )}
                        style={{ width: `${Math.max(share, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <Separator className="my-1" />
              <div className="flex items-center justify-between font-semibold">
                <span>Total owed</span>
                <Money value={aging.grandTotal} className="text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Monthly trend ------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Twelve-month trend</CardTitle>
          <p className="text-muted-foreground text-xs">
            Gross profit against operating expenses, in AFN
          </p>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={trendConfig}
            className="aspect-auto h-[260px] w-full"
          >
            <BarChart data={monthly} margin={{ left: 4, right: 8, top: 8 }}>
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
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatAfn(Number(value), { unit: "suffix" })}
                  />
                }
              />
              <Bar
                dataKey="grossProfitAfn"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
              />
              <Bar
                dataKey="expensesAfn"
                fill="var(--color-chart-3)"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}

function PnlRow({
  label,
  value,
  strong,
  muted,
  suffix,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={cn(strong ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="flex items-center gap-3">
        {suffix && (
          <span className="text-muted-foreground tabular text-xs">{suffix}</span>
        )}
        <Money
          value={value}
          tone={muted ? "muted" : "plain"}
          className={strong ? "font-semibold" : undefined}
        />
      </span>
    </div>
  );
}
