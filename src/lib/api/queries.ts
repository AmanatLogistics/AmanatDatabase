"use client";

import { useMemo } from "react";

import {
  AGING_BUCKET_LABEL,
  clientSummary,
  deltaPercent,
  isActive,
  isBillable,
  monthlySeries,
  orderEconomics,
  orderRevenue,
  periodPnL,
  purchaseTotalAfn,
  purchaseTotalUsd,
  receivablesAging,
  startOfMonth,
  type AgingRow,
  type ClientSummary,
  type MonthlyPoint,
  type OrderEconomics,
  type PeriodPnL,
} from "@/lib/finance";
import { useDataStore } from "@/lib/store";
import { DOCUMENT_KIND_LABEL, ORDER_STATUS } from "@/lib/constants";
import type {
  BusinessDocument,
  Client,
  Expense,
  ExpenseCategory,
  ID,
  Order,
  Payment,
  PaymentMethod,
  Purchase,
  Settings,
  Shipment,
  Store,
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

export function useExpenseCategories(): ExpenseCategory[] {
  return useDataStore((s) => s.settings.expenseCategories);
}

export function useTeam() {
  return useDataStore((s) => s.settings.team);
}

/** Frozen "now". Keeps ageing and ETA maths identical on server and client. */
export function useToday(): Date {
  return useDataStore((s) => s.today);
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

export function useExpenseCategoryLookup(): (
  id: ID,
) => ExpenseCategory | undefined {
  const categories = useExpenseCategories();
  return useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return (id: ID) => map.get(id);
  }, [categories]);
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
  const orders = useDataStore((s) => s.orders);
  const purchases = useDataStore((s) => s.purchases);
  const payments = useDataStore((s) => s.payments);
  const shipments = useDataStore((s) => s.shipments);
  const today = useToday();

  return useMemo(
    () =>
      clients.map((client) => ({
        client,
        summary: clientSummary(
          client.id,
          orders,
          purchases,
          payments,
          shipments,
          today,
        ),
      })),
    [clients, orders, purchases, payments, shipments, today],
  );
}

/** GET /api/clients/:id */
export function useClient(id: ID): ClientRow | undefined {
  const rows = useClientRows();
  return useMemo(() => rows.find((r) => r.client.id === id), [rows, id]);
}

/* -------------------------------------------------------------------------- */
/* Orders — GET /api/orders                                                    */
/* -------------------------------------------------------------------------- */

export interface OrderRow {
  order: Order;
  client?: Client;
  economics: OrderEconomics;
  shipment?: Shipment;
  purchases: Purchase[];
  itemCount: number;
  unitCount: number;
}

export function useOrders(): Order[] {
  return useDataStore((s) => s.orders);
}

export function useOrderRows(): OrderRow[] {
  const orders = useDataStore((s) => s.orders);
  const purchases = useDataStore((s) => s.purchases);
  const payments = useDataStore((s) => s.payments);
  const shipments = useDataStore((s) => s.shipments);
  const clientOf = useClientLookup();

  return useMemo(
    () =>
      orders.map((order) => {
        const shipment = shipments.find((s) => s.orderId === order.id);
        const linkedPurchases = purchases.filter((p) => p.orderId === order.id);
        return {
          order,
          client: clientOf(order.clientId),
          economics: orderEconomics(order, purchases, payments, shipment),
          shipment,
          purchases: linkedPurchases,
          itemCount: order.items.length,
          unitCount: order.items.reduce((sum, i) => sum + i.qty, 0),
        };
      }),
    [orders, purchases, payments, shipments, clientOf],
  );
}

