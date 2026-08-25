"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/* Loaded after the page, like the dashboard's — see the note in that module. */
const FinanceTrendChart = dynamic(
  () =>
    import("@/features/finance/finance-trend-chart").then(
      (m) => m.FinanceTrendChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> },
);
import Link from "next/link";
import { ArrowRightIcon, BanknoteIcon } from "lucide-react";

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
import type { ChartConfig } from "@/components/ui/chart";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  useMonthlySeries,
  useOrderRows,
  usePnL,
  useReceivablesAging,
  useToday,
} from "@/lib/api";
import { AGING_BUCKET_LABEL, deltaPercent, isBillable } from "@/lib/finance";
import {
  formatAfn,
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
  revenueAfn: { label: "Revenue", color: "var(--color-chart-1)" },
  cogsAfn: { label: "Cost", color: "var(--color-chart-3)" },
  profitAfn: { label: "Profit", color: "var(--color-chart-2)" },
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
  const orderRows = useOrderRows();

  /*
   * Who the period's money actually came from. The ageing card below says who
   * owes; this says who earns, so the two read as a pair.
   */
  const topClients = React.useMemo(() => {
    const totals = new Map<string, { name: string; revenueAfn: number; orders: number }>();
    orderRows.forEach(({ order, client, economics }) => {
      if (!isBillable(order)) return;
      const at = new Date(order.requestedAt).getTime();
      if (at < from.getTime() || at > to.getTime()) return;
      const key = order.clientId;
      const current = totals.get(key) ?? {
        name: client?.name ?? "Unknown client",
        revenueAfn: 0,
        orders: 0,
      };
      current.revenueAfn += economics.revenue.totalAfn;
      current.orders += 1;
      totals.set(key, current);
    });
    return Array.from(totals.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.revenueAfn - a.revenueAfn)
      .slice(0, 5);
  }, [orderRows, from, to]);

  const costMix = React.useMemo(
    () =>
      [
        {
          key: "goods",
          name: "Goods",
          amountAfn: pnl.goodsAfn,
          color: "var(--color-chart-1)",
        },
        {
          key: "freight",
          name: "Freight",
          amountAfn: pnl.freightAfn,
          color: "var(--color-chart-3)",
        },
        {
          key: "customs",
          name: "Customs duty",
          amountAfn: pnl.customsAfn,
          color: "var(--color-chart-4)",
        },
      ].filter((row) => row.amountAfn > 0),
    [pnl.goodsAfn, pnl.freightAfn, pnl.customsAfn],
  );

  return (
    <>
      <PageHeader
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
              <Link href="/finance/balances">
                <BanknoteIcon />
                Client balances
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
          label="Cost of goods & delivery"
          value={formatAfn(pnl.cogsAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.cogsAfn, previousPnl.cogsAfn)}
          deltaSuffix="vs previous period"
          deltaGoodWhenDown
          caption="Stores, freight and duty"
          accent="destructive"
        />
        <StatCard
          label="Profit"
          value={formatAfn(pnl.profitAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.profitAfn, previousPnl.profitAfn)}
          deltaSuffix="vs previous period"
          caption={`${formatPercent(pnl.marginPercent)} margin`}
          accent={pnl.profitAfn >= 0 ? "success" : "destructive"}
        />
        <StatCard
          label="Extra fees earned"
          value={formatAfn(pnl.serviceFeeAfn, { unit: "suffix" })}
          delta={deltaPercent(pnl.serviceFeeAfn, previousPnl.serviceFeeAfn)}
          deltaSuffix="vs previous period"
          caption="Charged on top of store price"
          accent="gold"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-4">
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
              label="of which service fees"
              value={pnl.serviceFeeAfn}
              muted
            />

            <div className="pt-3 pb-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Direct costs
              </p>
            </div>
            <PnlRow label="Goods bought from stores" value={-pnl.goodsAfn} muted />
            <PnlRow label="Freight and handling" value={-pnl.freightAfn} muted />
            <PnlRow label="Customs duty" value={-pnl.customsAfn} muted />
            <Separator className="my-2" />
            <PnlRow label="Total direct cost" value={-pnl.cogsAfn} />

            <Separator className="my-2" />
            <div className="bg-muted/40 -mx-2 flex items-center justify-between rounded-lg px-2 py-2.5">
              <span className="font-semibold">Profit</span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground tabular text-xs">
                  {formatPercent(pnl.marginPercent)}
                </span>
                <Money
                  value={pnl.profitAfn}
                  tone="signed"
                  className="text-base font-semibold"
                />
              </span>
            </div>
            <p className="text-muted-foreground pt-1 text-xs">
              Revenue is booked on the order request date, so a month&rsquo;s
              sales, purchases and freight all land in the same period.
            </p>
          </CardContent>
        </Card>

        {/* Monthly trend ------------------------------------------------ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Twelve-month trend</CardTitle>
            <p className="text-muted-foreground text-xs">
              Revenue, direct cost and profit, in AFN
            </p>
          </CardHeader>
          <CardContent>
            <FinanceTrendChart monthly={monthly} config={trendConfig} />
          </CardContent>
        </Card>
        </div>

        <div className="space-y-4">
          {/* Cost mix ---------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where the cost goes</CardTitle>
              <p className="text-muted-foreground text-xs">
                Goods, freight and duty in this period
              </p>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {costMix.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No costs recorded in this period.
                </p>
              ) : (
                costMix.map((row) => {
                  const share =
                    pnl.cogsAfn > 0 ? (row.amountAfn / pnl.cogsAfn) * 100 : 0;
                  return (
                    <div key={row.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{row.name}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted-foreground tabular text-xs">
                            {share.toFixed(1)}%
                          </span>
                          <Money value={row.amountAfn} />
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(share, 1)}%`,
                            backgroundColor: row.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
              <Separator className="my-1" />
              <div className="flex items-center justify-between font-semibold">
                <span>Total direct cost</span>
                <Money value={pnl.cogsAfn} />
              </div>
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

          {/* Who the revenue came from ----------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Biggest clients</CardTitle>
              <p className="text-muted-foreground text-xs">
                By revenue in this period
              </p>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {topClients.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No billable orders in this period.
                </p>
              ) : (
                topClients.map((client, index) => {
                  const share =
                    topClients[0].revenueAfn > 0
                      ? (client.revenueAfn / topClients[0].revenueAfn) * 100
                      : 0;
                  return (
                    <div key={client.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/clients/${client.id}`}
                          className="min-w-0 truncate font-medium hover:underline"
                        >
                          {client.name}
                        </Link>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-muted-foreground tabular text-xs">
                            {client.orders} order{client.orders === 1 ? "" : "s"}
                          </span>
                          <Money value={client.revenueAfn} />
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            index === 0 && "bg-chart-1",
                            index === 1 && "bg-chart-2",
                            index === 2 && "bg-chart-3",
                            index === 3 && "bg-chart-4",
                            index >= 4 && "bg-chart-5",
                          )}
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
