"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageIcon, PackagePlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import {
  CountTabs,
  FilterSelect,
  ResetFiltersButton,
  SearchInput,
} from "@/components/shared/filter-bar";
import { Money, MoneyUsd } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LogPurchaseDialog } from "@/features/purchases/log-purchase-dialog";
import { usePurchaseRows, useStores, type PurchaseRow } from "@/lib/api";
import { formatDateShort, formatUsd } from "@/lib/format";

export function PurchasesScreen() {
  const router = useRouter();
  const rows = usePurchaseRows();
  const stores = useStores();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [store, setStore] = React.useState("all");
  const [logOpen, setLogOpen] = React.useState(false);

  const chips = React.useMemo(() => {
    const count = (status: string) =>
      rows.filter((r) => r.purchase.status === status).length;
    return [
      { value: "all", label: "All", count: rows.length },
      { value: "pending", label: "Pending", count: count("pending") },
      { value: "placed", label: "Placed", count: count("placed") },
      {
        value: "shipped_to_warehouse",
        label: "To warehouse",
        count: count("shipped_to_warehouse"),
      },
      { value: "received", label: "Received", count: count("received") },
      { value: "refunded", label: "Refunded", count: count("refunded") },
    ];
  }, [rows]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ purchase, order, client, store: purchaseStore }) => {
      if (tab !== "all" && purchase.status !== tab) return false;
      if (store !== "all" && purchase.storeId !== store) return false;
      if (query) {
        const haystack =
          `${purchase.purchaseNo} ${purchase.externalOrderNumber} ${order?.orderNo ?? ""} ${client?.name ?? ""} ${purchaseStore?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, tab, search, store]);

  const totals = React.useMemo(
    () => ({
      usd: filtered.reduce((sum, r) => sum + r.totalUsd, 0),
      afn: filtered.reduce((sum, r) => sum + r.totalAfn, 0),
    }),
    [filtered],
  );

  const columns = React.useMemo<ColumnDef<PurchaseRow, unknown>[]>(
    () => [
      {
        id: "purchaseNo",
        meta: "Purchase",
        accessorFn: (row) => row.purchase.purchaseNo,
        header: "Purchase",
        cell: ({ row }) => (
          <span className="tabular text-[13px] font-medium">
            {row.original.purchase.purchaseNo}
          </span>
        ),
      },
      {
        id: "store",
        meta: "Store",
        accessorFn: (row) => row.store?.name ?? "",
        header: "Bought from",
        cell: ({ row }) => {
          const { store: purchaseStore, purchase } = row.original;
          return (
            <div className="min-w-0">
              <p className="text-[13px] font-medium">
                {purchaseStore?.name ?? "—"}
              </p>
              <p className="text-muted-foreground tabular text-xs">
                {purchase.externalOrderNumber}
              </p>
            </div>
          );
        },
      },
      {
        id: "order",
        meta: "Order",
        accessorFn: (row) => row.order?.orderNo ?? "",
        header: "For order",
        cell: ({ row }) => {
          const { order, client } = row.original;
          return (
            <div className="min-w-0">
              {order ? (
                <Link
                  href={`/orders/${order.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="tabular text-[13px] font-medium hover:underline"
                >
                  {order.orderNo}
                </Link>
              ) : (
                <span className="text-muted-foreground text-[13px]">—</span>
              )}
              <p className="text-muted-foreground truncate text-xs">
                {client?.name ?? ""}
              </p>
            </div>
          );
        },
      },
      {
        id: "items",
        meta: "Items (USD)",
        accessorFn: (row) => row.purchase.itemsCostUsd,
        header: "Items (USD)",
        cell: ({ row }) => (
          <MoneyUsd
            value={row.original.purchase.itemsCostUsd}
            className="text-muted-foreground text-[13px]"
          />
        ),
      },
      {
        id: "extras",
        meta: "Tax + ship (USD)",
        enableSorting: false,
        accessorFn: (row) =>
          row.purchase.taxUsd +
          row.purchase.domesticShippingUsd +
          row.purchase.otherCostUsd,
        header: "Tax + ship (USD)",
        cell: ({ row }) => {
          const { purchase } = row.original;
          const extras =
            purchase.taxUsd + purchase.domesticShippingUsd + purchase.otherCostUsd;
          return (
            <MoneyUsd
              value={extras}
              className="text-muted-foreground text-[13px]"
            />
          );
        },
      },
      {
        id: "totalUsd",
        meta: "Total USD",
        accessorFn: (row) => row.totalUsd,
        header: "Total (USD)",
        cell: ({ row }) => (
          <MoneyUsd value={row.original.totalUsd} className="text-[13px] font-medium" />
        ),
      },
      {
        id: "totalAfn",
        meta: "Total AFN",
        accessorFn: (row) => row.totalAfn,
        header: "Total (AFN)",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Money value={row.original.totalAfn} className="text-[13px] font-medium" />
            <span className="text-muted-foreground tabular text-xs">
              @ {row.original.purchase.fxRate}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        meta: "Status",
        accessorFn: (row) => row.purchase.status,
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge kind="purchase" value={row.original.purchase.status} />
        ),
      },
      {
        id: "purchasedAt",
        meta: "Date",
        accessorFn: (row) => row.purchase.purchasedAt,
        header: "Date",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-[13px]">
            {formatDateShort(row.original.purchase.purchasedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Purchases"
        description="What we bought, where we bought it, and what it cost before freight."
        meta={
          <span className="text-muted-foreground text-sm">
            {rows.length} purchases
          </span>
        }
        actions={
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <PackagePlusIcon />
            Log purchase
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Spend (filtered)</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {formatUsd(totals.usd)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">In Afghani</p>
          <p className="tabular mt-1 text-xl font-semibold">
            <Money value={totals.afn} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Awaiting receipt</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {
              rows.filter((r) =>
                ["placed", "shipped_to_warehouse"].includes(r.purchase.status),
              ).length
            }
          </p>
        </Card>
      </div>

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="purchases"
        exportFileName="amanat-purchases"
        numericColumns={["items", "extras", "totalUsd", "totalAfn"]}
        initialSorting={[{ id: "purchasedAt", desc: true }]}
        onRowClick={(row) => router.push(`/purchases/${row.purchase.id}`)}
        emptyIcon={PackageIcon}
        emptyTitle="No purchases match these filters"
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search PO, store order number…"
              className="w-full sm:w-72"
            />
            <FilterSelect
              value={store}
              onChange={setStore}
              allLabel="All stores"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
            <ResetFiltersButton
              show={search !== "" || store !== "all"}
              onReset={() => {
                setSearch("");
                setStore("all");
              }}
            />
          </>
        }
      />

      <LogPurchaseDialog open={logOpen} onOpenChange={setLogOpen} />
    </>
  );
}
