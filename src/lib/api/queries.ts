"use client";

import { useMemo } from "react";

import {
  AGING_BUCKET_LABEL,
  buildLedgerIndex,
  clientSummary,
  deltaPercent,
  isActive,
  isBillable,
  monthlySeries,
  orderEconomics,
  orderRevenue,
  periodPnL,
  receivablesAging,
  startOfMonth,
  type AgingRow,
  type ClientSummary,
  type LedgerIndex,
  type MonthlyPoint,
  type OrderEconomics,
  type PeriodPnL,
} from "@/lib/finance";
import { useDataStore } from "@/lib/store";
import {
  CLIENT_STATUS_MESSAGE,
  clientProgressIndex,
  DOCUMENT_KIND_LABEL,
  ORDER_STATUS,
} from "@/lib/constants";
import type {
  AppNotification,
  BusinessDocument,
  Client,
  ID,
  ISODate,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  Purchase,
  Settings,
  Store,
  StoreProduct,
  WebOrder,
} from "@/lib/types";

/**
 * Read side of the data layer.
 *
 * Each hook below is the client-side stand-in for one backend endpoint (named in
 * the comment above it). They currently read the in-memory store and derive view
 * models with `src/lib/finance.ts`. When the API exists, swap each body for a
 * `useQuery(...)` against that endpoint — the return shapes are the contract and
 * no screen needs to change.
 */

/* -------------------------------------------------------------------------- */
/* Settings — GET /api/settings                                                */
/* -------------------------------------------------------------------------- */

export function useSettings(): Settings {
  return useDataStore((s) => s.settings);
}

export function useCompany() {
  return useDataStore((s) => s.settings.company);
}

export function useStores(): Store[] {
  return useDataStore((s) => s.settings.stores);
}

export function usePaymentMethods(): PaymentMethod[] {
  return useDataStore((s) => s.settings.paymentMethods);
}

export function useTeam() {
  return useDataStore((s) => s.settings.team);
}

/** Frozen "now". Keeps ageing and ETA maths identical on server and client. */
export function useToday(): Date {
  return useDataStore((s) => s.today);
}

/* -------------------------------------------------------------------------- */
/* Ledger index                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One set of order-keyed lookups shared by every derivation on the screen.
 *
 * Without it, each of the ~150 orders re-scans all payments, purchases and
 * payments to find its own — quadratic work repeated on every render. Building
 * the index once per data change makes those lookups constant time.
 */
export function useLedgerIndex(): LedgerIndex {
  const orders = useDataStore((s) => s.orders);
  const purchases = useDataStore((s) => s.purchases);
  const payments = useDataStore((s) => s.payments);
  return useMemo(
    () => buildLedgerIndex(orders, purchases, payments),
    [orders, purchases, payments],
  );
}

/* -------------------------------------------------------------------------- */
/* Lookup helpers                                                              */
/* -------------------------------------------------------------------------- */

export function useStoreLookup(): (id: ID) => Store | undefined {
  const stores = useStores();
  return useMemo(() => {
    const map = new Map(stores.map((s) => [s.id, s]));
    return (id: ID) => map.get(id);
  }, [stores]);
}

export function usePaymentMethodLookup(): (id: ID) => PaymentMethod | undefined {
  const methods = usePaymentMethods();
  return useMemo(() => {
    const map = new Map(methods.map((m) => [m.id, m]));
    return (id: ID) => map.get(id);
  }, [methods]);
}

export function useClientLookup(): (id: ID) => Client | undefined {
  const clients = useDataStore((s) => s.clients);
  return useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c]));
    return (id: ID) => map.get(id);
  }, [clients]);
}

/* -------------------------------------------------------------------------- */
/* Clients — GET /api/clients                                                  */
/* -------------------------------------------------------------------------- */

export interface ClientRow {
  client: Client;
  summary: ClientSummary;
}

export function useClients(): Client[] {
  return useDataStore((s) => s.clients);
}

export function useClientRows(): ClientRow[] {
  const clients = useDataStore((s) => s.clients);
  const index = useLedgerIndex();
  const today = useToday();

  return useMemo(
    () =>
      clients.map((client) => ({
        client,
        summary: clientSummary(client.id, index, today),
      })),
    [clients, index, today],
  );
}

