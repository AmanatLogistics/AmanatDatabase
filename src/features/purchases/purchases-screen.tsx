"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PackageIcon,
  PackagePlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { LogPurchaseDialog } from "@/features/purchases/log-purchase-dialog";
import {
  deletePurchase,
  usePurchaseRows,
  useStores,
  type PurchaseRow,
} from "@/lib/api";
import { formatDateShort, truncate } from "@/lib/format";

/** The order lines a purchase paid for, resolved off its parent order. */
function coveredItems(row: PurchaseRow) {
  return (
    row.order?.items.filter((item) =>
      row.purchase.orderItemIds.includes(item.id),
    ) ?? []
  );
}

export function PurchasesScreen() {
  const router = useRouter();
  const rows = usePurchaseRows();
  const stores = useStores();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [store, setStore] = React.useState("all");
  const [logOpen, setLogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PurchaseRow | null>(null);

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

  const spendAfn = React.useMemo(
    () => filtered.reduce((sum, r) => sum + r.purchase.totalCostAfn, 0),
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
        id: "products",
        meta: "Products",
        enableSorting: false,
        accessorFn: (row) => coveredItems(row)[0]?.name ?? "",
        header: "What we bought",
        cell: ({ row }) => {
          const items = coveredItems(row.original);
          if (items.length === 0) {
            return <span className="text-muted-foreground text-[13px]">—</span>;
          }
          return (
            <div className="flex items-center gap-2.5">
              <ProductThumb
                size="sm"
                category={items[0].category}
                imageUrl={items[0].imageUrl}
                name={items[0].name}
              />
              <div className="min-w-0">
                <p className="text-[13px]">{truncate(items[0].name, 30)}</p>
                {items.length > 1 && (
                  <p className="text-muted-foreground text-xs">
                    +{items.length - 1} more line
                    {items.length > 2 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "cost",
        meta: "Cost",
        accessorFn: (row) => row.purchase.totalCostAfn,
        header: "Cost (AFN)",
        cell: ({ row }) => (
          <Money
            value={row.original.purchase.totalCostAfn}
            className="text-[13px] font-medium"
          />
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
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleting(row.original)}
                >
                  <Trash2Icon />
                  Delete purchase
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
        description="What we bought, where we bought it, and what we paid the store."
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
            <Money value={spendAfn} unit="suffix" />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Average purchase</p>
          <p className="tabular mt-1 text-xl font-semibold">
            <Money
              value={
                filtered.length > 0 ? Math.round(spendAfn / filtered.length) : 0
              }
              unit="suffix"
            />
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
        numericColumns={["cost"]}
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

      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete this purchase?"
          subject={`${deleting.purchase.purchaseNo} · ${Math.round(deleting.purchase.totalCostAfn).toLocaleString()} AFN`}
          consequences={[
            "The cost it recorded, so the order's margin and the P&L change",
          ]}
          confirmLabel="Delete purchase"
          successMessage={`Purchase ${deleting.purchase.purchaseNo} deleted`}
          onConfirm={() => deletePurchase(deleting.purchase.id)}
        />
      )}

      <LogPurchaseDialog open={logOpen} onOpenChange={setLogOpen} />
    </>
  );
}
