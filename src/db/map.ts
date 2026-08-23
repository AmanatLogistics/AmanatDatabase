import "server-only";

import type {
  AppNotification,
  Client,
  Order,
  OrderEvent,
  OrderItem,
  Payment,
  PublicProduct,
  Purchase,
  StoreProduct,
  WebOrder,
} from "@/lib/types";
import type * as schema from "@/db/schema";

/**
 * Database rows in, domain objects out.
 *
 * `src/lib/types.ts` is the contract every screen reads; `src/db/schema.ts` is
 * how Postgres stores it. They disagree in three deliberate places, and this is
 * the only file that knows about all three:
 *
 * - timestamps are `Date` in a row and an ISO string in the domain
 * - `weightKg` is stored as whole grams, to keep floats out of the data
 * - a purchase's order lines are a join table, not an array
 *
 * Everything else is a straight copy. The conversions live here rather than in
 * each query so there is one place to be wrong.
 */

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

const iso = (value: Date | null | undefined): string | undefined =>
  value ? value.toISOString() : undefined;

/** Postgres gives back `null` for an absent value; the domain uses `undefined`. */
const opt = <T>(value: T | null): T | undefined => value ?? undefined;

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

export function toClient(row: Row<typeof schema.clients>): Client {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    status: row.status,
    phone: row.phone,
    whatsapp: opt(row.whatsapp),
    email: opt(row.email),
    city: row.city,
    address: opt(row.address),
    preferredContact: row.preferredContact,
    notes: opt(row.notes),
    createdAt: row.createdAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export function toOrderItem(row: Row<typeof schema.orderItems>): OrderItem {
  return {
    id: row.id,
    name: row.name,
    productUrl: opt(row.productUrl),
    imageUrl: opt(row.imageUrl),
    storeId: row.storeId,
    category: row.category,
    variant: opt(row.variant),
    qty: row.qty,
    unitPriceAfn: row.unitPriceAfn,
    unitCostAfn: row.unitCostAfn,
    // Grams on the way in, kilograms on the way out.
    weightKg: row.weightGrams == null ? undefined : row.weightGrams / 1000,
    notes: opt(row.notes),
  };
}

export function toOrderEvent(row: Row<typeof schema.orderEvents>): OrderEvent {
  return {
    id: row.id,
    at: row.at.toISOString(),
    status: row.kind,
    title: row.title,
    description: opt(row.description),
    actor: row.actor,
  };
}

export function toOrder(
  row: Row<typeof schema.orders> & {
    items?: Row<typeof schema.orderItems>[];
    timeline?: Row<typeof schema.orderEvents>[];
  },
): Order {
  return {
    id: row.id,
    orderNo: row.orderNo,
    trackingNumber: row.trackingNumber,
    clientId: row.clientId,
    status: row.status,
    source: row.source,
    requestedAt: row.requestedAt.toISOString(),
    deliveredAt: iso(row.deliveredAt),
    // Sorted here so every screen sees the operator's order without asking.
    items: (row.items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toOrderItem),
    serviceFeeAfn: row.serviceFeeAfn,
    shippingChargedAfn: row.shippingChargedAfn,
    freightCostAfn: opt(row.freightCostAfn),
    customsDutyAfn: opt(row.customsDutyAfn),
    discountAfn: row.discountAfn,
    notes: opt(row.notes),
    timeline: (row.timeline ?? [])
      .slice()
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map(toOrderEvent),
  };
}

/** Kilograms to whole grams, for writing back. */
export function toGrams(weightKg: number | undefined): number | null {
  return weightKg == null ? null : Math.round(weightKg * 1000);
}

/* -------------------------------------------------------------------------- */
/* Purchases                                                                   */
/* -------------------------------------------------------------------------- */

export function toPurchase(
  row: Row<typeof schema.purchases> & {
    items?: { orderItemId: string }[];
  },
): Purchase {
  return {
    id: row.id,
    purchaseNo: row.purchaseNo,
    orderId: row.orderId,
    orderItemIds: (row.items ?? []).map((link) => link.orderItemId),
    storeId: row.storeId,
    externalOrderNumber: row.externalOrderNumber,
    status: row.status,
    purchasedAt: row.purchasedAt.toISOString(),
    purchasedBy: row.purchasedBy,
    paymentMethodId: row.paymentMethodId,
    totalCostAfn: row.totalCostAfn,
    invoiceRef: opt(row.invoiceRef),
    notes: opt(row.notes),
  };
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

export function toPayment(row: Row<typeof schema.payments>): Payment {
  return {
    id: row.id,
    receiptNo: row.receiptNo,
    clientId: row.clientId,
    orderId: opt(row.orderId),
    at: row.at.toISOString(),
    amountAfn: row.amountAfn,
    methodId: row.methodId,
    type: row.type,
    reference: opt(row.reference),
    note: opt(row.note),
    recordedBy: row.recordedBy,
  };
}

/* -------------------------------------------------------------------------- */
/* Shop                                                                        */
/* -------------------------------------------------------------------------- */

export function toStoreProduct(
  row: Row<typeof schema.storeProducts> & {
    images?: Row<typeof schema.productImages>[];
  },
): StoreProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrls: (row.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((image) => image.url),
    category: row.category,
    priceAfn: row.priceAfn,
    costAfn: row.costAfn,
    storeId: row.storeId,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The same product, with everything a customer must not see removed.
 *
 * `costAfn` is what we pay to source it. Serialising a product straight to the
 * storefront would put our margin on every product page, in the page source,
 * for anyone who opens developer tools. Dropping it at the boundary is the only
 * reliable place — a component that "does not render it" still ships it.
 */
export function toPublicProduct(
  row: Parameters<typeof toStoreProduct>[0],
): PublicProduct {
  /*
   * Built by naming what a customer gets, rather than by deleting what they
   * must not. A new staff-only column added to the schema is then absent from
   * this by default, instead of leaking until somebody remembers to remove it.
   */
  const full = toStoreProduct(row);
  return {
    id: full.id,
    slug: full.slug,
    name: full.name,
    description: full.description,
    imageUrls: full.imageUrls,
    category: full.category,
    priceAfn: full.priceAfn,
    active: full.active,
    createdAt: full.createdAt,
  };
}

export function toWebOrder(
  row: Row<typeof schema.webOrders> & {
    lines?: Row<typeof schema.webOrderLines>[];
  },
): WebOrder {
  return {
    id: row.id,
    reference: row.reference,
    placedAt: row.placedAt.toISOString(),
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerCity: row.customerCity,
    customerAddress: opt(row.customerAddress),
    note: opt(row.note),
    lines: (row.lines ?? []).map((line) => ({
      productId: line.productId ?? "",
      name: line.name,
      qty: line.qty,
      priceAfn: line.priceAfn,
    })),
    totalAfn: row.totalAfn,
    status: row.status,
    convertedOrderId: opt(row.convertedOrderId),
  };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export function toNotification(
  row: Row<typeof schema.notifications>,
): AppNotification {
  return {
    id: row.id,
    at: row.at.toISOString(),
    kind: row.kind,
    title: row.title,
    description: row.description,
    href: opt(row.href),
    read: row.read,
  };
}
