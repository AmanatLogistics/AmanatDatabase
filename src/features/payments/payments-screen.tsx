"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon, PrinterIcon, WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import {
  useOrderRows,
  usePaymentMethods,
  usePaymentRows,
  useToday,
  type PaymentRow,
} from "@/lib/api";
import { formatAfn, formatDate } from "@/lib/format";

export function PaymentsScreen() {
  const rows = usePaymentRows();
  const methods = usePaymentMethods();
  const orderRows = useOrderRows();
  const today = useToday();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [method, setMethod] = React.useState("all");
  const [recordOpen, setRecordOpen] = React.useState(false);

  const chips = React.useMemo(() => {
    const count = (type: string) =>
      rows.filter((r) => r.payment.type === type).length;
    return [
      { value: "all", label: "All", count: rows.length },
      { value: "advance", label: "Advances", count: count("advance") },
      { value: "partial", label: "Partial", count: count("partial") },
      { value: "final", label: "Final", count: count("final") },
      { value: "refund", label: "Refunds", count: count("refund") },
    ];
  }, [rows]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ payment, client, order }) => {
      if (tab !== "all" && payment.type !== tab) return false;
      if (method !== "all" && payment.methodId !== method) return false;
      if (query) {
        const haystack =
          `${payment.receiptNo} ${client?.name ?? ""} ${order?.orderNo ?? ""} ${payment.reference ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, tab, search, method]);

  const stats = React.useMemo(() => {
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    ).getTime();

    const collectedThisMonth = rows
      .filter((r) => new Date(r.payment.at).getTime() >= monthStart)
      .reduce((sum, r) => sum + r.payment.amountAfn, 0);

    const outstanding = orderRows.reduce(
      (sum, row) => sum + Math.max(0, row.economics.balanceAfn),
      0,
    );

    return {
      collectedThisMonth,
      outstanding,
      total: rows.reduce((sum, r) => sum + r.payment.amountAfn, 0),
    };
  }, [rows, orderRows, today]);

  const columns = React.useMemo<ColumnDef<PaymentRow, unknown>[]>(
    () => [
      {
        id: "receiptNo",
        meta: "Receipt",
        accessorFn: (row) => row.payment.receiptNo,
        header: "Receipt",
        cell: ({ row }) => (
          <span className="tabular text-[13px] font-medium">
            {row.original.payment.receiptNo}
          </span>
        ),
      },
      {
        id: "client",
        meta: "Client",
        accessorFn: (row) => row.client?.name ?? "",
        header: "Client",
        cell: ({ row }) => {
          const { client } = row.original;
          return client ? (
            <Link
              href={`/clients/${client.id}`}
              className="text-[13px] font-medium hover:underline"
            >
              {client.name}
            </Link>
          ) : (
            <span className="text-muted-foreground text-[13px]">—</span>
          );
        },
      },
      {
        id: "order",
        meta: "Order",
        accessorFn: (row) => row.order?.orderNo ?? "",
        header: "Order",
        cell: ({ row }) => {
          const { order } = row.original;
          return order ? (
            <Link
              href={`/orders/${order.id}`}
              className="tabular text-[13px] hover:underline"
            >
              {order.orderNo}
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">on account</span>
          );
        },
      },
      {
        id: "method",
        meta: "Method",
        accessorFn: (row) => row.method?.name ?? "",
        header: "Method",
        cell: ({ row }) => (
          <span className="text-[13px]">{row.original.method?.name ?? "—"}</span>
        ),
      },
      {
        id: "type",
        meta: "Type",
        accessorFn: (row) => row.payment.type,
        header: "Type",
        cell: ({ row }) => (
          <StatusBadge
            kind="payment"
            value={row.original.payment.type}
            withDot={false}
          />
        ),
      },
      {
        id: "reference",
        meta: "Reference",
        enableSorting: false,
        accessorFn: (row) => row.payment.reference ?? "",
        header: "Reference",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-xs">
            {row.original.payment.reference ?? "—"}
          </span>
        ),
      },
      {
        id: "amount",
        meta: "Amount",
        accessorFn: (row) => row.payment.amountAfn,
        header: "Amount",
        cell: ({ row }) => (
          <Money
            value={row.original.payment.amountAfn}
            className="text-[13px] font-medium"
          />
        ),
      },
      {
        id: "at",
        meta: "Date",
        accessorFn: (row) => row.payment.at,
        header: "Date",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-[13px]">
            {formatDate(row.original.payment.at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link
                href={`/print/receipt/${row.original.payment.id}`}
                target="_blank"
                aria-label="Print receipt"
              >
                <PrinterIcon />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money in from clients — advances, settlements and refunds."
        meta={
          <span className="text-muted-foreground text-sm">
            {rows.length} receipts
          </span>
        }
        actions={
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <PlusIcon />
            Record payment
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Collected this month</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {formatAfn(stats.collectedThisMonth)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Still outstanding</p>
          <p className="tabular text-destructive mt-1 text-xl font-semibold">
            {formatAfn(stats.outstanding)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-[13px]">Collected all time</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {formatAfn(stats.total)}
          </p>
        </Card>
      </div>

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="payments"
        exportFileName="amanat-payments"
        initialSorting={[{ id: "at", desc: true }]}
        emptyIcon={WalletIcon}
        emptyTitle="No payments match these filters"
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search receipt, client or reference…"
              className="w-full sm:w-72"
            />
            <FilterSelect
              value={method}
              onChange={setMethod}
              allLabel="All methods"
              width="w-[180px]"
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
            <ResetFiltersButton
              show={search !== "" || method !== "all"}
              onReset={() => {
                setSearch("");
                setMethod("all");
              }}
            />
          </>
        }
      />

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </>
  );
}
