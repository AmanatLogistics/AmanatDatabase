"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CreditCardIcon,
  ExternalLinkIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PackagePlusIcon,
  PlusIcon,
  PrinterIcon,
  ShoppingCartIcon,
  TruckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import {
  CountTabs,
  FilterSelect,
  ResetFiltersButton,
  SearchInput,
} from "@/components/shared/filter-bar";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import { useOrderRows, useStores, type OrderRow } from "@/lib/api";
import { ACTIVE_ORDER_STATUSES, ORDER_SOURCE_LABEL } from "@/lib/constants";
import { formatDateShort, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";

type PaymentFilter = "all" | "unpaid" | "partial" | "paid";

export function OrdersScreen() {
  const router = useRouter();
  const rows = useOrderRows();
  const stores = useStores();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [store, setStore] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [paymentState, setPaymentState] = React.useState<PaymentFilter>("all");
  const [payingOrder, setPayingOrder] = React.useState<OrderRow | null>(null);

  const chips = React.useMemo(() => {
    const count = (predicate: (row: OrderRow) => boolean) =>
      rows.filter(predicate).length;
    return [
      { value: "all", label: "All", count: rows.length },
      {
        value: "open",
        label: "Open",
        count: count((r) => ACTIVE_ORDER_STATUSES.includes(r.order.status)),
      },
      {
        value: "purchasing",
        label: "To purchase",
        count: count((r) =>
          ["confirmed", "purchasing"].includes(r.order.status),
        ),
      },
      {
        value: "in_transit",
        label: "In transit",
        count: count((r) => r.order.status === "in_transit"),
      },
      {
        value: "ready",
        label: "Ready",
        count: count((r) =>
          ["arrived", "ready_for_pickup"].includes(r.order.status),
        ),
      },
      {
        value: "unpaid",
        label: "Outstanding",
        count: count((r) => r.economics.balanceAfn > 0),
      },
      {
        value: "delivered",
        label: "Delivered",
        count: count((r) => r.order.status === "delivered"),
      },
      {
        value: "closed",
        label: "Cancelled",
        count: count((r) =>
          ["cancelled", "refunded"].includes(r.order.status),
        ),
      },
    ];
  }, [rows]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter(({ order, client, economics }) => {
      switch (tab) {
        case "open":
          if (!ACTIVE_ORDER_STATUSES.includes(order.status)) return false;
          break;
        case "purchasing":
          if (!["confirmed", "purchasing"].includes(order.status)) return false;
          break;
        case "in_transit":
          if (order.status !== "in_transit") return false;
          break;
        case "ready":
          if (!["arrived", "ready_for_pickup"].includes(order.status)) return false;
          break;
        case "unpaid":
          if (economics.balanceAfn <= 0) return false;
          break;
        case "delivered":
          if (order.status !== "delivered") return false;
          break;
        case "closed":
          if (!["cancelled", "refunded"].includes(order.status)) return false;
          break;
      }

      if (store !== "all" && !order.items.some((i) => i.storeId === store))
        return false;
      if (source !== "all" && order.source !== source) return false;

      if (paymentState !== "all") {
        const { balanceAfn, paidAfn } = economics;
        if (paymentState === "paid" && balanceAfn > 0) return false;
        if (paymentState === "unpaid" && paidAfn > 0) return false;
        if (
          paymentState === "partial" &&
          !(paidAfn > 0 && balanceAfn > 0)
        )
          return false;
      }

      if (query) {
        const haystack = `${order.orderNo} ${client?.name ?? ""} ${client?.phone ?? ""} ${order.items
          .map((i) => i.name)
          .join(" ")}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [rows, tab, search, store, source, paymentState]);

  const filtersDirty =
    search !== "" || store !== "all" || source !== "all" || paymentState !== "all";

  const columns = React.useMemo<ColumnDef<OrderRow, unknown>[]>(
    () => [
      {
        id: "orderNo",
        meta: "Order",
        accessorFn: (row) => row.order.orderNo,
        header: "Order",
        cell: ({ row }) => {
          const { order } = row.original;
          return (
            <div className="flex flex-col whitespace-nowrap">
              <span className="tabular text-[13px] font-medium">
                {order.orderNo}
              </span>
              <span className="text-muted-foreground text-xs">
                {ORDER_SOURCE_LABEL[order.source]}
              </span>
            </div>
          );
        },
      },
      {
        id: "client",
        meta: "Client",
        accessorFn: (row) => row.client?.name ?? "",
        header: "Client",
        cell: ({ row }) => {
          const { client } = row.original;
          return (
            <div className="flex max-w-[170px] flex-col">
              <span
                className="truncate text-[13px] font-medium"
                title={client?.name}
              >
                {client?.name ?? "—"}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {client?.city ?? ""}
              </span>
            </div>
          );
        },
      },
      {
        id: "items",
        meta: "Products",
        enableSorting: false,
        accessorFn: (row) => row.order.items.map((i) => i.name).join(", "),
        header: "Products",
        cell: ({ row }) => {
          const { order, unitCount } = row.original;
          const first = order.items[0];
          return (
            <div className="flex min-w-[190px] items-center gap-2.5">
              {first && (
                <ProductThumb
                  size="sm"
                  category={first.category}
                  imageUrl={first.imageUrl}
                  name={first.name}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px]">
                  {first ? truncate(first.name, 30) : "—"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {order.items.length > 1
                    ? `+${order.items.length - 1} more · ${unitCount} units`
                    : `${unitCount} unit${unitCount > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "total",
        meta: "Total (AFN)",
        accessorFn: (row) => row.economics.revenue.totalAfn,
        header: "Total (AFN)",
        cell: ({ row }) => (
          <Money
            value={row.original.economics.revenue.totalAfn}
            className="text-[13px] font-medium"
          />
        ),
      },
      {
        id: "paid",
        meta: "Paid (AFN)",
        accessorFn: (row) => row.economics.paidAfn,
        header: "Paid (AFN)",
        cell: ({ row }) => (
          <Money
            value={row.original.economics.paidAfn}
            tone="muted"
            zeroDash
            className="text-[13px]"
          />
        ),
      },
      {
        id: "balance",
        meta: "Balance (AFN)",
        accessorFn: (row) => row.economics.balanceAfn,
        header: "Balance (AFN)",
        cell: ({ row }) => {
          const balance = row.original.economics.balanceAfn;
          return (
            <Money
              value={balance}
              zeroDash
              className={cn(
                "text-[13px] font-medium",
                balance > 0 && "text-destructive",
              )}
            />
          );
        },
      },
      {
        id: "profit",
        meta: "Profit (AFN)",
        accessorFn: (row) => row.economics.profitAfn,
        header: "Profit (AFN)",
        cell: ({ row }) => {
          const { profitAfn, marginPercent, cost } = row.original.economics;
          // Margin sits inline with the figure so every row stays one line tall.
          return (
            <span className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
              <Money
                value={profitAfn}
                tone="signed"
                className="text-[13px] font-medium"
              />
              <span className="text-muted-foreground tabular text-xs">
                {marginPercent.toFixed(0)}%{cost.estimated && "*"}
              </span>
            </span>
          );
        },
      },
      {
        id: "status",
        meta: "Status",
        accessorFn: (row) => row.order.status,
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge kind="order" value={row.original.order.status} />
        ),
      },
      {
        id: "requested",
        meta: "Created",
        accessorFn: (row) => row.order.requestedAt,
        header: "Created",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-[13px]">
            {formatDateShort(row.original.order.requestedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const { order, shipment } = row.original;
          return (
            <div
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem asChild>
                    <Link href={`/orders/${order.id}`}>
                      <EyeIcon />
                      View order
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setPayingOrder(row.original)}
                  >
                    <CreditCardIcon />
                    Record payment
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/purchases?order=${order.id}`}>
                      <PackagePlusIcon />
                      Purchases
                    </Link>
                  </DropdownMenuItem>
                  {shipment && (
                    <DropdownMenuItem asChild>
                      <Link href={`/tracking/${shipment.id}`}>
                        <TruckIcon />
                        Tracking
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/print/invoice/${order.id}`} target="_blank">
                      <PrinterIcon />
                      Print invoice
                      <ExternalLinkIcon className="ml-auto size-3" />
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        description="Every client request from the first WhatsApp message through to handover."
        meta={
          <span className="text-muted-foreground text-sm">
            {rows.length} total
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/documents">
                <PrinterIcon />
                Documents
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/orders/new">
                <PlusIcon />
                Create new order
              </Link>
            </Button>
          </>
        }
      />

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="orders"
        exportFileName="amanat-orders"
        numericColumns={["total", "paid", "balance", "profit"]}
        initialHiddenColumns={["paid"]}
        initialSorting={[{ id: "requested", desc: true }]}
        onRowClick={(row) => router.push(`/orders/${row.order.id}`)}
        emptyIcon={ShoppingCartIcon}
        emptyTitle="No orders match these filters"
        emptyDescription="Try clearing the search or switching to the All tab."
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search order no, client or product…"
              className="w-full sm:w-72"
            />
            <FilterSelect
              value={store}
              onChange={setStore}
              allLabel="All stores"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              value={source}
              onChange={setSource}
              allLabel="All sources"
              width="w-[140px]"
              options={Object.entries(ORDER_SOURCE_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <FilterSelect
              value={paymentState}
              onChange={(value) => setPaymentState(value as PaymentFilter)}
              allLabel="Any payment"
              width="w-[140px]"
              options={[
                { value: "unpaid", label: "Nothing paid" },
                { value: "partial", label: "Partly paid" },
                { value: "paid", label: "Fully paid" },
              ]}
            />
            <ResetFiltersButton
              show={filtersDirty}
              onReset={() => {
                setSearch("");
                setStore("all");
                setSource("all");
                setPaymentState("all");
              }}
            />
          </>
        }
      />

      <RecordPaymentDialog
        open={!!payingOrder}
        onOpenChange={(open) => !open && setPayingOrder(null)}
        order={payingOrder ?? undefined}
      />
    </>
  );
}