/** GET /api/orders/:id */
export function useOrder(id: ID): OrderRow | undefined {
  const rows = useOrderRows();
  return useMemo(() => rows.find((r) => r.order.id === id), [rows, id]);
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
/* Purchases — GET /api/purchases                                              */
/* -------------------------------------------------------------------------- */

export interface PurchaseRow {
  purchase: Purchase;
  order?: Order;
  client?: Client;
  store?: Store;
  totalUsd: number;
  totalAfn: number;
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
        totalUsd: purchaseTotalUsd(purchase),
        totalAfn: purchaseTotalAfn(purchase),
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
/* Shipments — GET /api/shipments                                              */
/* -------------------------------------------------------------------------- */

export interface ShipmentRow {
  shipment: Shipment;
  order?: Order;
  client?: Client;
  /** Days until ETA; negative when the ETA has passed. */
  daysToEta: number | null;
}

export function useShipmentRows(): ShipmentRow[] {
  const shipments = useDataStore((s) => s.shipments);
  const orders = useDataStore((s) => s.orders);
  const clientOf = useClientLookup();
  const today = useToday();

  return useMemo(() => {
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return shipments.map((shipment) => {
      const order = orderMap.get(shipment.orderId);
      const daysToEta = shipment.etaAt
        ? Math.round(
            (new Date(shipment.etaAt).getTime() - today.getTime()) / 86_400_000,
          )
        : null;
      return {
        shipment,
        order,
        client: order ? clientOf(order.clientId) : undefined,
        daysToEta,
      };
    });
  }, [shipments, orders, clientOf, today]);
}

/** GET /api/shipments/:id */
export function useShipment(id: ID): ShipmentRow | undefined {
  const rows = useShipmentRows();
  return useMemo(() => rows.find((r) => r.shipment.id === id), [rows, id]);
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
/* Expenses — GET /api/expenses                                                */
/* -------------------------------------------------------------------------- */

export interface ExpenseRow {
  expense: Expense;
  category?: ExpenseCategory;
  method?: PaymentMethod;
}

export function useExpenseRows(): ExpenseRow[] {
  const expenses = useDataStore((s) => s.expenses);
  const categoryOf = useExpenseCategoryLookup();
  const methodOf = usePaymentMethodLookup();

  return useMemo(
    () =>
      expenses.map((expense) => ({
        expense,
        category: categoryOf(expense.categoryId),
        method: methodOf(expense.methodId),
      })),
    [expenses, categoryOf, methodOf],
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard — GET /api/dashboard                                              */
/* -------------------------------------------------------------------------- */

export interface DashboardKpi {
  label: string;
  value: number;
  /** Rendered form; the card does not re-format. */
  display: string;
  deltaPercent: number | null;
  /** 0-100, used by the thin progress bar under each KPI. */
  progress: number;
  caption: string;
}

export interface AttentionItem {
  id: string;
  kind: "customs" | "overdue" | "unpurchased" | "exception";
  title: string;
  description: string;
  href: string;
  amountAfn?: number;
}

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
  const purchases = useDataStore((s) => s.purchases);
  const shipments = useDataStore((s) => s.shipments);
  const expenses = useDataStore((s) => s.expenses);
  const categories = useExpenseCategories();
  const stores = useStores();
  const today = useToday();
  const rows = useOrderRows();

  return useMemo(() => {
    const monthly = monthlySeries(12, today, orders, purchases, shipments, expenses);

    const thisMonth = periodPnL(
      startOfMonth(today),
      today,
      orders,
      purchases,
      shipments,
      expenses,
      categories,
    );

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
      purchases,
      shipments,
      expenses,
      categories,
    );

    const yearToDate = periodPnL(
      new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
      today,
      orders,
      purchases,
      shipments,
      expenses,
      categories,
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

    /* Money owed ---------------------------------------------------------- */
    const outstandingAfn = rows.reduce(
      (sum, row) => sum + Math.max(0, row.economics.balanceAfn),
      0,
    );

    /* Needs attention ----------------------------------------------------- */
    const attention: AttentionItem[] = [];

    shipments
      .filter((s) => s.status === "customs")
      .slice(0, 3)
      .forEach((shipment) => {
        const row = rows.find((r) => r.order.id === shipment.orderId);
        attention.push({
          id: `customs-${shipment.id}`,
          kind: "customs",
          title: `${row?.order.orderNo ?? "Order"} held in customs`,
          description: `${shipment.carrier} · ${shipment.trackingNumber} — clearance documents requested.`,
          href: `/tracking/${shipment.id}`,
        });
      });

    shipments
      .filter((s) => s.status === "exception")
      .slice(0, 2)
      .forEach((shipment) => {
        const row = rows.find((r) => r.order.id === shipment.orderId);
        attention.push({
          id: `exception-${shipment.id}`,
          kind: "exception",
          title: `Delivery exception on ${row?.order.orderNo ?? "an order"}`,
          description: `${shipment.carrier} could not complete delivery — contact the client.`,
          href: `/tracking/${shipment.id}`,
        });
      });

    rows
      .filter(
        (r) =>
          r.order.status === "delivered" &&
          r.economics.balanceAfn > 0 &&
          (today.getTime() - new Date(r.order.requestedAt).getTime()) /
            86_400_000 >
            45,
      )
      .sort((a, b) => b.economics.balanceAfn - a.economics.balanceAfn)
      .slice(0, 3)
      .forEach((row) => {
        attention.push({
          id: `overdue-${row.order.id}`,
          kind: "overdue",
          title: `${row.client?.name ?? "Client"} is overdue`,
          description: `${row.order.orderNo} delivered but not settled.`,
          href: `/orders/${row.order.id}`,
          amountAfn: row.economics.balanceAfn,
        });
      });

    rows
      .filter((r) => r.order.status === "confirmed" && r.purchases.length === 0)
      .slice(0, 3)
      .forEach((row) => {
        attention.push({
          id: `unpurchased-${row.order.id}`,
          kind: "unpurchased",
          title: `${row.order.orderNo} confirmed but not purchased`,
          description: `${row.client?.name ?? "Client"} paid an advance — place the store order.`,
          href: `/orders/${row.order.id}`,
        });
      });

    /* Rolling 7-day profit ------------------------------------------------ */
    const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
    const weekPnl = periodPnL(
      weekAgo,
      today,
      orders,
      purchases,
      shipments,
      expenses,
      categories,
    );

    return {
      monthly,
      thisMonth,
      lastMonth,
      yearToDate,
      ordersByStatus,
      salesByStore,
      recentOrders: rows.slice(0, 6),
      outstandingAfn,
      activeOrders: orders.filter(isActive).length,
      attention: attention.slice(0, 6),
      weekProfitAfn: weekPnl.grossProfitAfn,
    };
  }, [orders, purchases, shipments, expenses, categories, stores, today, rows]);
}

/* -------------------------------------------------------------------------- */
/* Finance — GET /api/finance/pnl                                              */
/* -------------------------------------------------------------------------- */

export function usePnL(from: Date, to: Date): PeriodPnL {
  const orders = useDataStore((s) => s.orders);
  const purchases = useDataStore((s) => s.purchases);
  const shipments = useDataStore((s) => s.shipments);
  const expenses = useDataStore((s) => s.expenses);
  const categories = useExpenseCategories();

  return useMemo(
    () =>
      periodPnL(from, to, orders, purchases, shipments, expenses, categories),
    [from, to, orders, purchases, shipments, expenses, categories],
  );
}

export function useMonthlySeries(months = 12): MonthlyPoint[] {
  const orders = useDataStore((s) => s.orders);
  const purchases = useDataStore((s) => s.purchases);
  const shipments = useDataStore((s) => s.shipments);
  const expenses = useDataStore((s) => s.expenses);
  const today = useToday();

  return useMemo(
    () => monthlySeries(months, today, orders, purchases, shipments, expenses),
    [months, today, orders, purchases, shipments, expenses],
  );
}

/** GET /api/finance/receivables */
export function useReceivablesAging(): {
  rows: AgingRow[];
  totals: Record<string, number>;
  grandTotal: number;
} {
  const clients = useDataStore((s) => s.clients);
  const orders = useDataStore((s) => s.orders);
  const purchases = useDataStore((s) => s.purchases);
  const payments = useDataStore((s) => s.payments);
  const shipments = useDataStore((s) => s.shipments);
  const today = useToday();

  return useMemo(() => {
    const rows = receivablesAging(
      clients,
      orders,
      purchases,
      payments,
      shipments,
      today,
    );
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
  }, [clients, orders, purchases, payments, shipments, today]);
}

/* -------------------------------------------------------------------------- */
/* Documents — GET /api/documents                                              */
/* -------------------------------------------------------------------------- */

/**
 * The document register is derived, not stored: an order that has been confirmed
 * has an invoice, a quoted order has a quotation, every payment has a receipt,
 * and every shipment has a packing list and a label.
 */
export function useDocuments(): BusinessDocument[] {
  const orders = useDataStore((s) => s.orders);
  const payments = useDataStore((s) => s.payments);
  const shipments = useDataStore((s) => s.shipments);

  return useMemo(() => {
    const docs: BusinessDocument[] = [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));

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

    shipments.forEach((shipment) => {
      const order = orderMap.get(shipment.orderId);
      if (!order) return;
      docs.push({
        id: `doc-pkl-${shipment.id}`,
        kind: "packing_list",
        number: order.orderNo.replace(/^AS-/, "PKL-"),
        shipmentId: shipment.id,
        orderId: order.id,
        clientId: order.clientId,
        issuedAt: shipment.shippedAt ?? order.requestedAt,
        totalAfn: orderRevenue(order).itemsAfn,
        href: `/print/packing-list/${shipment.id}`,
      });
      docs.push({
        id: `doc-lbl-${shipment.id}`,
        kind: "shipping_label",
        number: shipment.trackingNumber,
        shipmentId: shipment.id,
        orderId: order.id,
        clientId: order.clientId,
        issuedAt: shipment.shippedAt ?? order.requestedAt,
        totalAfn: 0,
        href: `/print/label/${shipment.id}`,
      });
    });

    return docs.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }, [orders, payments, shipments]);
}

/* -------------------------------------------------------------------------- */
/* Global search — GET /api/search?q=                                          */
/* -------------------------------------------------------------------------- */

export interface SearchResult {
  id: string;
  group: "Orders" | "Clients" | "Shipments" | "Purchases";
  title: string;
  subtitle: string;
  href: string;
}

export function useSearch(query: string): SearchResult[] {
  const orderRows = useOrderRows();
  const clientRows = useClientRows();
  const shipmentRows = useShipmentRows();
  const purchaseRows = usePurchaseRows();

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const results: SearchResult[] = [];

    orderRows.forEach(({ order, client }) => {
      const haystack = `${order.orderNo} ${client?.name ?? ""} ${order.items
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

    clientRows.forEach(({ client }) => {
      const haystack = `${client.name} ${client.code} ${client.phone} ${client.city}`.toLowerCase();
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

    shipmentRows.forEach(({ shipment, client }) => {
      if (`${shipment.trackingNumber} ${shipment.carrier}`.toLowerCase().includes(q)) {
        results.push({
          id: shipment.id,
          group: "Shipments",
          title: shipment.trackingNumber,
          subtitle: `${shipment.carrier} · ${client?.name ?? "—"}`,
          href: `/tracking/${shipment.id}`,
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
  }, [query, orderRows, clientRows, shipmentRows, purchaseRows]);
}

export { deltaPercent, DOCUMENT_KIND_LABEL };
