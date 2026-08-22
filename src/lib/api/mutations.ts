"use client";

import {
  ORDER_STATUS,
  PURCHASE_STATUS,
  PURCHASE_STATUS_DESCRIPTION,
} from "@/lib/constants";
import { actorName } from "@/lib/api/actor";
import { orderRevenue } from "@/lib/finance";
import { useDataStore } from "@/lib/store";
import {
  generateUniqueTrackingNumber,
  isValidTrackingNumber,
  normaliseTrackingNumber,
} from "@/lib/tracking";
import type {
  AppNotification,
  Client,
  StoreProduct,
  WebOrder,
  ID,
  Order,
  OrderEvent,
  OrderItem,
  OrderSource,
  OrderStatus,
  Payment,
  PaymentType,
  Purchase,
  PurchaseStatus,
} from "@/lib/types";

/**
 * Write side of the data layer.
 *
 * Every function is async and returns the created/updated entity, exactly as a
 * REST call would. Today the body writes to the in-memory store; tomorrow it
 * becomes `await fetch(endpoint, { method: "POST", body })`. The endpoint each
 * one maps to is named above it.
 */

/** Small artificial delay so buttons show their pending state like the real thing. */
const LATENCY_MS = 260;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

function state() {
  return useDataStore.getState();
}

/**
 * Record that something happened.
 *
 * Written here rather than in the screens so an event is logged wherever the
 * action is triggered from — the orders list, the detail page or a dialog all
 * produce the same notification.
 */
let notificationSeq = 0;
function notify(
  kind: AppNotification["kind"],
  title: string,
  description: string,
  href?: string,
): void {
  notificationSeq += 1;
  state().pushNotification({
    id: `ntf-${Date.now()}-${notificationSeq}`,
    at: new Date().toISOString(),
    kind,
    title,
    description,
    href,
    read: false,
  });
}

