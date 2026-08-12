"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BanknoteIcon,
  ClockIcon,
  PackageXIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { RevenueChart } from "@/features/dashboard/revenue-chart";
import { StatusDonut } from "@/features/dashboard/status-donut";
import { useDashboard, useToday } from "@/lib/api";
import { deltaPercent } from "@/lib/finance";
import {
  formatAfn,
  formatDateShort,
  formatMonth,
  formatPercent,
  initials,
  truncate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const ATTENTION_ICON = {
  customs: PackageXIcon,
  exception: AlertTriangleIcon,
  overdue: BanknoteIcon,
  unpurchased: ClockIcon,
} as const;

export function DashboardScreen() {
  const data = useDashboard();
  const today = useToday();
  const [range, setRange] = React.useState("6");

  const { thisMonth, lastMonth, yearToDate } = data;

  // Progress bars compare this month against the best month in the last year.
  const peakRevenue = Math.max(...data.monthly.map((m) => m.revenueAfn), 1);
  const peakOrders = Math.max(...data.monthly.map((m) => m.orders), 1);
  const peakProfit = Math.max(...data.monthly.map((m) => m.grossProfitAfn), 1);

  const maxStoreRevenue = Math.max(
    ...data.salesByStore.map((s) => s.revenueAfn),
    1,
  );

  return (
    <>
      {/* KPI row ------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders this month"
          value={thisMonth.orderCount}
          delta={deltaPercent(thisMonth.orderCount, lastMonth.orderCount)}
          deltaSuffix="vs same days last month"
          caption={`${data.activeOrders} still in progress`}
          progress={(thisMonth.orderCount / peakOrders) * 100}
          icon={ShoppingCartIcon}
          accent="brand"
        />
        <StatCard
          label="Revenue"
          value={formatAfn(thisMonth.revenueAfn, { unit: "suffix" })}
          delta={deltaPercent(thisMonth.revenueAfn, lastMonth.revenueAfn)}
          caption={`${formatAfn(yearToDate.revenueAfn, { unit: "suffix" })} year to date`}
          progress={(thisMonth.revenueAfn / peakRevenue) * 100}
          icon={TrendingUpIcon}
          accent="gold"
        />
        <StatCard
          label="Gross profit"
          value={formatAfn(thisMonth.grossProfitAfn, { unit: "suffix" })}
          delta={deltaPercent(thisMonth.grossProfitAfn, lastMonth.grossProfitAfn)}
          caption={`${formatPercent(thisMonth.grossMarginPercent)} margin`}
          progress={(thisMonth.grossProfitAfn / peakProfit) * 100}
          icon={WalletIcon}
          accent="success"
        />
        <StatCard
          label="Outstanding"
          value={formatAfn(data.outstandingAfn, { unit: "suffix" })}
          caption="owed by clients across all orders"
          progress={
            yearToDate.revenueAfn > 0
              ? (data.outstandingAfn / yearToDate.revenueAfn) * 100
              : 0
          }
          icon={BanknoteIcon}
          accent="destructive"
        />
      </div>

      {/* Chart + status ------------------------------------------------ */}
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Revenue overview</CardTitle>
                <p className="text-muted-foreground text-xs">
                  Revenue, direct cost and gross profit by month, in AFN
                </p>
              </div>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger size="sm" className="w-[128px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="9">Last 9 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.monthly} months={Number(range)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by status</CardTitle>
            <p className="text-muted-foreground text-xs">
              Where every order sits in the pipeline
            </p>
          </CardHeader>
          <CardContent>
            <StatusDonut
              data={data.ordersByStatus}
              total={data.ordersByStatus.reduce((sum, s) => sum + s.count, 0)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Profit summary + stores + attention --------------------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Profit summary</CardTitle>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link href="/finance">See details</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProfitRow
              accent="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300"
              icon={TrendingUpIcon}
              value={yearToDate.grossProfitAfn}
              label={`Gross profit ${today.getUTCFullYear()}`}
              href="/finance"
            />
            <ProfitRow
              accent="bg-gold-500/15 text-gold-700 dark:text-gold-400"
              icon={WalletIcon}
              value={thisMonth.grossProfitAfn}
              label={`Gross profit ${formatMonth(today.toISOString())}`}
              href="/finance"
            />
            <ProfitRow
              accent="bg-info/12 text-info"
              icon={ClockIcon}
              value={data.weekProfitAfn}
              label="Gross profit last 7 days"
              href="/finance"
            />

            <Separator className="my-1" />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Net profit this month
                </span>
                <Money
                  value={thisMonth.netProfitAfn}
                  tone="signed"
                  unit="suffix"
                  className="font-semibold"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                After {formatAfn(thisMonth.expensesAfn, { unit: "suffix" })} of operating expenses
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where we buy</CardTitle>
            <p className="text-muted-foreground text-xs">
              Revenue attributed by source store, in AFN
            </p>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {data.salesByStore.map((store, index) => (
              <div key={store.storeId} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">{store.name}</span>
                  <Money value={store.revenueAfn} className="text-muted-foreground" />
                </div>
                <Progress
                  value={(store.revenueAfn / maxStoreRevenue) * 100}
                  className="h-1.5"
                  indicatorClassName={cn(
                    index === 0 && "bg-chart-1",
                    index === 1 && "bg-chart-2",
                    index === 2 && "bg-chart-3",
                    index === 3 && "bg-chart-4",
                    index >= 4 && "bg-chart-5",
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
            <p className="text-muted-foreground text-xs">
              Things that will not resolve themselves
            </p>
          </CardHeader>
          <CardContent>
            {data.attention.length === 0 ? (
              <EmptyState
                title="All clear"
                description="No stuck shipments, overdue clients or unpurchased orders."
                className="py-8"
              />
            ) : (
              <ul className="space-y-1">
                {data.attention.map((item) => {
                  const Icon = ATTENTION_ICON[item.kind];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="hover:bg-accent -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                            item.kind === "overdue"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/15 text-warning-foreground dark:text-warning",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium">
                            {item.title}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {item.description}
                          </span>
                        </span>
                        {item.amountAfn !== undefined && (
                          <Money
                            value={item.amountAfn}
                            className="text-destructive shrink-0 text-xs font-medium"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders ------------------------------------------------- */}
      <Card className="overflow-hidden py-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <CardTitle className="text-base">Recent orders</CardTitle>
            <p className="text-muted-foreground text-xs">
              The last requests to come in
            </p>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href="/orders">
              See all orders
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Client</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recentOrders.map(({ order, client, economics }) => {
              const first = order.items[0];
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                        {initials(client?.name ?? "?")}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${order.clientId}`}
                          className="block truncate text-[13px] font-medium hover:underline"
                        >
                          {client?.name ?? "—"}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {client?.city}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {first && (
                        <ProductThumb
                          size="sm"
                          category={first.category}
                          imageUrl={first.imageUrl}
                          name={first.name}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px]">
                          {first ? truncate(first.name, 28) : "—"}
                        </p>
                        {order.items.length > 1 && (
                          <p className="text-muted-foreground text-xs">
                            +{order.items.length - 1} more
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="tabular text-primary text-[13px] hover:underline"
                    >
                      {order.orderNo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      value={economics.revenue.totalAfn}
                      className="text-[13px] font-medium"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      value={economics.balanceAfn}
                      className={cn(
                        "text-[13px]",
                        economics.balanceAfn > 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="order" value={order.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular text-[13px]">
                    {formatDateShort(order.requestedAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Quick links --------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/orders/new"
          icon={ShoppingCartIcon}
          title="New order"
          description="Log a request a client just sent"
        />
        <QuickLink
          href="/purchases"
          icon={PackageXIcon}
          title="Log a purchase"
          description="Record what you paid the store"
        />
        <QuickLink
          href="/tracking"
          icon={TruckIcon}
          title="Track shipments"
          description="See what is stuck in customs"
        />
        <QuickLink
          href="/finance/balances"
          icon={BanknoteIcon}
          title="Chase balances"
          description="Who owes us and for how long"
        />
      </div>
    </>
  );
}

function ProfitRow({
  icon: Icon,
  value,
  label,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  accent: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          accent,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="tabular block text-[15px] font-semibold">
          {formatAfn(value, { unit: "suffix" })}
        </span>
        <span className="text-muted-foreground block text-xs">{label}</span>
      </span>
      <ArrowRightIcon className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 h-full p-4 transition-colors">
        <div className="flex items-start gap-3">
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{title}</p>
            <p className="text-muted-foreground text-xs">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
