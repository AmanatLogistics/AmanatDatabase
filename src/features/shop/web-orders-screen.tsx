"use client";

import * as React from "react";
import Link from "next/link";
import { InboxIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { WebOrder } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import type { WebOrderStatus } from "@/lib/types";

const TABS: Array<{ value: WebOrderStatus | "all"; label: string }> = [
  { value: "new", label: "New" },
  { value: "converted", label: "Converted" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const TONE: Record<WebOrderStatus, "warning" | "success" | "muted"> = {
  new: "warning",
  converted: "success",
  dismissed: "muted",
};

/** The inbox. Everything a customer has ordered on the website. */
export function WebOrdersScreen({ orders }: { orders: WebOrder[] }) {
  const [tab, setTab] = React.useState<WebOrderStatus | "all">("new");

  const filtered =
    tab === "all" ? orders : orders.filter((o) => o.status === tab);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Website orders</h1>
        <p className="text-muted-foreground text-sm">
          Requests from the storefront. Converting one creates a real order with
          a tracking number.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const count =
            t.value === "all"
              ? orders.length
              : orders.filter((o) => o.status === t.value).length;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={
                tab === t.value
                  ? "bg-brand-700 text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                  : "hover:bg-muted rounded-md px-3 py-1.5 text-sm transition-colors"
              }
            >
              {t.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={InboxIcon}
            title="Nothing here"
            description="Orders placed on the storefront arrive in this inbox, and you get a notification the moment one does."
          />
        </Card>
      ) : (
        <div className="grid gap-2.5">
          {filtered.map((order) => (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <Link
                  href={`/shop/orders/${order.id}`}
                  className="flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-sm font-semibold">
                        {order.reference}
                      </span>
                      <Badge variant={TONE[order.status]}>
                        {order.status === "new"
                          ? "Needs action"
                          : order.status === "converted"
                            ? "Converted"
                            : "Dismissed"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm">
                      {order.customerName} · {order.customerPhone}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(order.placedAt)} ·{" "}
                      {order.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                    </p>
                    {order.trackingNumber && (
                      <p className="text-muted-foreground tabular mt-1 text-xs">
                        Tracking {order.trackingNumber}
                      </p>
                    )}
                  </div>
                  <Money value={order.totalAfn} className="font-semibold" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
