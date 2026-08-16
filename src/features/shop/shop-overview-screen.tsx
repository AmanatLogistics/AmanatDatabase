"use client";

import Link from "next/link";
import { InboxIcon, PackageIcon, TagsIcon } from "lucide-react";

import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStoreProducts, useWebOrders } from "@/lib/api";
import { formatRelative } from "@/lib/format";

/**
 * The shop's front page: what is listed, and what has come in.
 *
 * Deliberately thin. The operations dashboard already answers the money
 * questions; this one only answers "is there anything for me to do here".
 */
export function ShopOverviewScreen() {
  const products = useStoreProducts();
  const webOrders = useWebOrders();

  const published = products.filter((p) => p.active).length;
  const newOrders = webOrders.filter((o) => o.status === "new");
  const converted = webOrders.filter((o) => o.status === "converted").length;

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Shop overview</h1>
        <p className="text-muted-foreground text-sm">
          What you are selling, and what customers have ordered.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={TagsIcon}
          label="Published products"
          value={`${published}`}
          hint={`${products.length - published} unpublished`}
          href="/shop/products"
        />
        <Stat
          icon={InboxIcon}
          label="Waiting for you"
          value={`${newOrders.length}`}
          hint="New website orders"
          href="/shop/orders"
          highlight={newOrders.length > 0}
        />
        <Stat
          icon={PackageIcon}
          label="Turned into orders"
          value={`${converted}`}
          hint="Now in operations"
          href="/shop/orders"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Latest website orders</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/shop/orders">See all</Link>
            </Button>
          </div>
          {webOrders.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nothing yet. Orders placed on the storefront land here.
            </p>
          ) : (
            <ul className="divide-y">
              {webOrders.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/shop/orders/${order.id}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded px-2 py-2.5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {order.reference} · {order.customerName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatRelative(order.placedAt)} ·{" "}
                        {order.lines.length} product
                        {order.lines.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Money value={order.totalAfn} className="text-[13px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-gold-500/50" : undefined}>
      <CardContent className="pt-6">
        <Link href={href} className="flex items-start gap-3">
          <span className="bg-brand-700/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300 flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-muted-foreground text-xs">{hint}</p>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
