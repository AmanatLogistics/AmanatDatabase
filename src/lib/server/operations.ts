"use server";

import { randomUUID } from "node:crypto";
import { desc, eq, sql as raw } from "drizzle-orm";

import { db } from "@/db";
import { withDeadline } from "@/db/deadline";
import {
  clients,
  notifications,
  orderEvents,
  orderItems,
  orders,
  payments,
  purchaseItems,
  purchases,
} from "@/db/schema";
import {
  toClient,
  toGrams,
  toOrder,
  toPayment,
  toPurchase,
} from "@/db/map";
import { requireStaff } from "@/lib/auth/session";
import { loadSettings } from "@/lib/server/settings";
import type {
  ServerResult,
  Client,
  NotificationKind,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  Purchase,
  PurchaseStatus,
  Settings,
} from "@/lib/types";

/**
 * The operations database: clients, orders, purchases, payments.
 *
 * Everything here requires a session, and every write records who did it —
 * `requireStaff` returns the signed-in person, so the actor is taken from the
 * session rather than from the caller. A browser that could name the actor
 * could name somebody else.
 */

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

export interface OperationsData {
  clients: Client[];
  orders: Order[];
  purchases: Purchase[];
  payments: Payment[];
  settings: Settings;
}

/**
 * Everything the admin screens read, in one call.
 *
 * One round trip rather than five: Next dispatches server actions from a client
 * one at a time, so five calls would run in series. A shop with hundreds of
 * records fits comfortably in one payload, and it arrives consistent — five
 * calls could interleave with somebody else's write and disagree with
 * each other.
 */
/**
 * `loadOperations`, with its failure returned rather than thrown.
 *
 * Every admin screen waits on this one call, so when it fails the whole app is
 * a placeholder — and in production the reason never reached the browser at
 * all, because Next strips the message from anything a server action throws.
 * That is the correct default and the wrong one here: this runs behind a staff
 * login, and the person reading the screen is the person who has to fix it.
 *
 * Redirects are deliberately re-thrown. `requireStaff` signals "sign in again"
 * by throwing, and swallowing that would turn an expired session into a
 * mystifying error message instead of a login page.
 */
export async function loadOperationsSafely(): Promise<
  ServerResult<OperationsData>
> {
  try {
    return { ok: true, data: await loadOperations() };
  } catch (error) {
    const digest = (error as { digest?: unknown })?.digest;
    if (typeof digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND)/.test(digest)) {
      throw error;
    }

    // Whole, in the runtime log, where a stack is useful.
    console.error("[amanat] loadOperations failed", error);

    const message = (error as Error)?.message ?? String(error);
    const cause = (error as { cause?: { message?: string } })?.cause?.message;
    return { ok: false, message: cause ? `${message}\n\n${cause}` : message };
  }
}

export async function loadOperations(): Promise<OperationsData> {
  await requireStaff();

  /*
   * Settings first, on its own. It may open a transaction to seed the
   * reference data, and a transaction inside a `Promise.all` on a one
   * connection pool is the shape that deadlocked product saving: the
   * transaction holds the connection the other queries are queued for.
   * Cheap to be certain about.
   */
  const settings = await loadSettings();

  /*
   * Bounded like everything else on the request path. This is the largest read
   * the app makes and the one every admin screen waits on, so an unbounded one
   * here is a page that shows placeholders for ever — the browser cannot tell
   * "still loading" from "never coming".
   */
  const [clientRows, orderRows, purchaseRows, paymentRows] = await withDeadline(
    Promise.all([
      db.select().from(clients).orderBy(desc(clients.createdAt)),
      db.query.orders.findMany({
        with: { items: true, timeline: true },
        orderBy: [desc(orders.requestedAt)],
      }),
      db.query.purchases.findMany({
        with: { items: true },
        orderBy: [desc(purchases.purchasedAt)],
      }),
      db.select().from(payments).orderBy(desc(payments.at)),
    ]),
    "loading your clients, orders, purchases and payments",
  );

  return {
    clients: clientRows.map(toClient),
    orders: orderRows.map(toOrder),
    purchases: purchaseRows.map(toPurchase),
    payments: paymentRows.map(toPayment),
    settings,
  };
}

/* -------------------------------------------------------------------------- */
/* Reference numbers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The next number in a series, e.g. AS-2026-0148.
 *
 * Counted inside the caller's transaction and under its lock, so two operators
 * creating an order in the same second cannot be handed the same one — the
 * unique index would refuse the second and lose their work.
 */
