"use client";

import { useDataStore } from "@/lib/store";
import * as server from "@/lib/server/operations";
import { markWebOrderConverted } from "@/lib/server/intake";
import { saveCompany, savePaymentMethod, saveStore } from "@/lib/server/settings";
import { generateUniqueTrackingNumber, isValidTrackingNumber, normaliseTrackingNumber } from "@/lib/tracking";
import type {
  Client,
  CompanyProfile,
  ID,
  Order,
  OrderItem,
  OrderSource,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentType,
  Purchase,
  PurchaseStatus,
  Store,
  WebOrder,
} from "@/lib/types";

/**
 * Write side of the data layer.
 *
 * Every function here calls a server action and then reloads the cache. The
 * bodies used to edit an in-memory store; the store is now a copy of what the
 * server holds, and this is the only thing that writes to it.
 *
 * Reload-everything rather than patch-in-place. A shop's whole dataset is a
 * few hundred rows, and a local copy edited to match what the server *probably*
 * did is a second version of the truth waiting to disagree — usually about the
 * thing the server decided for itself, like the next order number.
 */

/**
 * Pull the whole operations dataset into the cache.
 *
 * Goes through the variant that returns its failure rather than throwing it, so
 * the reason survives the trip to the browser. Next would otherwise replace the
 * message with a digest and React would render its own placeholder in its
 * place, which is how a database that answers in ninety milliseconds spent a
 * day looking unreachable.
 */
export async function refreshOperations(): Promise<void> {
  const result = await server.loadOperationsSafely();
  if (!result.ok) throw new Error(result.message);
  const data = result.data;
  useDataStore.setState({
    /*
     * The real date, every time data arrives.
     *
     * `today` starts as a fixed reference so the server and the first client
     * render agree, and it was only ever replaced by the store's rehydration
     * callback — which the admin never triggers, because `startHydration()` is
     * called by the storefront and the tracking page and nothing else. So the
     * whole operations side believed it was permanently the 1st of January,
     * and every figure filtered by period — revenue this month, profit, orders
     * this month, the six-month chart — measured a month with nothing in it
     * while the order sat plainly in the list.
     *
     * Setting it here ties the date to the data rather than to browser storage:
     * it is right on first load and right again after every write, which is
     * also what makes the figures move when you enter something.
     */
    today: new Date(),
    loadedAt: Date.now(),
    clients: data.clients,
    orders: data.orders,
    purchases: data.purchases,
    payments: data.payments,
    settings: data.settings,
  });
}

function state() {
  return useDataStore.getState();
}

/* -------------------------------------------------------------------------- */
/* The basket — the one thing that is genuinely the visitor's own              */
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
/* Clients                                                                     */
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
  const client = await server.createClient({ ...input, status: "active" });
  await refreshOperations();
  return client;
}

export async function updateClient(
  id: ID,
  patch: Partial<Client>,
): Promise<void> {
  await server.updateClient(id, patch);
  await refreshOperations();
}

export interface ClientDeletionImpact {
  orders: number;
  purchases: number;
  payments: number;
}

/** What deleting this client would take with it. Read from the cache. */
export function clientDeletionImpact(id: ID): ClientDeletionImpact {
  const { orders, purchases, payments } = state();
  const theirs = new Set(orders.filter((o) => o.clientId === id).map((o) => o.id));
  return {
    orders: theirs.size,
    purchases: purchases.filter((p) => theirs.has(p.orderId)).length,
    payments: payments.filter((p) => p.clientId === id).length,
  };
}

export async function deleteClient(id: ID): Promise<void> {
  await server.deleteClient(id);
  await refreshOperations();
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
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
  /** Typed by hand, or minted here when left blank. */
  trackingNumber?: string;
  items: CreateOrderItemInput[];
  serviceFeeAfn: number;
  shippingChargedAfn: number;
  discountAfn: number;
  notes?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const taken = new Set(state().orders.map((o) => o.trackingNumber));

  let trackingNumber: string;
  if (input.trackingNumber?.trim()) {
    trackingNumber = normaliseTrackingNumber(input.trackingNumber);
    if (!isValidTrackingNumber(trackingNumber)) {
      throw new Error(
        "A tracking number needs at least three characters: letters, numbers and dashes.",
      );
    }
    if (taken.has(trackingNumber)) {
      throw new Error(`${trackingNumber} is already used by another order.`);
    }
  } else {
    trackingNumber = generateUniqueTrackingNumber({
      taken,
      year: new Date().getUTCFullYear(),
      prefix: state().settings.company.orderPrefix,
    });
  }

  const order = await server.createOrder({ ...input, trackingNumber });
  await refreshOperations();
  return order;
}

export async function updateOrderStatus(
  id: ID,
  status: OrderStatus,
  note?: string,
): Promise<void> {
  await server.setOrderStatus(id, status, note);
  await refreshOperations();
}

