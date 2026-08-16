import { catalog, productUrl, type CatalogProduct } from "@/lib/mock/catalog";
import { clients } from "@/lib/mock/clients";
import { settings } from "@/lib/mock/settings";
import { ORDER_PIPELINE } from "@/lib/constants";
import { generateUniqueTrackingNumber } from "@/lib/tracking";
import type {
  Order,
  OrderEvent,
  OrderItem,
  OrderSource,
  OrderStatus,
  Payment,
  Purchase,
  PurchaseStatus,
  StoreProduct,
} from "@/lib/types";

/**
 * Deterministic mock dataset.
 *
 * Everything below is generated from a fixed seed and a fixed "today", so the
 * server and the browser always produce byte-identical data — no hydration
 * mismatches, and screenshots/tests stay stable. Swap this module out entirely
 * when the API lands; nothing outside `src/lib` imports it.
 */

/** Frozen reference date. All ages, ETAs and ageing buckets derive from this. */
export const TODAY = new Date("2026-08-11T09:00:00.000Z");

/**
 * Multiplier applied to the store cost when quoting a product to a client.
 * Covers the store's own tax, domestic shipping to the forwarder and price drift
 * between quoting and buying — roughly 15% in practice. The order's service fee
 * is the margin on top of that.
 */
const QUOTE_MARKUP = 1.15;

/* -------------------------------------------------------------------------- */
/* Deterministic RNG                                                           */
/* -------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260811);

/**
 * A second, independent stream for tracking numbers.
 *
 * Minting them from `rand` would consume draws inside the order loop and shift
 * every later value — freight, customs duty, payments, sources, statuses — so
 * the seeded P&L would silently differ from what it was before tracking
 * numbers existed. Kept separate so adding a tracking number changes nothing
 * but the tracking number.
 */
const trackingRand = mulberry32(20260812);

const int = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;
/** Multiplier in [1-spread, 1+spread]. */
const jitter = (spread: number) => 1 + (rand() * 2 - 1) * spread;

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const shift = (from: Date, days: number, hours = 0) =>
  new Date(from.getTime() + days * DAY + hours * 3_600_000);

/* -------------------------------------------------------------------------- */
/* Volume                                                                      */
/* -------------------------------------------------------------------------- */

/** Months covered by the dataset, oldest first: Oct 2025 … Aug 2026. */
const MONTHS: Array<{ year: number; month: number; orders: number }> = [
  { year: 2025, month: 9, orders: 9 },
  { year: 2025, month: 10, orders: 11 },
  { year: 2025, month: 11, orders: 10 },
  { year: 2026, month: 0, orders: 13 },
  { year: 2026, month: 1, orders: 12 },
  { year: 2026, month: 2, orders: 15 },
  { year: 2026, month: 3, orders: 16 },
  { year: 2026, month: 4, orders: 18 },
  { year: 2026, month: 5, orders: 19 },
  { year: 2026, month: 6, orders: 21 },
  { year: 2026, month: 7, orders: 12 },
];

/* -------------------------------------------------------------------------- */
/* Client weighting — a few regulars drive most of the volume                  */
/* -------------------------------------------------------------------------- */

const clientPool: string[] = [];
clients.forEach((client, index) => {
  if (client.status === "blocked") return;
  // Businesses and the earliest individuals order far more often.
  let weight = client.type === "business" ? 5 : 2;
  if (index < 10) weight += 2;
  if (client.status === "inactive") weight = 1;
  for (let i = 0; i < weight; i += 1) clientPool.push(client.id);
});

const clientById = new Map(clients.map((c) => [c.id, c]));

const SOURCES: OrderSource[] = [
  "whatsapp",
  "whatsapp",
  "whatsapp",
  "whatsapp",
  "phone",
  "phone",
  "walk_in",
  "facebook",
  "referral",
];

const OPERATORS = ["Rahim Jan", "Sohaila Nazari", "Mustafa Amiri"];
const ACCOUNTANTS = ["Yalda Sediqi", "Sohaila Nazari"];

const storeById = new Map(settings.stores.map((s) => [s.id, s]));

/* -------------------------------------------------------------------------- */
/* Status selection                                                            */
/* -------------------------------------------------------------------------- */