function nextSequence(existing: string[], prefix: string): number {
  let max = 0;
  existing.forEach((value) => {
    const match = value.match(new RegExp(`^${prefix}-\\d{4}-(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  });
  return max + 1;
}

function pad(value: number, size = 4): string {
  return String(value).padStart(size, "0");
}

/** The clock the whole app agrees on. New records are stamped with it. */
function now(): Date {
  return state().today;
}

function event(
  orderId: ID,
  index: number,
  status: OrderEvent["status"],
  title: string,
  description: string,
  actor = actorName(),
): OrderEvent {
  return {
    id: `${orderId}-evt-${index}`,
    at: now().toISOString(),
    status,
    title,
    description,
    actor,
  };
}

/** PATCH /api/notifications/read */
export async function markNotificationsRead(): Promise<void> {
  state().markNotificationsRead();
}

/** DELETE /api/notifications */
export async function clearNotifications(): Promise<void> {
  state().clearNotifications();
}

/* -------------------------------------------------------------------------- */
/* Shop — the storefront catalogue                                             */
/* -------------------------------------------------------------------------- */

export interface SaveProductInput {
  name: string;
  description: string;
  category: StoreProduct["category"];
  priceAfn: number;
  costAfn: number;
  storeId: ID;
  imageUrls: string[];
  active: boolean;
}

/** Turn a name into a URL segment, kept unique against the catalogue. */
function slugify(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

/** POST /api/shop/products */
export async function createStoreProduct(
  input: SaveProductInput,
): Promise<StoreProduct> {
  const { storeProducts, addStoreProduct } = state();
  const product: StoreProduct = {
    id: `sp-new-${Date.now()}`,
    slug: slugify(input.name, new Set(storeProducts.map((p) => p.slug))),
    createdAt: new Date().toISOString(),
    ...input,
  };
  addStoreProduct(product);
  return delay(product);
}

/** PATCH /api/shop/products/:id */
export async function updateStoreProduct(
  id: ID,
  patch: Partial<StoreProduct>,
): Promise<void> {
  state().updateStoreProduct(id, patch);
  return delay(undefined);
}

/** DELETE /api/shop/products/:id */
export async function deleteStoreProduct(id: ID): Promise<void> {
  state().removeStoreProduct(id);
  return delay(undefined);
}

/* -------------------------------------------------------------------------- */
/* Shop — the basket (browser-local, never leaves the customer)                */
/* -------------------------------------------------------------------------- */

export function addToCart(productId: ID, qty = 1): void {
  state().addToCart(productId, qty);
}

export function setCartQty(productId: ID, qty: number): void {
  state().setCartQty(productId, qty);
}

export function clearCart(): void {
  state().clearCart();
}

/* -------------------------------------------------------------------------- */
/* Shop — checkout                                                             */
/* -------------------------------------------------------------------------- */

export interface PlaceWebOrderInput {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  note?: string;
}

/**
 * POST /api/shop/orders
 *
 * What the storefront's checkout produces. Deliberately a `WebOrder` and not an
 * `Order`: the person may not be a client yet, and nothing has been bought.
 * Staff decide whether it becomes real, and that decision is what mints the
 * client record and the tracking number.
 */
export async function placeWebOrder(
  input: PlaceWebOrderInput,
): Promise<WebOrder> {
  const { cart, storeProducts, webOrders, addWebOrder, clearCart } = state();
  const byId = new Map(storeProducts.map((p) => [p.id, p]));

  const lines = cart.flatMap((line) => {
    const product = byId.get(line.productId);
    if (!product) return [];
    return [
      {
        productId: product.id,
        // Copied, not referenced: a later price change must not rewrite an
        // order the customer already placed.
        name: product.name,
        qty: line.qty,
        priceAfn: product.priceAfn,
      },
    ];
  });

  if (lines.length === 0) throw new Error("Your basket is empty.");

  const at = new Date();
  const seq = nextSequence(
    webOrders.map((o) => o.reference),
    "WEB",
  );

  const order: WebOrder = {
    id: `web-${Date.now()}`,
    reference: `WEB-${at.getUTCFullYear()}-${pad(seq)}`,
    placedAt: at.toISOString(),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerCity: input.customerCity.trim(),
    customerAddress: input.customerAddress?.trim() || undefined,
    note: input.note?.trim() || undefined,
    lines,
    totalAfn: lines.reduce((sum, l) => sum + l.priceAfn * l.qty, 0),
    status: "new",
  };

  addWebOrder(order);
  clearCart();
  notify(
    "web_order",
    `New website order ${order.reference}`,
    `${order.customerName} · ${lines.length} product${lines.length > 1 ? "s" : ""} · ${Math.round(order.totalAfn).toLocaleString()} AFN`,
    `/shop/orders/${order.id}`,
  );
  return delay(order);
}

/** PATCH /api/shop/orders/:id — set aside without converting. */
export async function dismissWebOrder(id: ID): Promise<void> {
  state().updateWebOrder(id, { status: "dismissed" });
  return delay(undefined);
}

export async function deleteWebOrder(id: ID): Promise<void> {
  state().removeWebOrder(id);
  return delay(undefined);
}

/**
 * POST /api/shop/orders/:id/convert
 *
 * The moment a website request becomes real work: it creates the client if we
 * have not met them, then an ordinary `Order` that carries a tracking number
 * and moves through the same status lifecycle as everything else. There is no
 * separate pipeline for web orders — that is the whole point of converting.
 *
 * The client is matched on phone number, digits only, because the same person
 * typing "0700 12 34 56" and "070012 3456" is still the same person.
 */
export async function convertWebOrder(id: ID): Promise<Order> {
  const { webOrders, clients } = state();
  const webOrder = webOrders.find((o) => o.id === id);
  if (!webOrder) throw new Error("That website order no longer exists.");
  if (webOrder.status === "converted") {
    throw new Error(`${webOrder.reference} has already been converted.`);
  }

  const digits = (value: string) => value.replace(/\D/g, "");
  const existing = clients.find(
    (c) => digits(c.phone) === digits(webOrder.customerPhone),
  );

  const client =
    existing ??
    (await createClient({
      name: webOrder.customerName,
      type: "individual",
      phone: webOrder.customerPhone,
      city: webOrder.customerCity,
      address: webOrder.customerAddress,
      preferredContact: "phone",
      notes: `Created from website order ${webOrder.reference}.`,
    }));

  const productById = new Map(state().storeProducts.map((p) => [p.id, p]));

  const order = await createOrder({
    clientId: client.id,
    source: "facebook",
    items: webOrder.lines.map((line) => {
      const product = productById.get(line.productId);
      return {
        name: line.name,
        storeId: product?.storeId ?? state().settings.stores[0]?.id ?? "",
        category: product?.category ?? "other",
        // Carry the photo through, so the customer sees the same picture on the
        // tracking page that they saw when they bought it.
        imageUrl: product?.imageUrls[0],
        qty: line.qty,
        // What the customer agreed to on the website is what we bill.
        unitPriceAfn: line.priceAfn,
        unitCostAfn: product?.costAfn ?? 0,
      };
    }),
    serviceFeeAfn: 0,
    shippingChargedAfn: 0,
    discountAfn: 0,
    notes: webOrder.note
      ? `From website order ${webOrder.reference}. Customer note: ${webOrder.note}`
      : `From website order ${webOrder.reference}.`,
  });

  state().updateWebOrder(id, {
    status: "converted",
    convertedOrderId: order.id,
    trackingNumber: order.trackingNumber,
  });

  return order;
}

/* -------------------------------------------------------------------------- */
/* Clients — POST /api/clients                                                 */
/* -------------------------------------------------------------------------- */

export interface CreateClientInput {
  name: string;
  type: Client["type"];
  phone: string;
  whatsapp?: string;
  email?: string;
  city: string;
  address?: string;
  preferredContact: Client["preferredContact"];
  notes?: string;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { clients, addClient } = state();
  const seq = clients.length + 1;

  const client: Client = {
    id: `client-new-${Date.now()}`,
    code: `AMN-C-${pad(seq)}`,
    status: "active",
    createdAt: now().toISOString(),
    ...input,
  };

  addClient(client);
  return delay(client);
}

/** PATCH /api/clients/:id */
export async function updateClient(
  id: ID,
  patch: Partial<Client>,
): Promise<void> {
  state().updateClient(id, patch);
  return delay(undefined);
}

/**
 * DELETE /api/clients/:id
 *
 * Takes the client's orders with them, and the purchases and payments on those
 * orders. Leaving them behind would strand rows pointing at a client that no
 * longer exists, and the finance screens would keep counting money against
 * nobody. Returns what was removed so the confirmation can say so plainly.
 */
export interface ClientDeletionImpact {
  orders: number;
  purchases: number;
  payments: number;
}

export function clientDeletionImpact(id: ID): ClientDeletionImpact {
  const { orders, purchases, payments } = state();
  const orderIds = new Set(
    orders.filter((o) => o.clientId === id).map((o) => o.id),
  );
  return {
    orders: orderIds.size,
    purchases: purchases.filter((p) => orderIds.has(p.orderId)).length,
    payments: payments.filter((p) => p.clientId === id).length,
  };
}

export async function deleteClient(id: ID): Promise<void> {
  const client = state().clients.find((c) => c.id === id);
  state().removeClient(id);
  if (client) {
    notify("deletion", `Client ${client.name} deleted`, "Removed with their orders, purchases and payments.");
  }
  return delay(undefined);
}

/* -------------------------------------------------------------------------- */
/* Orders — POST /api/orders                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateOrderItemInput {
  name: string;
  productUrl?: string;
  imageUrl?: string;
  storeId: ID;
  category: OrderItem["category"];
  variant?: string;
  qty: number;
  unitPriceAfn: number;
  unitCostAfn: number;
  weightKg?: number;
  notes?: string;
}

export interface CreateOrderInput {
  clientId: ID;
  source: OrderSource;
  items: CreateOrderItemInput[];
  /** Our fee for the job, AFN. Typed in by hand. */
  serviceFeeAfn: number;
  shippingChargedAfn: number;
  discountAfn: number;
  notes?: string;
  /**
   * The number the operator wants to give the client. Optional — when it is
   * left out we mint one. Supplying it is the normal case: the form shows a
   * generated number up front and lets the operator overwrite it.
   */
  trackingNumber?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { orders, addOrder, clients } = state();
  const at = now();
  const seq = nextSequence(
    orders.map((o) => o.orderNo),
    "AS",
  );
  const id = `order-new-${Date.now()}`;
  const client = clients.find((c) => c.id === input.clientId);

  const items: OrderItem[] = input.items.map((item, index) => ({
    ...item,
    id: `${id}-item-${index + 1}`,
  }));

  // A number the operator typed is checked the same way the override is; an
  // unusable one must fail here rather than reach the client on a slip of paper.
  const wanted = input.trackingNumber
    ? normaliseTrackingNumber(input.trackingNumber)
    : undefined;
  if (wanted) {
    if (!isValidTrackingNumber(wanted)) {
      throw new Error(
        "Use letters, numbers and hyphens only — 3 to 32 characters, e.g. AM-2026-0001.",
      );
    }
    if (orders.some((o) => o.trackingNumber === wanted)) {
      throw new Error(`${wanted} is already used by another order.`);
    }
  }

  const order: Order = {
    id,
    orderNo: `AS-${at.getUTCFullYear()}-${pad(seq)}`,
    trackingNumber:
      wanted ??
      generateUniqueTrackingNumber({
        year: at.getUTCFullYear(),
        prefix: state().settings.company.orderPrefix,
        taken: orders.map((o) => o.trackingNumber),
      }),
    clientId: input.clientId,
    status: "requested",
    source: input.source,
    requestedAt: at.toISOString(),
    items,
    serviceFeeAfn: input.serviceFeeAfn,
    shippingChargedAfn: input.shippingChargedAfn,
    discountAfn: input.discountAfn,
    notes: input.notes,
    timeline: [
      event(
        id,
        1,
        "requested",
        "Request received",
        `${client?.name ?? "Client"} sent ${items.length} product link${
          items.length > 1 ? "s" : ""
        } via ${input.source.replace("_", " ")}.`,
      ),
    ],
  };

  addOrder(order);
  notify(
    "order_created",
    `New order ${order.orderNo}`,
    `${client?.name ?? "A client"} · ${items.length} item${items.length > 1 ? "s" : ""} · tracking ${order.trackingNumber}`,
    `/orders/${order.id}`,
  );
  return delay(order);
}

/** PATCH /api/orders/:id/status */
export async function updateOrderStatus(
  id: ID,
  status: OrderStatus,
  note?: string,
): Promise<void> {
  const { orders, updateOrder } = state();
  const order = orders.find((o) => o.id === id);
  if (!order) return delay(undefined);

  const timeline = [
    ...order.timeline,
    event(
      id,
      order.timeline.length + 1,
      status,
      `Status changed to ${status.replace(/_/g, " ")}`,
      note ?? "Updated from the order page.",
    ),
  ];

  updateOrder(id, {
    status,
    timeline,
    deliveredAt:
      status === "delivered" ? now().toISOString() : order.deliveredAt,
  });
  notify(
    "order_status",
    `${order.orderNo} is now ${ORDER_STATUS[status].label}`,
    note ?? `Tracking ${order.trackingNumber}`,
    `/orders/${id}`,
  );
  return delay(undefined);
}

/** PATCH /api/orders/:id */
export async function updateOrder(
  id: ID,
  patch: Partial<Order>,
): Promise<void> {
  state().updateOrder(id, patch);
  return delay(undefined);
}

/**
 * PATCH /api/orders/:id/tracking-number
 *
 * Overriding the generated number is allowed, but it stays the client's only
 * handle on the order, so a malformed or already-used value is refused rather
 * than written. The guard lives here and not in `updateOrder` because that one
 * patches arbitrary fields.
 *
 * Uniqueness is checked against the orders in memory — there is no database to
 * enforce it (SPEC.md §2.2, risk R3).
 */
export async function setOrderTrackingNumber(
  id: ID,
  trackingNumber: string,
): Promise<void> {
  const { orders, updateOrder } = state();
  const value = normaliseTrackingNumber(trackingNumber);

  if (!isValidTrackingNumber(value)) {
    throw new Error(
      "Use letters, numbers and hyphens only — 3 to 32 characters, e.g. AM-2026-0001.",
    );
  }

  const clash = orders.find((o) => o.trackingNumber === value && o.id !== id);
  if (clash) {
    throw new Error(`${value} is already used by order ${clash.orderNo}.`);
  }

  updateOrder(id, { trackingNumber: value });
  return delay(undefined);
}

/**
 * DELETE /api/orders/:id
 *
 * Removes the purchases and payments logged against the order too. A purchase
 * records money paid out *for this order*; keeping it would leave a cost with
 * nothing to attribute it to and quietly distort the P&L.
 */
export interface OrderDeletionImpact {
  purchases: number;
  payments: number;
  paidAfn: number;
}

export function orderDeletionImpact(id: ID): OrderDeletionImpact {
  const { purchases, payments } = state();
  const linked = payments.filter((p) => p.orderId === id);
  return {
    purchases: purchases.filter((p) => p.orderId === id).length,
    payments: linked.length,
    paidAfn: linked.reduce((sum, p) => sum + p.amountAfn, 0),
  };
}

export async function deleteOrder(id: ID): Promise<void> {
  const order = state().orders.find((o) => o.id === id);
  state().removeOrder(id);
  if (order) {
    notify("deletion", `Order ${order.orderNo} deleted`, "Removed with its purchases and payments.");
  }
  return delay(undefined);
}

/** DELETE /api/purchases/:id */
export async function deletePurchase(id: ID): Promise<void> {
  state().removePurchase(id);
  return delay(undefined);
}

/** POST /api/orders/:id/notes */
export async function addOrderNote(id: ID, note: string): Promise<void> {
  const { orders, updateOrder } = state();
  const order = orders.find((o) => o.id === id);
  if (!order) return delay(undefined);

  updateOrder(id, {
    timeline: [
      ...order.timeline,
      event(id, order.timeline.length + 1, "note", "Note added", note),
    ],
  });
  return delay(undefined);
}

/* -------------------------------------------------------------------------- */
/* Purchases — POST /api/purchases                                             */
/* -------------------------------------------------------------------------- */

export interface CreatePurchaseInput {
  orderId: ID;
  orderItemIds: ID[];
  storeId: ID;
  externalOrderNumber: string;
  paymentMethodId: ID;
  /** One figure: everything the store charged, in AFN. */
  totalCostAfn: number;
  status: PurchaseStatus;
  invoiceRef?: string;
  notes?: string;
}

export async function createPurchase(
  input: CreatePurchaseInput,
): Promise<Purchase> {
  const { purchases, addPurchase, orders, updateOrder } = state();
  const at = now();
  const seq = nextSequence(
    purchases.map((p) => p.purchaseNo),
    "PO",
  );

  const purchase: Purchase = {
    id: `purchase-new-${Date.now()}`,
    purchaseNo: `PO-${at.getUTCFullYear()}-${pad(seq)}`,
    purchasedAt: at.toISOString(),
    purchasedBy: actorName(),
    ...input,
  };

  addPurchase(purchase);

  // Placing a purchase moves the order forward, the way it does in the shop.
  const order = orders.find((o) => o.id === input.orderId);
  notify(
    "purchase",
    `Purchase ${purchase.purchaseNo} logged`,
    `${Math.round(purchase.totalCostAfn).toLocaleString()} AFN paid out for ${order?.orderNo ?? "an order"}`,
    "/purchases",
  );
  if (order && ["requested", "quoted", "confirmed", "purchasing"].includes(order.status)) {
    updateOrder(order.id, {
      status: "purchased",
      timeline: [
        ...order.timeline,
        event(
          order.id,
          order.timeline.length + 1,
          "purchase",
          "Purchase placed",
          `Store order ${input.externalOrderNumber} recorded.`,
        ),
      ],
    });
  }

  return delay(purchase);
}

/**
 * Move a purchase along the pipeline. PATCH /api/purchases/:id
 *
 * A purchase was previously frozen at whatever status it was logged with, which
 * left every parcel sitting at "Placed" forever — the pipeline has four real
 * stages and a parcel passes through all of them.
 *
 * Reaching `received` carries the order to `arrived`, the same way logging a
 * purchase already carries it to `purchased`: the goods being with us is the
 * thing that makes an order arrived, and asking an operator to record it twice
 * is how the two drift apart. Orders already delivered, cancelled or refunded
 * are left alone.
 */
export async function updatePurchaseStatus(
  id: ID,
  status: PurchaseStatus,
  note?: string,
): Promise<void> {
  const { purchases, updatePurchase, orders, updateOrder } = state();
  const purchase = purchases.find((p) => p.id === id);
  if (!purchase || purchase.status === status) return delay(undefined);

  updatePurchase(id, { status });

  const order = orders.find((o) => o.id === purchase.orderId);
  if (order) {
    const timeline = [
      ...order.timeline,
      event(
        order.id,
        order.timeline.length + 1,
        "purchase",
        `${purchase.purchaseNo} is now ${PURCHASE_STATUS[status].label.toLowerCase()}`,
        note ?? PURCHASE_STATUS_DESCRIPTION[status],
      ),
    ];

    const carriesOrderToArrived =
      status === "received" &&
      !["arrived", "ready_for_pickup", "delivered", "cancelled", "refunded"].includes(
        order.status,
      );

    updateOrder(order.id, {
      timeline,
      ...(carriesOrderToArrived ? { status: "arrived" as const } : {}),
    });
  }

  notify(
    "purchase",
    `${purchase.purchaseNo} is now ${PURCHASE_STATUS[status].label.toLowerCase()}`,
    note ?? PURCHASE_STATUS_DESCRIPTION[status],
    `/purchases/${id}`,
  );

  return delay(undefined);
}

/* -------------------------------------------------------------------------- */
/* Payments — POST /api/payments                                               */
/* -------------------------------------------------------------------------- */

export interface CreatePaymentInput {
  clientId: ID;
  orderId?: ID;
  amountAfn: number;
  methodId: ID;
  type: PaymentType;
  reference?: string;
  note?: string;
}

export async function createPayment(
  input: CreatePaymentInput,
): Promise<Payment> {
  const { payments, addPayment, orders, updateOrder } = state();
  const at = now();
  const seq = nextSequence(
    payments.map((p) => p.receiptNo),
    "RCT",
  );

  const payment: Payment = {
    id: `payment-new-${Date.now()}`,
    receiptNo: `RCT-${at.getUTCFullYear()}-${pad(seq)}`,
    at: at.toISOString(),
    recordedBy: actorName(),
    ...input,
  };

  addPayment(payment);
  notify(
    "payment",
    `Payment received${payment.orderId ? "" : " (unallocated)"}`,
    `${Math.round(payment.amountAfn).toLocaleString()} AFN · receipt ${payment.receiptNo}`,
    payment.orderId ? `/orders/${payment.orderId}` : "/payments",
  );

  // Log it on the order timeline so the activity tab tells the whole story.
  const order = orders.find((o) => o.id === input.orderId);
  if (order) {
    const revenue = orderRevenue(order);
    const paidAfter =
      [...payments, payment]
        .filter((p) => p.orderId === order.id)
        .reduce((sum, p) => sum + p.amountAfn, 0) ?? 0;

    updateOrder(order.id, {
      timeline: [
        ...order.timeline,
        event(
          order.id,
          order.timeline.length + 1,
          "payment",
          `Payment received`,
          `${input.type} payment recorded. Balance is now ${Math.max(
            0,
            revenue.totalAfn - paidAfter,
          ).toLocaleString()} AFN.`,
          actorName(),
        ),
      ],
    });
  }

  return delay(payment);
}

/* -------------------------------------------------------------------------- */
/* Settings — PATCH /api/settings                                              */
/* -------------------------------------------------------------------------- */

export async function updateCompany(
  patch: Partial<import("@/lib/types").CompanyProfile>,
): Promise<void> {
  const { settings, updateSettings } = state();
  updateSettings({ company: { ...settings.company, ...patch } });
  return delay(undefined);
}

export async function upsertStore(
  store: import("@/lib/types").Store,
): Promise<void> {
  const { settings, updateSettings } = state();
  const exists = settings.stores.some((s) => s.id === store.id);
  updateSettings({
    stores: exists
      ? settings.stores.map((s) => (s.id === store.id ? store : s))
      : [...settings.stores, store],
  });
  return delay(undefined);
}

export async function upsertPaymentMethod(
  method: import("@/lib/types").PaymentMethod,
): Promise<void> {
  const { settings, updateSettings } = state();
  const exists = settings.paymentMethods.some((m) => m.id === method.id);
  updateSettings({
    paymentMethods: exists
      ? settings.paymentMethods.map((m) => (m.id === method.id ? method : m))
      : [...settings.paymentMethods, method],
  });
  return delay(undefined);
}

/**
 * Erase every record and put the settings back to their defaults.
 *
 * Destructive and not undoable — the caller must confirm first. There is no
 * server holding a copy: what is in this browser is the only copy there is.
 */
export async function eraseAllData(): Promise<void> {
  state().reset();
  return delay(undefined);
}
