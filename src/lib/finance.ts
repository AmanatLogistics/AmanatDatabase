import {
  ACTIVE_ORDER_STATUSES,
  BILLABLE_ORDER_STATUSES,
  DEFAULT_FX_RATE,
  FREIGHT_COST_RATIO,
} from "@/lib/constants";
import { daysBetween } from "@/lib/format";
import type {
  Client,
  Expense,
  ExpenseCategory,
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
 * These functions are pure — they take entities in and return numbers out — so
 * the dashboard, the order page, the client statement and the P&L can never
 * disagree about what an order earned.
 */

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
    totalAfn: itemsAfn + serviceFeeAfn + order.shippingChargedAfn - order.discountAfn,
  };
}

export interface OrderCost {
  /** What the stores charged us, converted at each purchase's own FX rate. */
  goodsAfn: number;
  /** Same, in the original USD. */
  goodsUsd: number;
  freightAfn: number;
  customsAfn: number;
  totalAfn: number;
  /**
   * True when no purchase has been logged yet, so the goods cost is projected
   * from the unit costs captured on the quotation rather than measured.
   */
  estimated: boolean;
}

export function purchaseTotalUsd(purchase: Purchase): number {
  return (
    purchase.itemsCostUsd +
    purchase.taxUsd +
    purchase.domesticShippingUsd +
    purchase.otherCostUsd
  );
}

export function purchaseTotalAfn(purchase: Purchase): number {
  return Math.round(purchaseTotalUsd(purchase) * purchase.fxRate);
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
  purchases: Purchase[],
  shipment?: Shipment,
  estimateFxRate: number = DEFAULT_FX_RATE,
): OrderCost {
  const linked = purchases.filter(
    (p) => p.orderId === order.id && p.status !== "cancelled",
  );

  const estimated = linked.length === 0;

  const goodsUsd = estimated
    ? order.items.reduce((sum, item) => sum + item.unitCostUsd * item.qty, 0)
    : linked.reduce((sum, p) => sum + purchaseTotalUsd(p), 0);

  const goodsAfn = estimated
    ? Math.round(goodsUsd * estimateFxRate)
    : linked.reduce((sum, p) => sum + purchaseTotalAfn(p), 0);

  const freightAfn =
    shipment?.freightCostAfn ??
    Math.round(order.shippingChargedAfn * FREIGHT_COST_RATIO);
  const customsAfn = shipment?.customsDutyAfn ?? 0;

  return {
    goodsAfn,
    goodsUsd,
    freightAfn,
    customsAfn,
    totalAfn: goodsAfn + freightAfn + customsAfn,
    estimated,
  };
}

export interface OrderEconomics {
  revenue: OrderRevenue;
  cost: OrderCost;
  grossProfitAfn: number;
  /** Gross profit as a percentage of revenue. */
  marginPercent: number;
  paidAfn: number;
  balanceAfn: number;
  /** True once the client owes nothing (or has overpaid). */
  settled: boolean;
}

export function orderEconomics(
  order: Order,
  purchases: Purchase[],
  payments: Payment[],
  shipment?: Shipment,
): OrderEconomics {
  const revenue = orderRevenue(order);
  const cost = orderCost(order, purchases, shipment);
  const grossProfitAfn = revenue.totalAfn - cost.totalAfn;
  const paidAfn = payments
    .filter((p) => p.orderId === order.id)
    .reduce((sum, p) => sum + p.amountAfn, 0);

  const billable = isBillable(order);
  const invoiced = billable ? revenue.totalAfn : 0;

  return {
    revenue,
    cost,
    grossProfitAfn,
    marginPercent:
      revenue.totalAfn > 0 ? (grossProfitAfn / revenue.totalAfn) * 100 : 0,
    paidAfn,
    balanceAfn: invoiced - paidAfn,
    settled: invoiced - paidAfn <= 0,
  };
}

export function isBillable(order: Order): boolean {
  return BILLABLE_ORDER_STATUSES.includes(order.status) && order.status !== "refunded";
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
  orders: Order[],
  purchases: Purchase[],
  payments: Payment[],
  shipments: Shipment[],
  today: Date,
): ClientSummary {
  const own = orders.filter((o) => o.clientId === clientId);
  const ownPayments = payments.filter((p) => p.clientId === clientId);

  let lifetimeRevenueAfn = 0;
  let lifetimeProfitAfn = 0;
  let oldestDebtDays = 0;

  own.forEach((order) => {
    const shipment = shipments.find((s) => s.orderId === order.id);
    const econ = orderEconomics(order, purchases, ownPayments, shipment);
    if (isBillable(order)) {
      lifetimeRevenueAfn += econ.revenue.totalAfn;
      lifetimeProfitAfn += econ.grossProfitAfn;
      if (econ.balanceAfn > 0) {
        const age = daysBetween(order.requestedAt, today);
        if (age > oldestDebtDays) oldestDebtDays = age;
      }
    }
  });

  const paidAfn = ownPayments.reduce((sum, p) => sum + p.amountAfn, 0);
  const billableCount = own.filter(isBillable).length;

  return {
    clientId,
    orderCount: own.length,
    activeOrderCount: own.filter(isActive).length,
    lifetimeRevenueAfn,
    lifetimeProfitAfn,
    paidAfn,
    balanceAfn: lifetimeRevenueAfn - paidAfn,
    avgOrderAfn: billableCount > 0 ? Math.round(lifetimeRevenueAfn / billableCount) : 0,
    lastOrderAt: own
      .map((o) => o.requestedAt)
      .sort((a, b) => b.localeCompare(a))[0],
    oldestDebtDays,
  };
}