/** GET /api/clients/:id */
export function useClient(id: ID): ClientRow | undefined {
  const clients = useDataStore((s) => s.clients);
  const index = useLedgerIndex();
  const today = useToday();

  return useMemo(() => {
    const client = clients.find((c) => c.id === id);
    if (!client) return undefined;
    return { client, summary: clientSummary(client.id, index, today) };
  }, [clients, id, index, today]);
}

/* -------------------------------------------------------------------------- */
/* Orders — GET /api/orders                                                    */
/* -------------------------------------------------------------------------- */

export interface OrderRow {
  order: Order;
  client?: Client;
  economics: OrderEconomics;
  purchases: Purchase[];
  itemCount: number;
  unitCount: number;
}

export function useOrders(): Order[] {
  return useDataStore((s) => s.orders);
}

export function useOrderRows(): OrderRow[] {
  const orders = useDataStore((s) => s.orders);
  const index = useLedgerIndex();
  const clientOf = useClientLookup();

  return useMemo(
    () =>
      orders.map((order) => ({
        order,
        client: clientOf(order.clientId),
        economics: orderEconomics(order, index),
        purchases: index.purchasesByOrder.get(order.id) ?? [],
        itemCount: order.items.length,
        unitCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      })),
    [orders, index, clientOf],
  );
}

/** GET /api/orders/:id */
export function useOrder(id: ID): OrderRow | undefined {
  const orders = useDataStore((s) => s.orders);
  const index = useLedgerIndex();
  const clientOf = useClientLookup();

  return useMemo(() => {
    const order = orders.find((o) => o.id === id);
    if (!order) return undefined;
    return {
      order,
      client: clientOf(order.clientId),
      economics: orderEconomics(order, index),
      purchases: index.purchasesByOrder.get(order.id) ?? [],
      itemCount: order.items.length,
      unitCount: order.items.reduce((sum, i) => sum + i.qty, 0),
    };
  }, [orders, id, index, clientOf]);
}

/** GET /api/clients/:id/orders */
export function useClientOrders(clientId: ID): OrderRow[] {
  const rows = useOrderRows();
  return useMemo(
    () => rows.filter((r) => r.order.clientId === clientId),
    [rows, clientId],
  );
}

/* -------------------------------------------------------------------------- */
/* Public tracking — GET /api/track/:trackingNumber                            */
/* -------------------------------------------------------------------------- */

/**
 * Everything a client is allowed to see, and nothing else.
 *
 * This type is the security boundary. It exists so the allowlist is one object
 * a reviewer can read top to bottom, rather than a property of how the public
 * page happens to be written — a page that received the whole `Order` would
 * leak the moment someone added a field to a JSX block.
 *
 * Deliberately absent: the client in any form (no name, no phone even partial,
 * no address, no city, no code), `orderNo`, `notes`, every `*Afn` figure,
 * `unitCostAfn`, `unitPriceAfn`, `productUrl`, `storeId`, purchases and
 * purchases. See SPEC.md §2.4 for the full list and the reasoning.
 *
 * `OrderEvent.title`, `.description` and `.actor` are excluded on purpose: they
 * are free text typed by staff, so the timeline below carries the status label
 * from the registry instead of anything stored.
 *
 * NOTE (SPEC.md §2.4, risk R1): while the app is frontend-only this projection
 * controls what is *rendered*, not what is *shipped* — the whole dataset is
 * already in the browser. It becomes a real boundary when this is served by
 * `GET /api/track/:trackingNumber`.
 */
export interface PublicTrackingItem {
  name: string;
  qty: number;
  imageUrl?: string;
}

export interface PublicTrackingEvent {
  at: ISODate;
  /** From ORDER_STATUS, never stored free text. */
  statusLabel: string;
}