export async function updateOrder(
  id: ID,
  patch: Partial<Order>,
): Promise<void> {
  await server.updateOrder(id, patch);
  await refreshOperations();
}

export async function setOrderTrackingNumber(
  id: ID,
  raw: string,
): Promise<void> {
  const trackingNumber = normaliseTrackingNumber(raw);
  if (!isValidTrackingNumber(trackingNumber)) {
    throw new Error(
      "A tracking number needs at least three characters: letters, numbers and dashes.",
    );
  }
  await server.setOrderTrackingNumber(id, trackingNumber);
  await refreshOperations();
}

export interface OrderDeletionImpact {
  purchases: number;
  payments: number;
  /** How much money is attached, so the warning can name an amount. */
  paidAfn: number;
}

export function orderDeletionImpact(id: ID): OrderDeletionImpact {
  const { purchases, payments } = state();
  const theirs = payments.filter((p) => p.orderId === id);
  return {
    purchases: purchases.filter((p) => p.orderId === id).length,
    payments: theirs.length,
    paidAfn: theirs.reduce((sum, p) => sum + p.amountAfn, 0),
  };
}

export async function deleteOrder(id: ID): Promise<void> {
  await server.deleteOrder(id);
  await refreshOperations();
}

export async function addOrderNote(id: ID, note: string): Promise<void> {
  await server.addOrderNote(id, note);
  await refreshOperations();
}

/* -------------------------------------------------------------------------- */
/* Purchases                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreatePurchaseInput {
  orderId: ID;
  orderItemIds: ID[];
  storeId: ID;
  externalOrderNumber: string;
  status: PurchaseStatus;
  paymentMethodId: ID;
  totalCostAfn: number;
  invoiceRef?: string;
  notes?: string;
}

export async function createPurchase(
  input: CreatePurchaseInput,
): Promise<Purchase> {
  const purchase = await server.createPurchase(input);
  await refreshOperations();
  return purchase;
}

export async function updatePurchaseStatus(
  id: ID,
  status: PurchaseStatus,
  note?: string,
): Promise<void> {
  await server.setPurchaseStatus(id, status, note);
  await refreshOperations();
}

export async function deletePurchase(id: ID): Promise<void> {
  await server.deletePurchase(id);
  await refreshOperations();
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
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
  const payment = await server.createPayment(input);
  await refreshOperations();
  return payment;
}

/* -------------------------------------------------------------------------- */
/* Website orders                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Turn a website order into a real one.
 *
 * The only place the two systems meet. It finds the customer by phone or
 * creates them, mints a tracking number, and marks the website order converted
 * — all of which now happens on the server, so the customer tracking their
 * `WEB-…` reference follows through to the real order and sees its progress.
 */
export async function convertWebOrder(order: WebOrder): Promise<Order> {
  const digits = (value: string) => value.replace(/\D/g, "").slice(-9);
  const existing = state().clients.find(
    (c) => digits(c.phone) === digits(order.customerPhone),
  );

  const client =
    existing ??
    (await createClient({
      name: order.customerName,
      type: "individual",
      phone: order.customerPhone,
      city: order.customerCity,
      address: order.customerAddress,
      preferredContact: "phone",
      notes: `Created from website order ${order.reference}.`,
    }));

  const created = await createOrder({
    clientId: client.id,
    source: "facebook",
    items: order.lines.map((line) => ({
      name: line.name,
      storeId: state().settings.stores[0]?.id ?? "",
      category: "other" as const,
      qty: line.qty,
      unitPriceAfn: line.priceAfn,
      // What we will pay is not known until somebody buys it.
      unitCostAfn: 0,
    })),
    serviceFeeAfn: 0,
    shippingChargedAfn: 0,
    discountAfn: 0,
    notes: order.note
      ? `From website order ${order.reference}. ${order.note}`
      : `From website order ${order.reference}.`,
  });

  await markWebOrderConverted(order.id, created.id);
  return created;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateCompany(
  patch: Partial<CompanyProfile>,
): Promise<void> {
  await saveCompany(patch);
  await refreshOperations();
}

/**
 * Erase every record and put the settings back to their defaults.
 *
 * Destructive, not undoable, and now genuinely shared — this empties the
 * database every member of staff reads, not one browser. The caller confirms
 * first.
 */
export async function eraseAllData(): Promise<void> {
  await server.eraseEverything();
  await refreshOperations();
}

export async function upsertStore(store: Store): Promise<void> {
  await saveStore(store);
  await refreshOperations();
}

export async function upsertPaymentMethod(method: PaymentMethod): Promise<void> {
  await savePaymentMethod(method);
  await refreshOperations();
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export {
  clearNotifications,
  markNotificationsRead,
} from "@/lib/server/intake";
