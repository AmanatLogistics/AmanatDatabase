"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CreditCardIcon,
  EyeIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  PhoneIcon,
  PlusIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import {
  clientDeletionImpact,
  deleteClient,
  useClientRows,
  type ClientRow,
} from "@/lib/api";
import { CLIENT_TYPE_LABEL, CONTACT_CHANNEL_LABEL } from "@/lib/constants";
import { formatDateShort, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ClientsScreen() {
  const router = useRouter();
  const rows = useClientRows();

  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [city, setCity] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [payingClient, setPayingClient] = React.useState<ClientRow | null>(null);
  const [deleting, setDeleting] = React.useState<ClientRow | null>(null);

  const cities = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.client.city))).sort(),
    [rows],
  );

  const chips = React.useMemo(
    () => [
      { value: "all", label: "All", count: rows.length },
      {
        value: "owing",
        label: "Owing money",
        count: rows.filter((r) => r.summary.balanceAfn > 0).length,
      },
      {
        value: "active",
        label: "With open orders",
        count: rows.filter((r) => r.summary.activeOrderCount > 0).length,
      },
      {
        value: "business",
        label: "Businesses",
        count: rows.filter((r) => r.client.type === "business").length,
      },
      {
        value: "dormant",
        label: "Dormant",
        count: rows.filter((r) => r.client.status !== "active").length,
      },
    ],
    [rows],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ client, summary }) => {
      switch (tab) {
        case "owing":
          if (summary.balanceAfn <= 0) return false;
          break;
        case "active":
          if (summary.activeOrderCount === 0) return false;
          break;
        case "business":
          if (client.type !== "business") return false;
          break;
        case "dormant":
          if (client.status === "active") return false;
          break;
      }
      if (city !== "all" && client.city !== city) return false;
      if (type !== "all" && client.type !== type) return false;
      if (query) {
        const haystack =
          `${client.name} ${client.code} ${client.phone} ${client.email ?? ""} ${client.city}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, tab, search, city, type]);

  const columns = React.useMemo<ColumnDef<ClientRow, unknown>[]>(
    () => [
      {
        id: "name",
        meta: "Client",
        accessorFn: (row) => row.client.name,
        header: "Client",
        cell: ({ row }) => {
          const { client } = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                {initials(client.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{client.name}</p>
                <p className="text-muted-foreground tabular text-xs">
                  {client.code}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "contact",
        meta: "Contact",
        enableSorting: false,
        accessorFn: (row) => row.client.phone,
        header: "Contact",
        cell: ({ row }) => {
          const { client } = row.original;
          return (
            <div className="min-w-0">
              <p className="tabular text-[13px]">{client.phone}</p>
              <p className="text-muted-foreground text-xs">
                {CONTACT_CHANNEL_LABEL[client.preferredContact]}
              </p>
            </div>
          );
        },
      },
      {
        id: "city",
        meta: "City",
        accessorFn: (row) => row.client.city,
        header: "City",
        cell: ({ row }) => (
          <span className="text-[13px]">{row.original.client.city}</span>
        ),
      },
      {
        id: "type",
        meta: "Type",
        accessorFn: (row) => row.client.type,
        header: "Type",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-[13px]">
            {CLIENT_TYPE_LABEL[row.original.client.type]}
          </span>
        ),
      },
      {
        id: "orders",
        meta: "Orders",
        accessorFn: (row) => row.summary.orderCount,
        header: "Orders",
        cell: ({ row }) => {
          const { orderCount, activeOrderCount } = row.original.summary;
          return (
            <div className="tabular text-[13px]">
              {orderCount}
              {activeOrderCount > 0 && (
                <span className="text-muted-foreground text-xs">
                  {" "}
                  ({activeOrderCount} open)
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "revenue",
        meta: "Lifetime revenue (AFN)",
        accessorFn: (row) => row.summary.lifetimeRevenueAfn,
        header: "Lifetime (AFN)",
        cell: ({ row }) => (
          <Money
            value={row.original.summary.lifetimeRevenueAfn}
            className="text-[13px]"
          />
        ),
      },
      {
        id: "balance",
        meta: "Balance (AFN)",
        accessorFn: (row) => row.summary.balanceAfn,
        header: "Balance (AFN)",
        cell: ({ row }) => {
          const { balanceAfn, oldestDebtDays } = row.original.summary;
          return (
            <div className="flex flex-col">
              <Money
                value={balanceAfn}
                className={cn(
                  "text-[13px] font-medium",
                  balanceAfn > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              />
              {balanceAfn > 0 && oldestDebtDays > 45 && (
                <span className="text-destructive/80 text-xs">
                  {oldestDebtDays}d overdue
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "lastOrder",
        meta: "Last order",
        accessorFn: (row) => row.summary.lastOrderAt ?? "",
        header: "Last order",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular text-[13px]">
            {formatDateShort(row.original.summary.lastOrderAt)}
          </span>
        ),
      },
      {
        id: "status",
        meta: "Status",
        accessorFn: (row) => row.client.status,
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge kind="client" value={row.original.client.status} />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const { client } = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/clients/${client.id}`}>
                      <EyeIcon />
                      Open client file
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/orders/new">
                      <ShoppingCartIcon />
                      New order
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setPayingClient(row.original)}
                  >
                    <CreditCardIcon />
                    Record payment
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleting(row.original)}
                  >
                    <Trash2Icon />
                    Delete client
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={`tel:${client.phone}`}>
                      <PhoneIcon />
                      Call
                    </a>
                  </DropdownMenuItem>
                  {client.whatsapp && (
                    <DropdownMenuItem asChild>
                      <a
                        href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircleIcon />
                        WhatsApp
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [],
  );

  const totalOutstanding = filtered.reduce(
    (sum, row) => sum + Math.max(0, row.summary.balanceAfn),
    0,
  );

  return (
    <>
      <PageHeader
        description="Who buys from us, what they have ordered, and what they still owe."
        meta={
          <span className="text-muted-foreground text-sm">
            {rows.length} clients ·{" "}
            <Money value={totalOutstanding} className="text-destructive" />{" "}
            outstanding
          </span>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/clients/new">
              <PlusIcon />
              Add client
            </Link>
          </Button>
        }
      />

      <CountTabs value={tab} onChange={setTab} chips={chips} />

      <DataTable
        columns={columns}
        data={filtered}
        entityName="clients"
        exportFileName="amanat-clients"
        numericColumns={["orders", "revenue", "balance"]}
        initialSorting={[{ id: "balance", desc: true }]}
        onRowClick={(row) => router.push(`/clients/${row.client.id}`)}
        emptyIcon={UsersIcon}
        emptyTitle="No clients match these filters"
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, code or phone…"
              className="w-full sm:w-64"
            />
            <FilterSelect
              value={city}
              onChange={setCity}
              allLabel="All cities"
              width="w-[145px]"
              options={cities.map((c) => ({ value: c, label: c }))}
            />
            <FilterSelect
              value={type}
              onChange={setType}
              allLabel="All types"
              width="w-[130px]"
              options={[
                { value: "individual", label: "Individual" },
                { value: "business", label: "Business" },
              ]}
            />
            <ResetFiltersButton
              show={search !== "" || city !== "all" || type !== "all"}
              onReset={() => {
                setSearch("");
                setCity("all");
                setType("all");
              }}
            />
          </>
        }
      />

      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete this client?"
          subject={`${deleting.client.name} · ${deleting.client.code}`}
          consequences={describeClientDeletion(deleting.client.id)}
          confirmLabel="Delete client"
          successMessage={`${deleting.client.name} deleted`}
          onConfirm={() => deleteClient(deleting.client.id)}
        />
      )}

      <RecordPaymentDialog
        open={!!payingClient}
        onOpenChange={(open) => !open && setPayingClient(null)}
        clientId={payingClient?.client.id}
      />
    </>
  );
}

/**
 * A client rarely stands alone — their orders, the purchases made for those
 * orders and every payment they made all go with them. Naming the counts is the
 * difference between an informed decision and a nasty surprise.
 */
function describeClientDeletion(clientId: string): string[] {
  const { orders, purchases, payments } = clientDeletionImpact(clientId);
  const lines: string[] = [];
  if (orders > 0) lines.push(`${orders} order${orders > 1 ? "s" : ""}`);
  if (purchases > 0)
    lines.push(`${purchases} logged purchase${purchases > 1 ? "s" : ""}`);
  if (payments > 0)
    lines.push(`${payments} recorded payment${payments > 1 ? "s" : ""}`);
  return lines;
}