export interface PublicTrackingResult {
  trackingNumber: string;
  statusLabel: string;
  /** The status explained to the customer, not the internal label. */
  statusMessage: string;
  /** Position on the five-stage customer rail, or null when off it. */
  progressIndex: number | null;
  /** Has it reached the office the client collects from? */
  arrivedAtOffice: boolean;
  /** True once handed over. */
  delivered: boolean;
  /** When the client placed it. Their own date — safe to show them. */
  placedAt: ISODate;
  /** When it was handed over, if it has been. */
  deliveredAt?: ISODate;
  items: PublicTrackingItem[];
  timeline: PublicTrackingEvent[];
}

/**
 * Where to collect from, and who to call.
 *
 * Company details, not client data — the same information printed on an
 * invoice or a shop sign, so there is nothing here to leak.
 */
export interface PublicPickupDetails {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  phone: string;
  whatsapp: string;
  /** The lines that are filled in, joined. Never has dangling commas. */
  address: string;
}

export function usePublicPickupDetails(): PublicPickupDetails {
  const company = useDataStore((s) => s.settings.company);
  return useMemo(
    () => ({
      companyName: company.name,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      city: company.city,
      phone: company.phone,
      whatsapp: company.whatsapp,
      /*
       * Composed here rather than in the page, from whichever lines are filled
       * in. A profile with no street used to render "Collect from , , Kandahar"
       * — the punctuation for fields that were not there.
       */
      address: [company.addressLine1, company.addressLine2, company.city]
        .map((line) => line.trim())
        .filter(Boolean)
        .join(", "),
    }),
    [company],
  );
}

/** The stages at which the parcel is physically with us in Kabul. */
const ARRIVED_STATUSES: OrderStatus[] = [
  "arrived",
  "ready_for_pickup",
  "delivered",
];

/**
 * Look one order up by whatever reference the customer happens to hold.
 *
 * They may have either: a tracking number, if we have already taken the order
 * on; or the WEB-… reference the storefront gave them at checkout, before a
 * human has looked at it. Both must work, because the customer does not know
 * which of our systems their order is currently sitting in — and telling them
 * "not found" for a reference we ourselves issued would be indefensible.
 *
 * A website order that has since been converted resolves to the real order, so
 * the old reference keeps working forever rather than going dead the moment
 * staff process it.
 */
export function usePublicTracking(
  reference: string,
): PublicTrackingResult | null {
  const orders = useDataStore((s) => s.orders);
  const webOrders = useDataStore((s) => s.webOrders);
  const storeProducts = useDataStore((s) => s.storeProducts);

  return useMemo(() => {
    const wanted = reference.trim().toUpperCase();
    if (!wanted) return null;

    let order = orders.find((o) => o.trackingNumber === wanted);

    if (!order) {
      const web = webOrders.find((w) => w.reference === wanted);
      if (!web) return null;

      // Converted: follow it through to the order it became.
      if (web.convertedOrderId) {
        order = orders.find((o) => o.id === web.convertedOrderId);
      }

      // Still waiting on us. Show it honestly as received but not yet started,
      // rather than pretending it is further along than it is.
      if (!order) {
        const dismissed = web.status === "dismissed";
        return {
          trackingNumber: web.reference,
          statusLabel: dismissed ? "Not proceeding" : "Order received",
          statusMessage: dismissed
            ? "We were not able to take this order on. Please contact us."
            : "We have your order and are confirming the price. We will call you shortly.",
          progressIndex: dismissed ? null : 0,
          arrivedAtOffice: false,
          delivered: false,
          placedAt: web.placedAt,
          items: web.lines.map((line) => ({
            name: line.name,
            qty: line.qty,
            imageUrl: storeProducts.find((p) => p.id === line.productId)
              ?.imageUrls[0],
          })),
          timeline: [{ at: web.placedAt, statusLabel: "Order received" }],
        };
      }
    }

    if (!order) return null;

    return {
      trackingNumber: order.trackingNumber,
      statusLabel: ORDER_STATUS[order.status].label,
      statusMessage: CLIENT_STATUS_MESSAGE[order.status],
      progressIndex: clientProgressIndex(order.status),
      arrivedAtOffice: ARRIVED_STATUSES.includes(order.status),
      delivered: order.status === "delivered",
      placedAt: order.requestedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        imageUrl: item.imageUrl,
      })),
      timeline: order.timeline
        .filter((event) => event.status in ORDER_STATUS)
        .map((event) => ({
          at: event.at,
          statusLabel: ORDER_STATUS[event.status as OrderStatus].label,
        })),
    };
  }, [orders, webOrders, storeProducts, reference]);
}