/* -------------------------------------------------------------------------- */
/* Period P&L                                                                  */
/* -------------------------------------------------------------------------- */

export interface ExpenseBreakdownRow {
  categoryId: ID;
  name: string;
  color: string;
  amountAfn: number;
  share: number;
}

export interface PeriodPnL {
  from: Date;
  to: Date;
  orderCount: number;
  revenueAfn: number;
  /** Direct cost of goods + freight + duty. */
  cogsAfn: number;
  grossProfitAfn: number;
  grossMarginPercent: number;
  expensesAfn: number;
  expenseBreakdown: ExpenseBreakdownRow[];
  netProfitAfn: number;
  netMarginPercent: number;
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
  purchases: Purchase[],
  shipments: Shipment[],
  expenses: Expense[],
  categories: ExpenseCategory[],
): PeriodPnL {
  const inPeriod = orders.filter(
    (o) => isBillable(o) && within(o.requestedAt, from, to),
  );

  let revenueAfn = 0;
  let cogsAfn = 0;

  inPeriod.forEach((order) => {
    const shipment = shipments.find((s) => s.orderId === order.id);
    revenueAfn += orderRevenue(order).totalAfn;
    cogsAfn += orderCost(order, purchases, shipment).totalAfn;
  });

  const periodExpenses = expenses.filter((e) => within(e.at, from, to));
  const expensesAfn = periodExpenses.reduce((sum, e) => sum + e.amountAfn, 0);

  const byCategory = new Map<ID, number>();
  periodExpenses.forEach((e) => {
    byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.amountAfn);
  });

  const expenseBreakdown: ExpenseBreakdownRow[] = categories
    .map((category) => {
      const amountAfn = byCategory.get(category.id) ?? 0;
      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        amountAfn,
        share: expensesAfn > 0 ? (amountAfn / expensesAfn) * 100 : 0,
      };
    })
    .filter((row) => row.amountAfn > 0)
    .sort((a, b) => b.amountAfn - a.amountAfn);

  const grossProfitAfn = revenueAfn - cogsAfn;
  const netProfitAfn = grossProfitAfn - expensesAfn;

  return {
    from,
    to,
    orderCount: inPeriod.length,
    revenueAfn,
    cogsAfn,
    grossProfitAfn,
    grossMarginPercent: revenueAfn > 0 ? (grossProfitAfn / revenueAfn) * 100 : 0,
    expensesAfn,
    expenseBreakdown,
    netProfitAfn,
    netMarginPercent: revenueAfn > 0 ? (netProfitAfn / revenueAfn) * 100 : 0,
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
  grossProfitAfn: number;
  expensesAfn: number;
  netProfitAfn: number;
}

export function monthlySeries(
  months: number,
  today: Date,
  orders: Order[],
  purchases: Purchase[],
  shipments: Shipment[],
  expenses: Expense[],
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

    const inPeriod = orders.filter(
      (o) => isBillable(o) && within(o.requestedAt, monthStart, monthEnd),
    );

    let revenueAfn = 0;
    let cogsAfn = 0;
    inPeriod.forEach((order) => {
      const shipment = shipments.find((s) => s.orderId === order.id);
      revenueAfn += orderRevenue(order).totalAfn;
      cogsAfn += orderCost(order, purchases, shipment).totalAfn;
    });

    const expensesAfn = expenses
      .filter((e) => within(e.at, monthStart, monthEnd))
      .reduce((sum, e) => sum + e.amountAfn, 0);

    points.push({
      key: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthStart.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
      monthStart,
      orders: inPeriod.length,
      revenueAfn,
      cogsAfn,
      grossProfitAfn: revenueAfn - cogsAfn,
      expensesAfn,
      netProfitAfn: revenueAfn - cogsAfn - expensesAfn,
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
  orders: Order[],
  purchases: Purchase[],
  payments: Payment[],
  shipments: Shipment[],
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

      orders
        .filter((o) => o.clientId === client.id && isBillable(o))
        .forEach((order) => {
          const shipment = shipments.find((s) => s.orderId === order.id);
          const econ = orderEconomics(order, purchases, payments, shipment);
          if (econ.balanceAfn <= 0) return;
          const overdueDays =
            daysBetween(order.requestedAt, today) - PAYMENT_TERM_DAYS;
          buckets[bucketFor(overdueDays)] += econ.balanceAfn;
        });

      const totalAfn = Object.values(buckets).reduce((a, b) => a + b, 0);

      return {
        client,
        summary: clientSummary(
          client.id,
          orders,
          purchases,
          payments,
          shipments,
          today,
        ),
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
export function deltaPercent(
  current: number,
  previous: number,
): number | null {
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

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );
}
