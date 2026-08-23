"use server";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql as raw } from "drizzle-orm";

import { db } from "@/db";
import {
  notifications,
  orderEvents,
  orders,
  storeProducts,
  webOrderLines,
  webOrders,
} from "@/db/schema";
import { toPublicProduct } from "@/db/map";
import {
  CLIENT_STATUS_MESSAGE,
  ORDER_STATUS,
  clientProgressIndex,
} from "@/lib/constants";
import { normaliseTrackingNumber } from "@/lib/tracking";
import type { PublicProduct } from "@/lib/types";

/**
 * What the shop can do without anybody signed in.
 *
 * Every function here is reachable by anyone who can send a POST — that is what
 * `use server` means — so each one decides for itself what a stranger may see
 * and what they may write. None of them takes an amount of money from the
 * caller, and none returns a cost price.
 */

/* -------------------------------------------------------------------------- */
/* Browsing                                                                    */
/* -------------------------------------------------------------------------- */

/** Published products, without the cost prices. */
export async function listPublishedProducts(): Promise<PublicProduct[]> {
  const rows = await db.query.storeProducts.findMany({
    where: eq(storeProducts.active, true),
    with: { images: true },
    orderBy: [desc(storeProducts.createdAt)],
  });
  return rows.map(toPublicProduct);
}

export async function getPublishedProduct(
  slug: string,
): Promise<PublicProduct | null> {
  const row = await db.query.storeProducts.findFirst({
    where: and(eq(storeProducts.slug, slug), eq(storeProducts.active, true)),
    with: { images: true },
  });
  return row ? toPublicProduct(row) : null;
}

/* -------------------------------------------------------------------------- */
/* Ordering                                                                    */
/* -------------------------------------------------------------------------- */

export interface CheckoutLine {
  productId: string;
  qty: number;
}

export interface CheckoutInput {
  name: string;
  phone: string;
  city: string;
  address?: string;
  note?: string;
  lines: CheckoutLine[];
}

export interface CheckoutResult {
  reference?: string;
  error?: string;
}

const MAX_LINES = 40;
const MAX_QTY = 50;

/**
 * Take an order from the storefront.
 *
 * The prices are read from the database, never from the request. A basket
 * arrives as product ids and quantities and nothing else — a caller who sends
 * their own price is describing a product we do not sell, and the sum they owe
 * has to be ours to compute.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const name = input.name?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const city = input.city?.trim() ?? "";

  if (name.length < 2) return { error: "Please enter your name." };
  if (phone.replace(/\D/g, "").length < 7) {
    return { error: "Please enter a phone number we can reach you on." };
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { error: "Your basket is empty." };
  }
  if (input.lines.length > MAX_LINES) {
    return { error: "That is too many different items for one order." };
  }

  // Collapse duplicates and clamp, so the same id twice cannot multiply out.
  const wanted = new Map<string, number>();
  for (const line of input.lines) {
    const qty = Math.floor(Number(line.qty));
    if (!line.productId || !Number.isFinite(qty) || qty < 1) continue;
    wanted.set(
      String(line.productId),
      Math.min(MAX_QTY, (wanted.get(String(line.productId)) ?? 0) + qty),
    );
  }
  if (wanted.size === 0) return { error: "Your basket is empty." };

  const found = await db.query.storeProducts.findMany({
    where: and(
      eq(storeProducts.active, true),
      inArray(storeProducts.id, [...wanted.keys()]),
    ),
  });
  if (found.length === 0) {
    return { error: "Those products are no longer available." };
  }

  const reference = await db.transaction(async (tx) => {
    /*
     * The reference is generated inside the transaction and under a lock, so
     * two customers checking out in the same second cannot be handed the same
     * one — the unique index would refuse the second and lose their order.
     */
    await tx.execute(raw`SELECT pg_advisory_xact_lock(hashtext('amanat:web-order-ref'))`);

    const [{ count }] = await tx
      .select({ count: raw<number>`count(*)::int` })
      .from(webOrders);
    const year = new Date().getUTCFullYear();
    const ref = `WEB-${year}-${String(count + 1).padStart(4, "0")}`;

    const lines = found.map((product) => ({
      id: randomUUID(),
      productId: product.id,
      // Copied, so editing a product later does not rewrite what was quoted.
      name: product.name,
      qty: wanted.get(product.id) ?? 1,
      priceAfn: product.priceAfn,
    }));
    const totalAfn = lines.reduce(
      (sum, line) => sum + line.priceAfn * line.qty,
      0,
    );

    const orderId = randomUUID();
    await tx.insert(webOrders).values({
      id: orderId,
      reference: ref,
      customerName: name,
      customerPhone: phone,
      customerCity: city,
      customerAddress: input.address?.trim() || null,
      note: input.note?.trim() || null,
      totalAfn,
      status: "new",
    });
    await tx
      .insert(webOrderLines)
      .values(lines.map((line) => ({ ...line, webOrderId: orderId })));

    // The notification is written in the same transaction as the order, so
    // there is no version of events where one exists without the other.
    await tx.insert(notifications).values({
      id: randomUUID(),
      kind: "web_order",
      title: `New website order ${ref}`,
      description: `${name} · ${totalAfn.toLocaleString()} AFN · ${lines.length} item${lines.length === 1 ? "" : "s"}`,
      href: "/shop/orders",
    });

    return ref;
  });

  return { reference };
}

/* -------------------------------------------------------------------------- */
/* Tracking                                                                    */
/* -------------------------------------------------------------------------- */