/* -------------------------------------------------------------------------- */
/* Shop — GET /api/shop/products, /api/shop/orders                             */
/* -------------------------------------------------------------------------- */

/** Everything in the catalogue, published or not. Staff only. */
export function useStoreProducts(): StoreProduct[] {
  return useDataStore((s) => s.storeProducts);
}

/** Only what a customer may see. The storefront reads this, never the above. */
export function usePublishedProducts(): StoreProduct[] {
  const products = useDataStore((s) => s.storeProducts);
  return useMemo(() => products.filter((p) => p.active), [products]);
}

export function useStoreProductBySlug(slug: string): StoreProduct | undefined {
  const products = useDataStore((s) => s.storeProducts);
  return useMemo(
    () => products.find((p) => p.slug === slug && p.active),
    [products, slug],
  );
}

export interface CartRow {
  product: StoreProduct;
  qty: number;
  lineTotalAfn: number;
}

export function useCart(): { lines: CartRow[]; totalAfn: number; count: number } {
  const cart = useDataStore((s) => s.cart);
  const products = useDataStore((s) => s.storeProducts);

  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines: CartRow[] = [];
    cart.forEach((line) => {
      const product = byId.get(line.productId);
      // A product deleted since it was added simply drops out of the basket.
      if (!product) return;
      lines.push({
        product,
        qty: line.qty,
        lineTotalAfn: product.priceAfn * line.qty,
      });
    });
    return {
      lines,
      totalAfn: lines.reduce((sum, l) => sum + l.lineTotalAfn, 0),
      count: lines.reduce((sum, l) => sum + l.qty, 0),
    };
  }, [cart, products]);
}

export function useWebOrders(): WebOrder[] {
  return useDataStore((s) => s.webOrders);
}

export function useWebOrder(id: ID): WebOrder | undefined {
  const webOrders = useDataStore((s) => s.webOrders);
  return useMemo(() => webOrders.find((o) => o.id === id), [webOrders, id]);
}