function statusForAge(ageDays: number): OrderStatus {
  if (ageDays > 12 && chance(0.035)) return "cancelled";
  if (ageDays > 45 && chance(0.022)) return "refunded";

  if (ageDays >= 42) return "delivered";
  if (ageDays >= 32)
    return pick<OrderStatus>([
      "delivered",
      "delivered",
      "delivered",
      "ready_for_pickup",
    ]);
  if (ageDays >= 24)
    return pick<OrderStatus>([
      "delivered",
      "ready_for_pickup",
      "arrived",
      "in_transit",
    ]);
  if (ageDays >= 15)
    return pick<OrderStatus>(["in_transit", "in_transit", "arrived", "purchased"]);
  if (ageDays >= 9)
    return pick<OrderStatus>(["purchased", "in_transit", "purchasing"]);
  if (ageDays >= 4)
    return pick<OrderStatus>(["confirmed", "purchasing", "purchased"]);
  return pick<OrderStatus>(["requested", "quoted", "quoted", "confirmed"]);
}

const stageIndex = (status: OrderStatus) => ORDER_PIPELINE.indexOf(status);

/** Cancelled/refunded orders still carry the history of how far they got. */
function effectiveStage(status: OrderStatus): number {
  if (status === "cancelled") return stageIndex("confirmed");
  if (status === "refunded") return stageIndex("delivered");
  return stageIndex(status);
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

const orders: Order[] = [];
const purchases: Purchase[] = [];
const payments: Payment[] = [];

let orderSeq = 0;
let purchaseSeq = 0;
let receiptSeq = 0;

/** Grows as orders are built, so no two seeded orders share a tracking number. */
const trackingNumbersUsed = new Set<string>();

function buildItems(orderId: string, count: number): OrderItem[] {
  const chosen: CatalogProduct[] = [];
  while (chosen.length < count) {
    const product = pick(catalog);
    if (!chosen.some((p) => p.slug === product.slug)) chosen.push(product);
  }

  return chosen.map((product, index) => {
    const qty =
      product.costAfn > 28_000
        ? 1
        : chance(0.72)
          ? 1
          : int(2, product.costAfn < 4_200 ? 6 : 3);
    const unitCostAfn = Math.round((product.costAfn * jitter(0.04)) / 50) * 50;
    /*
     * The quoted price is the *landed* price, not the sticker price: it absorbs
     * the store's own tax, the domestic shipping to the forwarder and a buffer
     * for the price moving between the quote and the day we actually buy. The
     * order's service fee is the margin on top of that.
     */
    const unitPriceAfn = Math.round((unitCostAfn * QUOTE_MARKUP) / 50) * 50;

    return {
      id: `${orderId}-item-${index + 1}`,
      name: product.name,
      productUrl: productUrl(product, `B0${int(10000000, 99999999)}`),
      storeId: product.storeId,
      category: product.category,
      variant: product.variants ? pick(product.variants) : undefined,
      qty,
      unitPriceAfn,
      unitCostAfn,
      weightKg: Math.round(product.weightKg * qty * 100) / 100,
      notes: chance(0.12) ? "Client asked for the exact colour in the link." : undefined,
    } satisfies OrderItem;
  });
}

function buildTimeline(
  order: Omit<Order, "timeline">,
  stage: number,
): OrderEvent[] {
  const events: OrderEvent[] = [];
  const requested = new Date(order.requestedAt);
  const operator = pick(OPERATORS);
  let cursor = requested;
  let n = 0;

  const push = (
    status: OrderEvent["status"],
    title: string,
    description: string,
    at: Date,
  ) => {
    n += 1;
    events.push({
      id: `${order.id}-evt-${n}`,
      at: iso(at),
      status,
      title,
      description,
      actor: operator,
    });
  };

  const client = clientById.get(order.clientId);
  push(
    "requested",
    "Request received",
    `${client?.name ?? "Client"} sent ${order.items.length} product link${
      order.items.length > 1 ? "s" : ""
    } via ${order.source === "whatsapp" ? "WhatsApp" : order.source.replace("_", " ")}.`,
    cursor,
  );

  if (stage >= stageIndex("quoted")) {
    cursor = shift(cursor, 0, int(2, 20));
    push("quoted", "Quotation sent", "Priced from the store listing plus service fee and freight.", cursor);
  }
  if (stage >= stageIndex("confirmed")) {
    cursor = shift(cursor, int(0, 2), int(1, 10));
    push("confirmed", "Order confirmed", "Client approved the quotation and paid the advance.", cursor);
  }
  if (stage >= stageIndex("purchasing")) {
    cursor = shift(cursor, int(0, 1), int(2, 12));
    push("purchasing", "Purchasing started", "Cart prepared on the store, waiting for card authorisation.", cursor);
  }
  if (stage >= stageIndex("purchased")) {
    cursor = shift(cursor, int(0, 2), int(1, 8));
    push("purchase", "Purchase placed", "Store order placed and confirmation email received.", cursor);
  }
  if (stage >= stageIndex("in_transit")) {
    cursor = shift(cursor, int(2, 6), int(1, 12));
  }
  if (stage >= stageIndex("arrived")) {
    cursor = shift(cursor, int(4, 11), int(1, 10));
    push("arrived", "Arrived in Kabul", "Cleared customs and checked into the shop.", cursor);
  }
  if (stage >= stageIndex("ready_for_pickup")) {
    cursor = shift(cursor, 0, int(2, 14));
    push("ready_for_pickup", "Ready for handover", "Client notified that the parcel is ready.", cursor);
  }
  if (stage >= stageIndex("delivered") && order.status !== "cancelled") {
    cursor = shift(cursor, int(0, 3), int(1, 9));
    push("delivered", "Handed over", "Client collected the order and signed the receipt.", cursor);
  }
  if (order.status === "cancelled") {
    cursor = shift(cursor, int(1, 4), int(1, 9));
    push("cancelled", "Order cancelled", "Client changed their mind before we placed the purchase.", cursor);
  }
  if (order.status === "refunded") {
    cursor = shift(cursor, int(2, 7), int(1, 9));
    push("refunded", "Order refunded", "Item arrived damaged — refunded in full and returned to the store.", cursor);
  }

  return events;
}

function buildPurchases(order: Order): Purchase[] {
  // Items are grouped by store — one store order per store, like real life.
  const byStore = new Map<string, OrderItem[]>();
  order.items.forEach((item) => {
    const list = byStore.get(item.storeId) ?? [];
    list.push(item);
    byStore.set(item.storeId, list);
  });

  const purchasedEvent = order.timeline.find((e) => e.status === "purchase");
  const purchasedAt = purchasedEvent
    ? new Date(purchasedEvent.at)
    : shift(new Date(order.requestedAt), 4);

  const stage = effectiveStage(order.status);

  let status: PurchaseStatus = "placed";
  if (order.status === "cancelled") status = "cancelled";
  else if (order.status === "refunded") status = "refunded";
  else if (stage >= stageIndex("arrived")) status = "received";
  else if (stage >= stageIndex("in_transit")) status = "shipped_to_warehouse";
  else if (stage >= stageIndex("purchased")) status = "placed";
  else status = "pending";

  return Array.from(byStore.entries()).map(([storeId, items]) => {
    purchaseSeq += 1;
    /*
     * What actually left the account for this store order: the goods plus the
     * store's tax and domestic shipping, all in Afghani. Sometimes the price
     * moved between quoting and buying.
     */
    const totalCostAfn =
      Math.round(
        (items.reduce((sum, i) => sum + i.unitCostAfn * i.qty, 0) *
          jitter(0.035) *
          (chance(0.5) ? 1.07 : 1) +
          (chance(0.45) ? int(350, 1_700) : 0)) /
          10,
      ) * 10;
    const store = storeById.get(storeId);

    return {
      id: `purchase-${String(purchaseSeq).padStart(4, "0")}`,
      purchaseNo: `PO-${purchasedAt.getUTCFullYear()}-${String(purchaseSeq).padStart(4, "0")}`,
      orderId: order.id,
      orderItemIds: items.map((i) => i.id),
      storeId,
      externalOrderNumber: externalOrderNumber(storeId),
      status,
      purchasedAt: iso(purchasedAt),
      purchasedBy: pick(OPERATORS),
      paymentMethodId: chance(0.72) ? "pm-visa" : "pm-hawala",
      totalCostAfn,
      invoiceRef: `${store?.name.split(" ")[0] ?? "STORE"}-${int(100000, 999999)}`,
      notes:
        status === "refunded"
          ? "Returned to seller — full refund credited to the business card."
          : undefined,
    } satisfies Purchase;
  });
}

function externalOrderNumber(storeId: string): string {
  switch (storeId) {
    case "store-amazon-us":
    case "store-amazon-ae":
      return `${int(111, 114)}-${int(1000000, 9999999)}-${int(1000000, 9999999)}`;
    case "store-daraz-pk":
      return `${int(100000000, 999999999)}`;
    case "store-noon":
      return `N${int(10000000, 99999999)}`;
    case "store-aliexpress":
      return `${int(8000000000000, 8999999999999)}`;
    default:
      return `${int(10000000000, 99999999999)}`;
  }
}

/**
 * What the parcel cost us to move.
 *
 * Freight is roughly weight-based; duty is a share of the declared value. These
 * two numbers are all that survived the carrier model — they now live on the
 * order itself rather than on a shipment record.
 */
function buildFreight(
  order: Order,
  itemsAfn: number,
): { freightCostAfn: number; customsDutyAfn: number } {
  const weightKg =
    Math.round(order.items.reduce((s, i) => s + (i.weightKg ?? 0.5), 0) * 100) /
    100;

  const freightCostAfn =
    Math.round(Math.max(280, weightKg * int(78, 105)) / 10) * 10;
  const customsDutyAfn =
    itemsAfn > 12000
      ? Math.round((itemsAfn * (chance(0.5) ? 0.03 : 0.045)) / 10) * 10
      : 0;

  return { freightCostAfn, customsDutyAfn };
}

/* -------------------------------------------------------------------------- */
/* Storefront catalogue                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A starting catalogue, so the storefront is not empty on first run.
 *
 * Drawn from the same product list the order seeds use, priced with the markup
 * the team quotes at. Staff can edit, unpublish or delete any of it — this is
 * only a starting point, not a fixture.
 */
const storeProducts: StoreProduct[] = catalog.slice(0, 24).map((product, index) => {
  const costAfn = Math.round(product.costAfn / 50) * 50;
  return {
    id: `sp-${String(index + 1).padStart(3, "0")}`,
    slug: product.slug,
    name: product.name,
    description: `${product.name}. Sourced to order from our partner stores and delivered to our office in Kabul.`,
    category: product.category,
    priceAfn: Math.round((costAfn * QUOTE_MARKUP * 1.12) / 50) * 50,
    costAfn,
    storeId: product.storeId,
    // A couple left unpublished so the admin has something to publish.
    active: index % 11 !== 0,
    createdAt: iso(shift(TODAY, -120 + index)),
  };
});

/* -------------------------------------------------------------------------- */
/* Main generation pass                                                        */
/* -------------------------------------------------------------------------- */

const draft: Array<{ requestedAt: Date; clientId: string }> = [];

MONTHS.forEach(({ year, month, orders: count }) => {
  for (let i = 0; i < count; i += 1) {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = int(1, daysInMonth);
    const requestedAt = new Date(
      Date.UTC(year, month, day, int(7, 19), int(0, 59)),
    );
    if (requestedAt.getTime() > TODAY.getTime()) continue;
    draft.push({ requestedAt, clientId: pick(clientPool) });
  }
});

draft.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());

