"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  useClientLookup,
  useOrders,
  usePurchases,
  useShipments,
} from "@/lib/api";

/**
 * Resolves the current route to the crumb trail the top bar renders.
 *
 * Keeping this in one hook — rather than having each screen push its own title
 * up into the chrome — means the bar is filled on the very first render, with no
 * set-state-in-effect (which the React Compiler lint rejects) and no context
 * provider threaded through every page.
 *
 * Dynamic segments resolve to the record's own name (order number, client name,
 * purchase number, tracking number) so the trail reads the way the team refers
 * to the thing, not as an opaque id.
 */

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageMeta {
  /** Everything up to the current page; may be empty on a top-level route. */
  parents: Crumb[];
  /** The page itself — rendered as the <h1>. */
  title: string;
}

/** Static routes. Anything not listed is resolved from its dynamic record. */
const STATIC: Record<string, PageMeta> = {
  "/": { parents: [], title: "Dashboard" },
  "/orders": { parents: [], title: "Orders" },
  "/orders/new": {
    parents: [{ label: "Orders", href: "/orders" }],
    title: "New order",
  },
  "/clients": { parents: [], title: "Clients" },
  "/clients/new": {
    parents: [{ label: "Clients", href: "/clients" }],
    title: "New client",
  },
  "/purchases": { parents: [], title: "Purchases" },
  "/tracking": { parents: [], title: "Tracking" },
  "/payments": { parents: [], title: "Payments" },
  "/finance": { parents: [], title: "Finance & accounting" },
  "/finance/balances": {
    parents: [{ label: "Finance & accounting", href: "/finance" }],
    title: "Client balances",
  },
  "/documents": { parents: [], title: "Documents" },
  "/settings": { parents: [], title: "Settings" },
  "/settings/stores": {
    parents: [{ label: "Settings", href: "/settings" }],
    title: "Stores",
  },
  "/settings/payment-methods": {
    parents: [{ label: "Settings", href: "/settings" }],
    title: "Payment methods",
  },
  "/settings/team": {
    parents: [{ label: "Settings", href: "/settings" }],
    title: "Team",
  },
};

/** Section a dynamic record belongs to, keyed by the first path segment. */
const SECTION: Record<string, { label: string; href: string }> = {
  orders: { label: "Orders", href: "/orders" },
  clients: { label: "Clients", href: "/clients" },
  purchases: { label: "Purchases", href: "/purchases" },
  tracking: { label: "Tracking", href: "/tracking" },
};

export function usePageMeta(): PageMeta {
  const pathname = usePathname();
  const orders = useOrders();
  const clientOf = useClientLookup();
  const purchases = usePurchases();
  const shipments = useShipments();

  return useMemo(() => {
    const known = STATIC[pathname];
    if (known) return known;

    const segments = pathname.split("/").filter(Boolean);
    const section = SECTION[segments[0] ?? ""];
    const id = segments[1];

    if (!section || !id) {
      // Unknown route — fall back to a readable version of the last segment.
      const last = segments[segments.length - 1] ?? "Dashboard";
      return {
        parents: [],
        title: last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " "),
      };
    }

    let title = id;
    switch (segments[0]) {
      case "orders":
        title = orders.find((o) => o.id === id)?.orderNo ?? "Order";
        break;
      case "clients":
        title = clientOf(id)?.name ?? "Client";
        break;
      case "purchases":
        title = purchases.find((p) => p.id === id)?.purchaseNo ?? "Purchase";
        break;
      case "tracking":
        title =
          shipments.find((s) => s.id === id)?.trackingNumber ?? "Shipment";
        break;
    }

    return { parents: [section], title };
  }, [pathname, orders, clientOf, purchases, shipments]);
}