export interface WebOrderProgress {
  reference: string;
  placedAt: string;
  customerName: string;
  totalAfn: number;
  lines: { name: string; qty: number }[];
  /** Set once staff have turned it into a real order. */
  trackingNumber?: string;
  convertedOrderId?: string;
}

/**
 * Look up a website order by its reference.
 *
 * Returns nothing a stranger should not hold: no phone number, no address, no
 * cost. Somebody guessing references learns only that an order exists and what
 * was on it, which is what the person holding the reference already knows.
 */
export async function findWebOrder(
  reference: string,
): Promise<WebOrderProgress | null> {
  const ref = reference.trim().toUpperCase();
  if (!/^WEB-\d{4}-\d{1,6}$/.test(ref)) return null;

  const row = await db.query.webOrders.findFirst({
    where: eq(webOrders.reference, ref),
    with: {
      lines: { orderBy: [asc(webOrderLines.name)] },
      convertedOrder: true,
    },
  });
  if (!row) return null;

  return {
    reference: row.reference,
    placedAt: row.placedAt.toISOString(),
    customerName: row.customerName,
    totalAfn: row.totalAfn,
    lines: row.lines.map((line) => ({ name: line.name, qty: line.qty })),
    trackingNumber: row.convertedOrder?.trackingNumber,
    convertedOrderId: row.convertedOrderId ?? undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* What the tracking page asks for                                             */
/* -------------------------------------------------------------------------- */

/**
 * The shape the tracking page renders. Mirrors `PublicTrackingResult` in
 * `src/lib/api/queries.ts`, which is the contract that page reads.
 */
export interface TrackingResult {
  trackingNumber: string;
  statusLabel: string;
  statusMessage: string;
  progressIndex: number | null;
  arrivedAtOffice: boolean;
  delivered: boolean;
  placedAt: string;
  deliveredAt?: string;
  items: { name: string; qty: number; imageUrl?: string }[];
  timeline: { at: string; statusLabel: string }[];
}

/**
 * Look an order up by whatever reference the customer is holding.
 *
 * This is the whole point of the exercise: it runs on the server, against the
 * shop's database, so it answers for a customer on their own phone in a way the
 * previous version — reading the visitor's own browser storage — never could.
 *
 * Website references (`WEB-…`) resolve today. Tracking numbers (`AM-…`) are
 * issued when staff turn a website order into an operations order, and those
 * still live in a browser; this is the one place that gains a second lookup
 * when they move across, and the page above it will not need touching.
 */
/**
 * One order, by the tracking number printed on the customer's receipt.
 *
 * A projection, not the order. What comes back is a status, a position on the
 * five customer-facing stages, the item names and the dates — and never the
 * client record, the phone number, the address, what we paid, or the margin.
 * Holding a tracking number is not permission to read a client file.
 */
async function findByTrackingNumber(
  reference: string,
): Promise<TrackingResult | null> {
  const number = normaliseTrackingNumber(reference);
  if (!number) return null;

  const row = await db.query.orders.findFirst({
    where: eq(orders.trackingNumber, number),
    with: { items: true, timeline: { orderBy: [asc(orderEvents.at)] } },
  });
  if (!row) return null;

  const arrived = ["arrived", "ready_for_pickup", "delivered"].includes(row.status);

  return {
    trackingNumber: row.trackingNumber,
    statusLabel: ORDER_STATUS[row.status].label,
    statusMessage: CLIENT_STATUS_MESSAGE[row.status],
    progressIndex: clientProgressIndex(row.status),
    arrivedAtOffice: arrived,
    delivered: row.status === "delivered",
    placedAt: row.requestedAt.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString(),
    items: row.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        name: item.name,
        qty: item.qty,
        imageUrl: item.imageUrl ?? undefined,
      })),
    /*
     * Status changes only. Notes, payments and purchases are internal — a
     * customer reading "held until the client confirms the colour" is being
     * shown the office's own conversation.
     */
    timeline: row.timeline
      .filter((event) => event.kind in ORDER_STATUS)
      .map((event) => ({
        at: event.at.toISOString(),
        statusLabel: ORDER_STATUS[event.kind as keyof typeof ORDER_STATUS].label,
      })),
  };
}

export async function trackByReference(
  reference: string,
): Promise<TrackingResult | null> {
  const direct = await findByTrackingNumber(reference);
  if (direct) return direct;

  const web = await findWebOrder(reference);
  if (!web) return null;

  // A website order that became a real one follows through to it, so the
  // customer sees actual progress rather than "received" forever.
  if (web.trackingNumber) {
    const followed = await findByTrackingNumber(web.trackingNumber);
    if (followed) return followed;
  }

  const converted = Boolean(web.convertedOrderId) || Boolean(web.trackingNumber);

  return {
    // What to quote back at us. Their own reference until there is a real one.
    trackingNumber: web.trackingNumber ?? web.reference,
    statusLabel: converted ? "Being arranged" : "Order received",
    statusMessage: converted
      ? "We have your order and are arranging the purchase. We will call you to confirm the price."
      : "We have your order. We will call you shortly to confirm the price before buying anything.",
    // Stage 0 of the five: received. Nothing has been bought yet.
    progressIndex: 0,
    arrivedAtOffice: false,
    delivered: false,
    placedAt: web.placedAt,
    items: web.lines.map((line) => ({ name: line.name, qty: line.qty })),
    timeline: [{ at: web.placedAt, statusLabel: "Order received" }],
  };
}