/** Web orders nobody has dealt with yet — the shop admin's inbox count. */
export function useNewWebOrderCount(): number {
  const webOrders = useDataStore((s) => s.webOrders);
  return useMemo(
    () => webOrders.filter((o) => o.status === "new").length,
    [webOrders],
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications — GET /api/notifications                                      */
/* -------------------------------------------------------------------------- */

export function useNotifications(): AppNotification[] {
  return useDataStore((s) => s.notifications);
}

export function useUnreadNotificationCount(): number {
  const notifications = useDataStore((s) => s.notifications);
  return useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
}

/* -------------------------------------------------------------------------- */
/* Purchases — GET /api/purchases                                              */
/* -------------------------------------------------------------------------- */

export interface PurchaseRow {
  purchase: Purchase;
  order?: Order;
  client?: Client;
  store?: Store;
}

export function usePurchases(): Purchase[] {
  return useDataStore((s) => s.purchases);
}

export function usePurchaseRows(): PurchaseRow[] {
  const purchases = useDataStore((s) => s.purchases);
  const orders = useDataStore((s) => s.orders);
  const clientOf = useClientLookup();
  const storeOf = useStoreLookup();

  return useMemo(() => {
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return purchases.map((purchase) => {
      const order = orderMap.get(purchase.orderId);
      return {
        purchase,
        order,
        client: order ? clientOf(order.clientId) : undefined,
        store: storeOf(purchase.storeId),
      };
    });
  }, [purchases, orders, clientOf, storeOf]);
}

/** GET /api/purchases/:id */
export function usePurchase(id: ID): PurchaseRow | undefined {
  const rows = usePurchaseRows();
  return useMemo(() => rows.find((r) => r.purchase.id === id), [rows, id]);
}

/* -------------------------------------------------------------------------- */
/* Payments — GET /api/payments                                                */
/* -------------------------------------------------------------------------- */

export interface PaymentRow {
  payment: Payment;
  client?: Client;
  order?: Order;
  method?: PaymentMethod;
}

export function usePaymentRows(): PaymentRow[] {
  const payments = useDataStore((s) => s.payments);
  const orders = useDataStore((s) => s.orders);
  const clientOf = useClientLookup();
  const methodOf = usePaymentMethodLookup();

  return useMemo(() => {
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return payments.map((payment) => ({
      payment,
      client: clientOf(payment.clientId),
      order: payment.orderId ? orderMap.get(payment.orderId) : undefined,
      method: methodOf(payment.methodId),
    }));
  }, [payments, orders, clientOf, methodOf]);
}

/** GET /api/clients/:id/payments */
export function useClientPayments(clientId: ID): PaymentRow[] {
  const rows = usePaymentRows();
  return useMemo(
    () => rows.filter((r) => r.payment.clientId === clientId),
    [rows, clientId],
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation counters — GET /api/nav-counts                                   */
/* -------------------------------------------------------------------------- */

export interface NavCounts {
  activeOrders: number;
  outstandingAfn: number;
  attention: AttentionItem[];
}

/**
 * Deliberately narrow. The sidebar and topbar render on every route and only
 * need a few counters — calling `useDashboard()` here would rebuild the twelve
 * month series, the period P&L and the ageing report on every page.
 */
export function useNavCounts(): NavCounts {
  const orders = useDataStore((s) => s.orders);
  const index = useLedgerIndex();
  const clientOf = useClientLookup();
  const today = useToday();

  return useMemo(
    () => buildAttention(orders, index, clientOf, today),
    [orders, index, clientOf, today],
  );
}

export interface AttentionItem {
  id: string;
  kind: "overdue" | "unpurchased";
  title: string;
  description: string;
  href: string;
  amountAfn?: number;
}

function buildAttention(
  orders: Order[],
  index: LedgerIndex,
  clientOf: (id: ID) => Client | undefined,
  today: Date,
): NavCounts {
  const attention: AttentionItem[] = [];
  let outstandingAfn = 0;
  let activeOrders = 0;

  orders.forEach((order) => {
    if (isActive(order)) activeOrders += 1;
    const econ = orderEconomics(order, index);
    if (econ.balanceAfn > 0) outstandingAfn += econ.balanceAfn;
  });

  orders
    .filter(
      (order) =>
        order.status === "delivered" &&
        (today.getTime() - new Date(order.requestedAt).getTime()) / 86_400_000 >
          45 &&
        orderEconomics(order, index).balanceAfn > 0,
    )
    .slice(0, 3)
    .forEach((order) => {
      attention.push({
        id: `overdue-${order.id}`,
        kind: "overdue",
        title: `${clientOf(order.clientId)?.name ?? "Client"} is overdue`,
        description: `${order.orderNo} delivered but not settled.`,
        href: `/orders/${order.id}`,
        amountAfn: orderEconomics(order, index).balanceAfn,
      });
    });

  orders
    .filter(
      (order) =>
        order.status === "confirmed" &&
        (index.purchasesByOrder.get(order.id) ?? []).length === 0,
    )
    .slice(0, 3)
    .forEach((order) => {
      attention.push({
        id: `unpurchased-${order.id}`,
        kind: "unpurchased",
        title: `${order.orderNo} confirmed but not purchased`,
        description: `${clientOf(order.clientId)?.name ?? "Client"} paid an advance — place the store order.`,
        href: `/orders/${order.id}`,
      });
    });

  return {
    activeOrders,
    outstandingAfn,
    attention: attention.slice(0, 6),
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard — GET /api/dashboard                                              */
/* -------------------------------------------------------------------------- */

export interface DashboardData {
  monthly: MonthlyPoint[];
  thisMonth: PeriodPnL;
  lastMonth: PeriodPnL;
  yearToDate: PeriodPnL;
  ordersByStatus: Array<{ status: Order["status"]; label: string; count: number }>;
  salesByStore: Array<{ storeId: ID; name: string; revenueAfn: number; orders: number }>;
  recentOrders: OrderRow[];
  outstandingAfn: number;
  activeOrders: number;
  attention: AttentionItem[];
  weekProfitAfn: number;
}

export function useDashboard(): DashboardData {
  const orders = useDataStore((s) => s.orders);
  const stores = useStores();
  const index = useLedgerIndex();
  const today = useToday();
  const rows = useOrderRows();
  const nav = useNavCounts();

  return useMemo(() => {
    const monthly = monthlySeries(12, today, orders, index);

    const thisMonth = periodPnL(startOfMonth(today), today, orders, index);

    /*
     * The current month is only partly elapsed, so comparing it against a whole
     * previous month always reads as a collapse. Compare like for like: the
     * same slice of days in the month before.
     */
    const lastMonth = periodPnL(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
      new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth() - 1,
          today.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      ),
      orders,
      index,
    );

    const yearToDate = periodPnL(
      new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
      today,
      orders,
      index,
    );

    /* Orders by status ---------------------------------------------------- */
    const statusCounts = new Map<Order["status"], number>();
    orders.forEach((o) =>
      statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1),
    );
    const ordersByStatus = Array.from(statusCounts.entries())
      .map(([status, count]) => ({
        status,
        label: ORDER_STATUS[status].label,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    /* Sales by store ------------------------------------------------------ */
    const storeRevenue = new Map<ID, { revenueAfn: number; orders: number }>();
    orders.filter(isBillable).forEach((order) => {
      const revenue = orderRevenue(order);
      const itemsTotal = revenue.itemsAfn || 1;
      const seen = new Set<ID>();
      order.items.forEach((item) => {
        const share = (item.unitPriceAfn * item.qty) / itemsTotal;
        const current = storeRevenue.get(item.storeId) ?? {
          revenueAfn: 0,
          orders: 0,
        };
        current.revenueAfn += revenue.totalAfn * share;
        if (!seen.has(item.storeId)) {
          current.orders += 1;
          seen.add(item.storeId);
        }
        storeRevenue.set(item.storeId, current);
      });
    });
    const salesByStore = stores
      .map((store) => ({
        storeId: store.id,
        name: store.name,
        revenueAfn: Math.round(storeRevenue.get(store.id)?.revenueAfn ?? 0),
        orders: storeRevenue.get(store.id)?.orders ?? 0,
      }))
      .filter((s) => s.revenueAfn > 0)
      .sort((a, b) => b.revenueAfn - a.revenueAfn);

    const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
    const weekPnl = periodPnL(weekAgo, today, orders, index);

    return {
      monthly,
      thisMonth,
      lastMonth,
      yearToDate,
      ordersByStatus,
      salesByStore,
      recentOrders: rows.slice(0, 6),
      outstandingAfn: nav.outstandingAfn,
      activeOrders: nav.activeOrders,
      attention: nav.attention,
      weekProfitAfn: weekPnl.profitAfn,
    };
  }, [orders, stores, index, today, rows, nav]);
}

/* -------------------------------------------------------------------------- */
/* Finance — GET /api/finance/pnl                                              */
/* -------------------------------------------------------------------------- */

export function usePnL(from: Date, to: Date): PeriodPnL {
  const orders = useDataStore((s) => s.orders);
  const index = useLedgerIndex();

  return useMemo(
    () => periodPnL(from, to, orders, index),
    [from, to, orders, index],
  );
}

export function useMonthlySeries(months = 12): MonthlyPoint[] {
  const orders = useDataStore((s) => s.orders);
  const index = useLedgerIndex();
  const today = useToday();

  return useMemo(
    () => monthlySeries(months, today, orders, index),
    [months, today, orders, index],
  );
}

/** GET /api/finance/receivables */
export function useReceivablesAging(): {
  rows: AgingRow[];
  totals: Record<string, number>;
  grandTotal: number;
} {
  const clients = useDataStore((s) => s.clients);
  const index = useLedgerIndex();
  const today = useToday();

  return useMemo(() => {
    const rows = receivablesAging(clients, index, today);
    const totals: Record<string, number> = {};
    Object.keys(AGING_BUCKET_LABEL).forEach((bucket) => {
      totals[bucket] = rows.reduce(
        (sum, row) => sum + row.buckets[bucket as keyof typeof row.buckets],
        0,
      );
    });
    return {
      rows,
      totals,
      grandTotal: rows.reduce((sum, row) => sum + row.totalAfn, 0),
    };
  }, [clients, index, today]);
}

/* -------------------------------------------------------------------------- */
/* Documents — GET /api/documents                                              */
/* -------------------------------------------------------------------------- */

/**
 * The document register is derived, not stored: an order that has been confirmed
 * has an invoice, a quoted order has a quotation, and every payment has a
 * receipt.
 */
export function useDocuments(): BusinessDocument[] {
  const orders = useDataStore((s) => s.orders);
  const payments = useDataStore((s) => s.payments);

  return useMemo(() => {
    const docs: BusinessDocument[] = [];
  
    orders.forEach((order) => {
      const revenue = orderRevenue(order);
      if (isBillable(order)) {
        docs.push({
          id: `doc-inv-${order.id}`,
          kind: "invoice",
          number: order.orderNo.replace(/^AS-/, "INV-"),
          orderId: order.id,
          clientId: order.clientId,
          issuedAt: order.requestedAt,
          totalAfn: revenue.totalAfn,
          href: `/print/invoice/${order.id}`,
        });
      } else if (order.status === "quoted" || order.status === "requested") {
        docs.push({
          id: `doc-quo-${order.id}`,
          kind: "quotation",
          number: order.orderNo.replace(/^AS-/, "QUO-"),
          orderId: order.id,
          clientId: order.clientId,
          issuedAt: order.requestedAt,
          totalAfn: revenue.totalAfn,
          href: `/print/quotation/${order.id}`,
        });
      }
    });

    payments
      .filter((p) => p.amountAfn > 0)
      .forEach((payment) => {
        docs.push({
          id: `doc-rct-${payment.id}`,
          kind: "receipt",
          number: payment.receiptNo,
          paymentId: payment.id,
          orderId: payment.orderId,
          clientId: payment.clientId,
          issuedAt: payment.at,
          totalAfn: payment.amountAfn,
          href: `/print/receipt/${payment.id}`,
        });
      });

    return docs.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }, [orders, payments]);
}

/* -------------------------------------------------------------------------- */
/* Global search — GET /api/search?q=                                          */
/* -------------------------------------------------------------------------- */

export interface SearchResult {
  id: string;
  group: "Orders" | "Clients" | "Purchases";
  title: string;
  subtitle: string;
  href: string;
}

export function useSearch(query: string): SearchResult[] {
  const orders = useDataStore((s) => s.orders);
  const clients = useDataStore((s) => s.clients);
  const purchaseRows = usePurchaseRows();
  const clientOf = useClientLookup();

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const results: SearchResult[] = [];

    orders.forEach((order) => {
      const client = clientOf(order.clientId);
      const haystack = `${order.orderNo} ${order.trackingNumber} ${client?.name ?? ""} ${order.items
        .map((i) => i.name)
        .join(" ")}`.toLowerCase();
      if (haystack.includes(q)) {
        results.push({
          id: order.id,
          group: "Orders",
          title: order.orderNo,
          subtitle: `${client?.name ?? "Unknown client"} · ${ORDER_STATUS[order.status].label}`,
          href: `/orders/${order.id}`,
        });
      }
    });

    clients.forEach((client) => {
      const haystack =
        `${client.name} ${client.code} ${client.phone} ${client.city}`.toLowerCase();
      if (haystack.includes(q)) {
        results.push({
          id: client.id,
          group: "Clients",
          title: client.name,
          subtitle: `${client.code} · ${client.city}`,
          href: `/clients/${client.id}`,
        });
      }
    });

    purchaseRows.forEach(({ purchase, store }) => {
      if (
        `${purchase.purchaseNo} ${purchase.externalOrderNumber}`
          .toLowerCase()
          .includes(q)
      ) {
        results.push({
          id: purchase.id,
          group: "Purchases",
          title: purchase.purchaseNo,
          subtitle: `${store?.name ?? "Store"} · ${purchase.externalOrderNumber}`,
          href: `/purchases/${purchase.id}`,
        });
      }
    });

    return results.slice(0, 24);
  }, [query, orders, clients, purchaseRows, clientOf]);
}

export { deltaPercent, DOCUMENT_KIND_LABEL };