async function nextReference(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  table: typeof orders | typeof purchases | typeof payments,
  prefix: string,
  lockKey: string,
): Promise<string> {
  await tx.execute(raw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
  const [row] = await tx.select({ count: raw<number>`count(*)::int` }).from(table);
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String((row?.count ?? 0) + 1).padStart(4, "0")}`;
}

async function notify(
  kind: NotificationKind,
  title: string,
  description: string,
  href?: string,
): Promise<void> {
  await db.insert(notifications).values({
    id: randomUUID(),
    kind,
    title,
    description,
    href: href ?? null,
  });
}

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

export type NewClient = Omit<Client, "id" | "code" | "createdAt">;

export async function createClient(input: NewClient): Promise<Client> {
  await requireStaff();

  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.execute(raw`SELECT pg_advisory_xact_lock(hashtext('amanat:client-code'))`);
    const [row] = await tx.select({ count: raw<number>`count(*)::int` }).from(clients);
    const code = `AMN-C-${String((row?.count ?? 0) + 1).padStart(4, "0")}`;

    await tx.insert(clients).values({
      id,
      code,
      name: input.name.trim(),
      type: input.type,
      status: input.status,
      phone: input.phone.trim(),
      whatsapp: input.whatsapp?.trim() || null,
      email: input.email?.trim() || null,
      city: input.city,
      address: input.address?.trim() || null,
      preferredContact: input.preferredContact,
      notes: input.notes?.trim() || null,
    });
  });

  const [saved] = await db.select().from(clients).where(eq(clients.id, id));
  return toClient(saved);
}

/**
 * The fields a client record will accept from a browser.
 *
 * An allow-list rather than "everything except id and code". This is a POST
 * endpoint: whatever it spreads into an UPDATE is whatever the caller chose to
 * send, so a column is editable only by being named here. `code` and
 * `createdAt` are ours; changing a client's reference after invoices carry it
 * is not an edit, it is a rewrite.
 */
const CLIENT_FIELDS = [
  "name",
  "type",
  "status",
  "phone",
  "whatsapp",
  "email",
  "city",
  "address",
  "preferredContact",
  "notes",
] as const satisfies readonly (keyof Client)[];

function pick<T extends object, K extends readonly (keyof T)[]>(
  source: T,
  keys: K,
): Partial<Pick<T, K[number]>> {
  const out: Partial<Pick<T, K[number]>> = {};
  for (const key of keys) {
    if (key in source && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export async function updateClient(
  id: string,
  patch: Partial<Client>,
): Promise<void> {
  await requireStaff();
  const fields = pick(patch, CLIENT_FIELDS);
  if (Object.keys(fields).length === 0) return;
  await db.update(clients).set(fields).where(eq(clients.id, id));
}

/** Cascades to their orders, and to the purchases and payments on those. */
export async function deleteClient(id: string): Promise<void> {
  await requireStaff();
  await db.delete(clients).where(eq(clients.id, id));
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export interface NewOrder {
  clientId: string;
  source: Order["source"];
  trackingNumber: string;
  items: Omit<OrderItem, "id">[];
  serviceFeeAfn: number;
  shippingChargedAfn: number;
  discountAfn: number;
  notes?: string;
}

export async function createOrder(input: NewOrder): Promise<Order> {
  const who = await requireStaff();
  if (input.items.length === 0) throw new Error("An order needs at least one item.");

  const id = randomUUID();

  await db.transaction(async (tx) => {
    const orderNo = await nextReference(tx, orders, "AS", "amanat:order-no");

    await tx.insert(orders).values({
      id,
      orderNo,
      trackingNumber: input.trackingNumber,
      clientId: input.clientId,
      status: "requested",
      source: input.source,
      serviceFeeAfn: Math.round(input.serviceFeeAfn),
      shippingChargedAfn: Math.round(input.shippingChargedAfn),
      discountAfn: Math.round(input.discountAfn),
      notes: input.notes?.trim() || null,
    });

    await tx.insert(orderItems).values(
      input.items.map((item, position) => ({
        id: randomUUID(),
        orderId: id,
        position,
        name: item.name.trim(),
        productUrl: item.productUrl?.trim() || null,
        imageUrl: item.imageUrl || null,
        storeId: item.storeId,
        category: item.category,
        variant: item.variant?.trim() || null,
        qty: item.qty,
        unitPriceAfn: Math.round(item.unitPriceAfn),
        unitCostAfn: Math.round(item.unitCostAfn),
        weightGrams: toGrams(item.weightKg),
        notes: item.notes?.trim() || null,
      })),
    );

    await tx.insert(orderEvents).values({
      id: randomUUID(),
      orderId: id,
      kind: "requested",
      title: "Order created",
      description: `Tracking ${input.trackingNumber}`,
      actor: who.name,
    });
  });

  const saved = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true, timeline: true },
  });
  if (!saved) throw new Error("The order was not saved.");

  await notify(
    "order_created",
    `Order ${saved.orderNo} created`,
    `Tracking ${saved.trackingNumber}`,
    `/orders/${id}`,
  );

  return toOrder(saved);
}

/**
 * The money and notes an order will accept from a browser.
 *
 * `status` and `trackingNumber` are absent on purpose: both have their own
 * action, because both do more than write a column — one stamps the timeline
 * and notifies, the other checks for a clash first. Reaching them through here
 * would skip that.
 */
const ORDER_FIELDS = [
  "source",
  "serviceFeeAfn",
  "shippingChargedAfn",
  "freightCostAfn",
  "customsDutyAfn",
  "discountAfn",
  "notes",
] as const satisfies readonly (keyof Order)[];

export async function updateOrder(
  id: string,
  patch: Partial<Omit<Order, "items" | "timeline">>,
): Promise<void> {
  await requireStaff();
  const fields = pick(patch, ORDER_FIELDS);
  if (Object.keys(fields).length === 0) return;
  await db.update(orders).set(fields).where(eq(orders.id, id));
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string,
): Promise<void> {
  const who = await requireStaff();

  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order || order.status === status) return;

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status,
        deliveredAt:
          status === "delivered" ? (order.deliveredAt ?? new Date()) : order.deliveredAt,
      })
      .where(eq(orders.id, id));

    await tx.insert(orderEvents).values({
      id: randomUUID(),
      orderId: id,
      kind: status,
      title: `Status changed to ${status.replace(/_/g, " ")}`,
      description: note ?? null,
      actor: who.name,
    });
  });

  await notify(
    "order_status",
    `${order.orderNo} is now ${status.replace(/_/g, " ")}`,
    note ?? `Tracking ${order.trackingNumber}`,
    `/orders/${id}`,
  );
}

export async function addOrderNote(id: string, note: string): Promise<void> {
  const who = await requireStaff();
  const text = note.trim();
  if (!text) return;

  await db.insert(orderEvents).values({
    id: randomUUID(),
    orderId: id,
    kind: "note",
    title: "Note added",
    description: text,
    actor: who.name,
  });
}

export async function setOrderTrackingNumber(
  id: string,
  trackingNumber: string,
): Promise<void> {
  const who = await requireStaff();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) return;

  /*
   * The unique index is the real guard — this only turns the constraint
   * violation into a sentence somebody can act on.
   */
  const clash = await db.query.orders.findFirst({
    where: eq(orders.trackingNumber, trackingNumber),
  });
  if (clash && clash.id !== id) {
    throw new Error(`${trackingNumber} is already used by ${clash.orderNo}.`);
  }

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ trackingNumber }).where(eq(orders.id, id));
    await tx.insert(orderEvents).values({
      id: randomUUID(),
      orderId: id,
      kind: "note",
      title: "Tracking number changed",
      description: `${order.trackingNumber} → ${trackingNumber}`,
      actor: who.name,
    });
  });
}

/** Cascades to the order's items, timeline, purchases and payments. */
export async function deleteOrder(id: string): Promise<void> {
  await requireStaff();
  await db.delete(orders).where(eq(orders.id, id));
}

/* -------------------------------------------------------------------------- */
/* Purchases                                                                   */
/* -------------------------------------------------------------------------- */

export interface NewPurchase {
  orderId: string;
  orderItemIds: string[];
  storeId: string;
  externalOrderNumber: string;
  status: PurchaseStatus;
  paymentMethodId: string;
  totalCostAfn: number;
  invoiceRef?: string;
  notes?: string;
}

export async function createPurchase(input: NewPurchase): Promise<Purchase> {
  const who = await requireStaff();
  const id = randomUUID();

  await db.transaction(async (tx) => {
    const purchaseNo = await nextReference(tx, purchases, "PO", "amanat:purchase-no");

    await tx.insert(purchases).values({
      id,
      purchaseNo,
      orderId: input.orderId,
      storeId: input.storeId,
      externalOrderNumber: input.externalOrderNumber.trim(),
      status: input.status,
      purchasedBy: who.name,
      paymentMethodId: input.paymentMethodId,
      totalCostAfn: Math.round(input.totalCostAfn),
      invoiceRef: input.invoiceRef?.trim() || null,
      notes: input.notes?.trim() || null,
    });

    if (input.orderItemIds.length > 0) {
      await tx.insert(purchaseItems).values(
        input.orderItemIds.map((orderItemId) => ({ purchaseId: id, orderItemId })),
      );
    }

    // Buying moves the order along, the way it does in the shop.
    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, input.orderId),
    });
    if (
      order &&
      ["requested", "quoted", "confirmed", "purchasing"].includes(order.status)
    ) {
      await tx.update(orders).set({ status: "purchased" }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId: order.id,
        kind: "purchase",
        title: "Purchase placed",
        description: `Store order ${input.externalOrderNumber} recorded.`,
        actor: who.name,
      });
    }
  });

  const saved = await db.query.purchases.findFirst({
    where: eq(purchases.id, id),
    with: { items: true },
  });
  if (!saved) throw new Error("The purchase was not saved.");

  await notify(
    "purchase",
    `Purchase ${saved.purchaseNo} logged`,
    `${saved.totalCostAfn.toLocaleString()} AFN paid out`,
    `/purchases/${id}`,
  );

  return toPurchase(saved);
}

/**
 * Move a purchase along the pipeline.
 *
 * Reaching `received` carries the order to `arrived`: the goods being with us
 * is what makes an order arrived, and asking an operator to record it twice is
 * how the two drift apart.
 */
export async function setPurchaseStatus(
  id: string,
  status: PurchaseStatus,
  note?: string,
): Promise<void> {
  const who = await requireStaff();

  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.id, id),
  });
  if (!purchase || purchase.status === status) return;

  await db.transaction(async (tx) => {
    await tx.update(purchases).set({ status }).where(eq(purchases.id, id));

    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, purchase.orderId),
    });
    if (order) {
      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId: order.id,
        kind: "purchase",
        title: `${purchase.purchaseNo} is now ${status.replace(/_/g, " ")}`,
        description: note ?? null,
        actor: who.name,
      });

      const carries =
        status === "received" &&
        !["arrived", "ready_for_pickup", "delivered", "cancelled", "refunded"].includes(
          order.status,
        );
      if (carries) {
        await tx.update(orders).set({ status: "arrived" }).where(eq(orders.id, order.id));
      }
    }
  });

  await notify(
    "purchase",
    `${purchase.purchaseNo} is now ${status.replace(/_/g, " ")}`,
    note ?? "",
    `/purchases/${id}`,
  );
}

export async function deletePurchase(id: string): Promise<void> {
  await requireStaff();
  await db.delete(purchases).where(eq(purchases.id, id));
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

export interface NewPayment {
  clientId: string;
  orderId?: string;
  amountAfn: number;
  methodId: string;
  type: Payment["type"];
  reference?: string;
  note?: string;
}

export async function createPayment(input: NewPayment): Promise<Payment> {
  const who = await requireStaff();
  const id = randomUUID();

  await db.transaction(async (tx) => {
    const receiptNo = await nextReference(tx, payments, "RCT", "amanat:receipt-no");

    await tx.insert(payments).values({
      id,
      receiptNo,
      clientId: input.clientId,
      orderId: input.orderId ?? null,
      amountAfn: Math.round(input.amountAfn),
      methodId: input.methodId,
      type: input.type,
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
      recordedBy: who.name,
    });

    if (input.orderId) {
      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId: input.orderId,
        kind: "payment",
        title: `${receiptNo} recorded`,
        description: `${Math.round(input.amountAfn).toLocaleString()} AFN`,
        actor: who.name,
      });
    }
  });

  const [saved] = await db.select().from(payments).where(eq(payments.id, id));

  await notify(
    "payment",
    `Payment ${saved.receiptNo} recorded`,
    `${saved.amountAfn.toLocaleString()} AFN`,
    input.orderId ? `/orders/${input.orderId}` : "/payments",
  );

  return toPayment(saved);
}

/* -------------------------------------------------------------------------- */
/* Starting over                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Erase every record. Settings go back to their defaults with them.
 *
 * Staff accounts are deliberately left alone: emptying them would lock everyone
 * out of the app they just cleared, and "delete the data" is not "delete
 * yourself". Products and website orders go — they are records too.
 */
export async function eraseEverything(): Promise<void> {
  await requireStaff();
  await db.execute(raw`
    TRUNCATE clients, store_products, web_orders, notifications,
             company_profile, stores, payment_methods
    RESTART IDENTITY CASCADE`);
}

/* -------------------------------------------------------------------------- */
/* Timeline, for one order                                                     */
/* -------------------------------------------------------------------------- */

