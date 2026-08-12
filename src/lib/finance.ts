import {
  ACTIVE_ORDER_STATUSES,
  BILLABLE_ORDER_STATUSES,
  FREIGHT_COST_RATIO,
} from "@/lib/constants";
import { daysBetween } from "@/lib/format";
import type {
  Client,
  ID,
  ISODate,
  Order,
  Payment,
  Purchase,
  Shipment,
} from "@/lib/types";

/**
 * Every AFN figure the app displays is produced here.
 *
 * These functions are pure — entities in, numbers out — so the dashboard, the
 * order page, the client statement and the P&L can never disagree about what an
 * order earned.
 *
 * Everything is Afghani. There is no second currency and no exchange rate.
 *
 * Performance note: the derivations take a `LedgerIndex` rather than flat arrays.
 * Looking a payment or purchase up by order id used to mean a linear scan inside
 * a per-order loop, which is O(n²) and was costing tens of thousands of
 * comparisons on every render of the orders and clients screens.
 */

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

export interface LedgerIndex {
  purchasesByOrder: Map<ID, Purchase[]>;
  paymentsByOrder: Map<ID, Payment[]>;
  paymentsByClient: Map<ID, Payment[]>;
  shipmentByOrder: Map<ID, Shipment>;
  ordersByClient: Map<ID, Order[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Build once per data change, then reuse for every derivation on the screen. */
export function buildLedgerIndex(
  orders: Order[],
  purchases: Purchase[],
  payments: Payment[],
  shipments: Shipment[],
): LedgerIndex {
  const index: LedgerIndex = {
    purchasesByOrder: new Map(),
    paymentsByOrder: new Map(),
    paymentsByClient: new Map(),
    shipmentByOrder: new Map(),
    ordersByClient: new Map(),
  };

  purchases.forEach((p) => push(index.purchasesByOrder, p.orderId, p));
  payments.forEach((p) => {
    if (p.orderId) push(index.paymentsByOrder, p.orderId, p);
    push(index.paymentsByClient, p.clientId, p);
  });
  shipments.forEach((s) => index.shipmentByOrder.set(s.orderId, s));
  orders.forEach((o) => push(index.ordersByClient, o.clientId, o));

  return index;
}

const EMPTY: never[] = [];

/* -------------------------------------------------------------------------- */
/* Order economics                                                             */
/* -------------------------------------------------------------------------- */

export interface OrderRevenue {
  itemsAfn: number;
  serviceFeeAfn: number;
  shippingAfn: number;
  discountAfn: number;
  totalAfn: number;
}

export function orderRevenue(order: Order): OrderRevenue {
  const itemsAfn = order.items.reduce(
    (sum, item) => sum + item.unitPriceAfn * item.qty,
    0,
  );
  const serviceFeeAfn =
    order.serviceFeeType === "percent"
      ? Math.round((itemsAfn * order.serviceFeeValue) / 100)
      : order.serviceFeeValue;

  return {
    itemsAfn,
    serviceFeeAfn,
    shippingAfn: order.shippingChargedAfn,
    discountAfn: order.discountAfn,
    totalAfn:
      itemsAfn + serviceFeeAfn + order.shippingChargedAfn - order.discountAfn,
  };
}

export interface OrderCost {
  /** What the stores charged us, in AFN. */
  goodsAfn: number;
  freightAfn: number;
  customsAfn: number;
  totalAfn: number;
  /**
   * True when no purchase has been logged yet, so the goods cost is projected
   * from the unit costs captured on the quotation rather than measured.
   */
  estimated: boolean;
}

/**
 * Direct cost of an order.
 *
 * Once a purchase is logged the figures are actual. Before that the cost is
 * projected from the unit costs captured on the quotation, so a freshly-created
 * order does not read as 100% margin on the dashboard.
 */
export function orderCost(
  order: Order,
  index: LedgerIndex,
): OrderCost {
  const linked = (index.purchasesByOrder.get(order.id) ?? EMPTY).filter(
    (p) => p.status !== "cancelled",
  );
  const shipment = index.shipmentByOrder.get(order.id);

  const estimated = linked.length === 0;

  const goodsAfn = estimated
    ? order.items.reduce((sum, item) => sum + item.unitCostAfn * item.qty, 0)
    : linked.reduce((sum, p) => sum + p.totalCostAfn, 0);

  const freightAfn =
    shipment?.freightCostAfn ??
    Math.round(order.shippingChargedAfn * FREIGHT_COST_RATIO);
  const customsAfn = shipment?.customsDutyAfn ?? 0;

  return {
    goodsAfn,
    freightAfn,
    customsAfn,
    totalAfn: goodsAfn + freightAfn + customsAfn,
    estimated,
  };
}

export interface OrderEconomics {
  revenue: OrderRevenue;
  cost: OrderCost;
  profitAfn: number;
  /** Profit as a percentage of revenue. */
  marginPercent: number;
  paidAfn: number;
  balanceAfn: number;
  /** True once the client owes nothing (or has overpaid). */
  settled: boolean;
}

export function orderEconomics(
  order: Order,
  index: LedgerIndex,
): OrderEconomics {
  const revenue = orderRevenue(order);
  const cost = orderCost(order, index);
  const profitAfn = revenue.totalAfn - cost.totalAfn;
  const paidAfn = (index.paymentsByOrder.get(order.id) ?? EMPTY).reduce(
    (sum, p) => sum + p.amountAfn,
    0,
  );

  const invoiced = isBillable(order) ? revenue.totalAfn : 0;

  return {
    revenue,
    cost,
    profitAfn,
    marginPercent:
      revenue.totalAfn > 0 ? (profitAfn / revenue.totalAfn) * 100 : 0,
    paidAfn,
    balanceAfn: invoiced - paidAfn,
    settled: invoiced - paidAfn <= 0,
  };
}

export function isBillable(order: Order): boolean {
  return (
    BILLABLE_ORDER_STATUSES.includes(order.status) && order.status !== "refunded"
  );
}

export function isActive(order: Order): boolean {
  return ACTIVE_ORDER_STATUSES.includes(order.status);
}

/* -------------------------------------------------------------------------- */
/* Client economics                                                            */
/* -------------------------------------------------------------------------- */

export interface ClientSummary {
  clientId: ID;
  orderCount: number;
  activeOrderCount: number;
  /** Lifetime billable revenue. */
  lifetimeRevenueAfn: number;
  lifetimeProfitAfn: number;
  paidAfn: number;
  /** Positive = the client owes us. Negative = credit on account. */
  balanceAfn: number;
  avgOrderAfn: number;
  lastOrderAt?: ISODate;
  /** Age in days of the oldest unpaid billable order. */
  oldestDebtDays: number;
}

export function clientSummary(
  clientId: ID,
  index: LedgerIndex,
  today: Date,
): ClientSummary {
  const own = index.ordersByClient.get(clientId) ?? EMPTY;

  let lifetimeRevenueAfn = 0;
  let lifetimeProfitAfn = 0;
  let oldestDebtDays = 0;
  let billableCount = 0;

  own.forEach((order) => {
    const econ = orderEconomics(order, index);
    if (!isBillable(order)) return;
    billableCount += 1;
    lifetimeRevenueAfn += econ.revenue.totalAfn;
    lifetimeProfitAfn += econ.profitAfn;
    if (econ.balanceAfn > 0) {
      const age = daysBetween(order.requestedAt, today);
      if (age > oldestDebtDays) oldestDebtDays = age;
    }
  });

  const paidAfn = (index.paymentsByClient.get(clientId) ?? EMPTY).reduce(
    (sum, p) => sum + p.amountAfn,
    0,
  );

  return {
    clientId,
    orderCount: own.length,
    activeOrderCount: own.filter(isActive).length,
    lifetimeRevenueAfn,
    lifetimeProfitAfn,
    paidAfn,
    balanceAfn: lifetimeRevenueAfn - paidAfn,
    avgOrderAfn:
      billableCount > 0 ? Math.round(lifetimeRevenueAfn / billableCount) : 0,
    lastOrderAt: own
      .map((o) => o.requestedAt)
      .sort((a, b) => b.localeCompare(a))[0],
    oldestDebtDays,
  };
}

/* -------------------------------------------------------------------------- */
/* Period profit & loss                                                        */
/* -------------------------------------------------------------------------- */

export interface PeriodPnL {
  from: Date;
  to: Date;
  orderCount: number;
  revenueAfn: number;
  /** Direct cost of goods + freight + duty. */
  cogsAfn: number;
  /** The three parts of `cogsAfn`, so the screen can show where cost lands. */
  goodsAfn: number;
  freightAfn: number;
  customsAfn: number;
  /** Service fee charged on top of goods — the part of revenue we actually earn. */
  serviceFeeAfn: number;
  profitAfn: number;
  marginPercent: number;
}

function within(date: ISODate, from: Date, to: Date): boolean {
  const t = new Date(date).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/**
 * Revenue is recognised on the order's request date — the point the job enters
 * the book. That keeps a month's revenue, its purchase cost and its freight in
 * the same bucket, which is how the team reads their own numbers.
 */
export function periodPnL(
  from: Date,
  to: Date,
  orders: Order[],
  index: LedgerIndex,
): PeriodPnL {
  let revenueAfn = 0;
  let serviceFeeAfn = 0;
  let goodsAfn = 0;
  let freightAfn = 0;
  let customsAfn = 0;
  let orderCount = 0;

  orders.forEach((order) => {
    if (!isBillable(order) || !within(order.requestedAt, from, to)) return;
    orderCount += 1;
    const revenue = orderRevenue(order);
    const cost = orderCost(order, index);
    revenueAfn += revenue.totalAfn;
    serviceFeeAfn += revenue.serviceFeeAfn;
    goodsAfn += cost.goodsAfn;
    freightAfn += cost.freightAfn;
    customsAfn += cost.customsAfn;
  });

  const cogsAfn = goodsAfn + freightAfn + customsAfn;
  const profitAfn = revenueAfn - cogsAfn;

  return {
    from,
    to,
    orderCount,
    revenueAfn,
    cogsAfn,
    goodsAfn,
    freightAfn,
    customsAfn,
    serviceFeeAfn,
    profitAfn,
    marginPercent: revenueAfn > 0 ? (profitAfn / revenueAfn) * 100 : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Monthly series (charts)                                                     */
/* -------------------------------------------------------------------------- */

export interface MonthlyPoint {
  /** "2026-07" */
  key: string;
  /** "Jul" */
  label: string;
  monthStart: Date;
  orders: number;
  revenueAfn: number;
  cogsAfn: number;
  profitAfn: number;
}

export function monthlySeries(
  months: number,
  today: Date,
  orders: Order[],
  index: LedgerIndex,
): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
    );
    const monthEnd = new Date(
      Date.UTC(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    );

    const pnl = periodPnL(monthStart, monthEnd, orders, index);

    points.push({
      key: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthStart.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
      monthStart,
      orders: pnl.orderCount,
      revenueAfn: pnl.revenueAfn,
      cogsAfn: pnl.cogsAfn,
      profitAfn: pnl.profitAfn,
    });
  }

  return points;
}

/* -------------------------------------------------------------------------- */
/* Receivables ageing                                                          */
/* -------------------------------------------------------------------------- */

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d60_plus";

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  current: "Current",
  d1_30: "1 – 30 days",
  d31_60: "31 – 60 days",
  d60_plus: "60+ days",
};

export interface AgingRow {
  client: Client;
  summary: ClientSummary;
  buckets: Record<AgingBucket, number>;
  totalAfn: number;
}

function bucketFor(ageDays: number): AgingBucket {
  if (ageDays <= 0) return "current";
  if (ageDays <= 30) return "d1_30";
  if (ageDays <= 60) return "d31_60";
  return "d60_plus";
}

/**
 * An order's debt starts ageing 14 days after the request — the payment term
 * on the invoice footer.
 */
const PAYMENT_TERM_DAYS = 14;

export function receivablesAging(
  clients: Client[],
  index: LedgerIndex,
  today: Date,
): AgingRow[] {
  return clients
    .map((client) => {
      const buckets: Record<AgingBucket, number> = {
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d60_plus: 0,
      };

      (index.ordersByClient.get(client.id) ?? EMPTY).forEach((order) => {
        if (!isBillable(order)) return;
        const econ = orderEconomics(order, index);
        if (econ.balanceAfn <= 0) return;
        const overdueDays =
          daysBetween(order.requestedAt, today) - PAYMENT_TERM_DAYS;
        buckets[bucketFor(overdueDays)] += econ.balanceAfn;
      });

      const totalAfn = Object.values(buckets).reduce((a, b) => a + b, 0);

      return {
        client,
        summary: clientSummary(client.id, index, today),
        buckets,
        totalAfn,
      };
    })
    .filter((row) => row.totalAfn > 0)
    .sort((a, b) => b.totalAfn - a.totalAfn);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Percentage change from `previous` to `current`; null when there is no base. */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}
