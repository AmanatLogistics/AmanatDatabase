"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  PlusIcon,
  TruckIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import {
  CountTabs,
  FilterSelect,
  ResetFiltersButton,
  SearchInput,
} from "@/components/shared/filter-bar";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddTrackingDialog } from "@/features/tracking/add-tracking-dialog";
import { useShipmentRows, type ShipmentRow } from "@/lib/api";
import { CARRIERS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Statuses grouped under the "In transit" tab. */
const MOVING_STATUSES: string[] = [
  "picked_up",
  "in_transit",
  "out_for_delivery",
];

function matchesFilters(
  row: ShipmentRow,
  tab: string,
  carrier: string,
  search: string,
): boolean {
  const { shipment, order, client } = row;

  if (tab !== "all") {
    const matches =
      tab === "moving"
        ? MOVING_STATUSES.includes(shipment.status)
        : shipment.status === tab;
    if (!matches) return false;
  }

  if (carrier !== "all" && shipment.carrier !== carrier) return false;

  const query = search.trim().toLowerCase();
  if (query) {
    const haystack =
      `${shipment.trackingNumber} ${shipment.carrier} ${order?.orderNo ?? ""} ${client?.name ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function TrackingScreen() {
  const router = useRouter();
  const rows = useShipmentRows();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [carrier, setCarrier] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);

  const chips = React.useMemo(() => {
    const count = (status: string) =>
      rows.filter((r) => r.shipment.status === status).length;
    return [
      { value: "all", label: "All", count: rows.length },
      {
        value: "moving",
        label: "In transit",
        count: rows.filter((r) =>
          ["picked_up", "in_transit", "out_for_delivery"].includes(
            r.shipment.status,
          ),
        ).length,
      },
      { value: "customs", label: "In customs", count: count("customs") },
      { value: "exception", label: "Exceptions", count: count("exception") },
      { value: "delivered", label: "Delivered", count: count("delivered") },
    ];
  }, [rows]);

  const problems = rows.filter((r) =>
    ["customs", "exception"].includes(r.shipment.status),
  );

  // Left un-memoized on purpose: the React Compiler memoizes this itself, and a
  // manual useMemo here defeats its optimisation.
  const filtered = rows.filter((row) =>
    matchesFilters(row, tab, carrier, search),
  );

  const columns = React.useMemo<ColumnDef<ShipmentRow, unknown>[]>(
    () => [
      {
        id: "tracking",
        meta: "Tracking",
        accessorFn: (row) => row.shipment.trackingNumber,
        header: "Tracking",
        cell: ({ row }) => {
          const { shipment } = row.original;
          return (
            <div className="min-w-0">
              <p className="tabular text-[13px] font-medium">
                {shipment.trackingNumber}
              </p>
              <p className="text-muted-foreground text-xs">{shipment.carrier}</p>
            </div>
          );
        },
      },
      {
        id: "order",
        meta: "Order",
        accessorFn: (row) => row.order?.orderNo ?? "",
        header: "Order",
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
        id: "route",
        meta: "Route",
        enableSorting: false,
        accessorFn: (row) => `${row.shipment.origin} → ${row.shipment.destination}`,
        header: "Route",
        cell: ({ row }) => {
          const { shipment } = row.original;
          return (
            <span className="text-muted-foreground text-[13px] whitespace-nowrap">
              {shipment.origin.split(",")[0]} → {shipment.destination.split(",")[0]}
            </span>
          );
        },
      },
      {
        id: "weight",
        meta: "Weight",
        accessorFn: (row) => row.shipment.weightKg,
        header: "Weight",
        cell: ({ row }) => (
          <span className="tabular text-[13px]">
            {row.original.shipment.weightKg} kg
          </span>
        ),
      },
      {
        id: "cost",
        meta: "Freight + duty (AFN)",
        accessorFn: (row) =>
          row.shipment.freightCostAfn + row.shipment.customsDutyAfn,
        header: "Freight + duty (AFN)",
        cell: ({ row }) => {
          const { shipment } = row.original;
          return (
            <Money
              value={shipment.freightCostAfn + shipment.customsDutyAfn}
              className="text-[13px]"
            />
          );
        },
      },
      {
        id: "shipped",
        meta: "Shipped",
        accessorFn: (row) => row.shipment.shippedAt ?? "",
        header: "Shipped",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-[13px]">
            {formatDateShort(row.original.shipment.shippedAt)}
          </span>
        ),
      },
      {
        id: "eta",
        meta: "ETA",
        accessorFn: (row) => row.shipment.etaAt ?? "",
        header: "ETA",
        cell: ({ row }) => {
          const { shipment, daysToEta } = row.original;
          if (shipment.status === "delivered") {
            return (
              <span className="text-success text-[13px]">
                {formatDateShort(shipment.deliveredAt)}
              </span>
            );
          }
          return (
            <div className="flex flex-col">
              <span className="tabular text-[13px]">
                {formatDateShort(shipment.etaAt)}
              </span>
              {daysToEta !== null && (
                <span
                  className={cn(
                    "text-xs",
                    daysToEta < 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {daysToEta < 0
                    ? `${Math.abs(daysToEta)}d late`
                    : `in ${daysToEta}d`}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        meta: "Status",
        accessorFn: (row) => row.shipment.status,
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge kind="shipment" value={row.original.shipment.status} />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const { shipment } = row.original;
          if (!shipment.trackingUrl) return null;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" asChild>
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open carrier tracking"
                >
                  <ExternalLinkIcon />
                </a>
              </Button>
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
        title="Tracking"
        description="Where every parcel is between the store and the client's hands."
        meta={
          <span className="text-muted-foreground text-sm">
            {rows.length} shipments
          </span>
        }
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add tracking
          </Button>
        }
      />

      {problems.length > 0 && (
        <Alert variant="warning">
          <AlertTriangleIcon />
          <AlertTitle>
            {problems.length} shipment{problems.length > 1 ? "s need" : " needs"}{" "}
            attention
          </AlertTitle>
          <AlertDescription>
            {problems
              .slice(0, 3)
              .map((row) => `${row.shipment.trackingNumber} (${row.shipment.carrier})`)
              .join(", ")}
            {problems.length > 3 ? ` and ${problems.length - 3} more` : ""} — held
            in customs or failed delivery.
          </AlertDescription>
        </Alert>
      )}

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="shipments"
        exportFileName="amanat-shipments"
        numericColumns={["weight", "cost"]}
        initialSorting={[{ id: "shipped", desc: true }]}
        onRowClick={(row) => router.push(`/tracking/${row.shipment.id}`)}
        emptyIcon={TruckIcon}
        emptyTitle="No shipments match these filters"
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tracking number or order…"
              className="w-full sm:w-72"
            />
            <FilterSelect
              value={carrier}
              onChange={setCarrier}
              allLabel="All carriers"
              width="w-[175px]"
              options={CARRIERS.map((c) => ({ value: c, label: c }))}
            />
            <ResetFiltersButton
              show={search !== "" || carrier !== "all"}
              onReset={() => {
                setSearch("");
                setCarrier("all");
              }}
            />
          </>
        }
      />

      <AddTrackingDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