draft.forEach(({ requestedAt, clientId }) => {
  orderSeq += 1;
  const id = `order-${String(orderSeq).padStart(4, "0")}`;
  const orderNo = `AS-${requestedAt.getUTCFullYear()}-${String(orderSeq).padStart(4, "0")}`;
  const ageDays = Math.floor((TODAY.getTime() - requestedAt.getTime()) / DAY);
  const status = statusForAge(ageDays);
  const client = clientById.get(clientId);

  const itemCount = client?.type === "business" ? int(1, 4) : chance(0.62) ? 1 : int(2, 3);
  const items = buildItems(id, itemCount);

  const itemsAfn = items.reduce((s, i) => s + i.unitPriceAfn * i.qty, 0);
  const totalWeight = items.reduce((s, i) => s + (i.weightKg ?? 0.5), 0);

  const shippingChargedAfn = Math.round(Math.max(400, totalWeight * int(105, 140)) / 50) * 50;
  const discountAfn =
    chance(0.14) ? Math.round((itemsAfn * (rand() * 0.04 + 0.01)) / 50) * 50 : 0;

  const trackingNumber = generateUniqueTrackingNumber({
    year: requestedAt.getUTCFullYear(),
    prefix: settings.company.orderPrefix,
    taken: trackingNumbersUsed,
    random: trackingRand,
  });
  trackingNumbersUsed.add(trackingNumber);

  const base: Omit<Order, "timeline"> = {
    id,
    orderNo,
    trackingNumber,
    clientId,
    status,
    source: pick(SOURCES),
    requestedAt: iso(requestedAt),
    items,
    // Historic orders were quoted at 14%; the amount is frozen here so past
    // totals stay exactly what they were when the percentage existed.
    serviceFeeAfn: Math.round((itemsAfn * 14) / 100),
    shippingChargedAfn,
    discountAfn,
    notes: chance(0.18)
      ? "Client will collect from the shop. Call before closing."
      : undefined,
  };

  const stage = effectiveStage(status);
  const timeline = buildTimeline(base, stage);

  const deliveredEvent = timeline.find((e) => e.status === "delivered");
  const order: Order = {
    ...base,
    deliveredAt: deliveredEvent?.at,
    timeline,
  };

  orders.push(order);

  /* --- purchases --------------------------------------------------------- */
  if (stage >= stageIndex("purchasing")) {
    purchases.push(...buildPurchases(order));
  }

  /* --- freight & duty ----------------------------------------------------- */
  if (stage >= stageIndex("in_transit") && status !== "cancelled") {
    const freight = buildFreight(order, itemsAfn);
    order.freightCostAfn = freight.freightCostAfn;
    order.customsDutyAfn = freight.customsDutyAfn;
  }

  /* --- payments ---------------------------------------------------------- */
  const serviceFeeAfn = base.serviceFeeAfn;
  const revenue = itemsAfn + serviceFeeAfn + shippingChargedAfn - discountAfn;

  const confirmEvent = timeline.find((e) => e.status === "confirmed");
  if (confirmEvent && status !== "cancelled") {
    receiptSeq += 1;
    const advanceRatio = client?.type === "business" ? 0.4 : 0.5;
    const advance = Math.round((revenue * advanceRatio) / 100) * 100;
    const at = new Date(confirmEvent.at);
    payments.push({
      id: `payment-${String(receiptSeq).padStart(4, "0")}`,
      receiptNo: `RCT-${at.getUTCFullYear()}-${String(receiptSeq).padStart(4, "0")}`,
      clientId,
      orderId: id,
      at: iso(at),
      amountAfn: advance,
      methodId: pick(["pm-cash", "pm-cash", "pm-azizi", "pm-hesabpay", "pm-aib"]),
      type: "advance",
      reference: chance(0.4) ? `TRX${int(100000, 999999)}` : undefined,
      recordedBy: pick(ACCOUNTANTS),
    });

    // The balance is settled at handover — but not always in full.
    if (deliveredEvent && status === "delivered") {
      const settleAll = chance(0.78);
      const remaining = revenue - advance;
      const paid = settleAll
        ? remaining
        : Math.round((remaining * (rand() * 0.5 + 0.25)) / 100) * 100;
      if (paid > 0) {
        receiptSeq += 1;
        const payAt = shift(new Date(deliveredEvent.at), settleAll ? 0 : int(1, 6), int(0, 6));
        payments.push({
          id: `payment-${String(receiptSeq).padStart(4, "0")}`,
          receiptNo: `RCT-${payAt.getUTCFullYear()}-${String(receiptSeq).padStart(4, "0")}`,
          clientId,
          orderId: id,
          at: iso(payAt),
          amountAfn: paid,
          methodId: pick(["pm-cash", "pm-cash", "pm-azizi", "pm-hesabpay"]),
          type: settleAll ? "final" : "partial",
          reference: chance(0.35) ? `TRX${int(100000, 999999)}` : undefined,
          note: settleAll ? undefined : "Client asked to pay the rest next week.",
          recordedBy: pick(ACCOUNTANTS),
        });
      }
    }

    if (status === "refunded") {
      receiptSeq += 1;
      const refundAt = shift(new Date(timeline[timeline.length - 1].at), int(1, 3));
      payments.push({
        id: `payment-${String(receiptSeq).padStart(4, "0")}`,
        receiptNo: `RCT-${refundAt.getUTCFullYear()}-${String(receiptSeq).padStart(4, "0")}`,
        clientId,
        orderId: id,
        at: iso(refundAt),
        amountAfn: -advance,
        methodId: "pm-cash",
        type: "refund",
        note: "Advance returned in cash after the damaged item was sent back.",
        recordedBy: pick(ACCOUNTANTS),
      });
    }
  }
});

/* -------------------------------------------------------------------------- */

orders.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
purchases.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
payments.sort((a, b) => b.at.localeCompare(a.at));

export const seedData = {
  storeProducts,
  clients,
  orders,
  purchases,
  payments,
  settings,
};

export type SeedData = typeof seedData;
