"use client";

import { orderRevenue } from "@/lib/finance";
import { useDataStore } from "@/lib/store";
import {
  generateUniqueTrackingNumber,
  isValidTrackingNumber,
} from "@/lib/tracking";
import type {
  Client,
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
  Shipment,
  ShipmentStatus,
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
  actor = "Rahim Jan",
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
  serviceFeePercent?: number;
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

/* -------------------------------------------------------------------------- */
/* Orders — POST /api/orders                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateOrderItemInput {
  name: string;
  productUrl?: string;
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
  serviceFeeType: Order["serviceFeeType"];
  serviceFeeValue: number;
  shippingChargedAfn: number;
  discountAfn: number;
  notes?: string;
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

  const order: Order = {
    id,
    orderNo: `AS-${at.getUTCFullYear()}-${pad(seq)}`,
    trackingNumber: generateUniqueTrackingNumber(
      at.getUTCFullYear(),
      orders.map((o) => o.trackingNumber),
    ),
    clientId: input.clientId,
    status: "requested",
    source: input.source,
    requestedAt: at.toISOString(),
    items,
    serviceFeeType: input.serviceFeeType,
    serviceFeeValue: input.serviceFeeValue,
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
  const value = trackingNumber.trim().toUpperCase();

  if (!isValidTrackingNumber(value)) {
    throw new Error(
      "A tracking number looks like AS-2026-4F7K2Q — the letters I, L, O and U are not used.",
    );
  }

  const clash = orders.find((o) => o.trackingNumber === value && o.id !== id);
  if (clash) {
    throw new Error(`${value} is already used by order ${clash.orderNo}.`);
  }

  updateOrder(id, { trackingNumber: value });
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
    purchasedBy: "Rahim Jan",
    ...input,
  };

  addPurchase(purchase);

  // Placing a purchase moves the order forward, the way it does in the shop.
  const order = orders.find((o) => o.id === input.orderId);
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

/* -------------------------------------------------------------------------- */
/* Shipments — POST /api/shipments                                             */
/* -------------------------------------------------------------------------- */

export interface CreateShipmentInput {
  orderId: ID;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  origin: string;
  destination: string;
  etaAt?: string;
  weightKg: number;
  freightCostAfn: number;
  customsDutyAfn: number;
}

export async function createShipment(
  input: CreateShipmentInput,
): Promise<Shipment> {
  const { addShipment, orders, updateOrder } = state();
  const at = now();

  const shipment: Shipment = {
    id: `shipment-new-${Date.now()}`,
    status: "label_created",
    shippedAt: at.toISOString(),
    events: [
      {
        id: `shipment-evt-${Date.now()}`,
        at: at.toISOString(),
        status: "label_created",
        location: input.origin,
        description: "Shipping label created by the forwarder.",
      },
    ],
    ...input,
  };

  addShipment(shipment);

  const order = orders.find((o) => o.id === input.orderId);
  if (order && ["purchased", "purchasing", "confirmed"].includes(order.status)) {
    updateOrder(order.id, {
      status: "in_transit",
      timeline: [
        ...order.timeline,
        event(
          order.id,
          order.timeline.length + 1,
          "shipment",
          "Shipment booked",
          `${input.carrier} · ${input.trackingNumber}`,
        ),
      ],
    });
  }

  return delay(shipment);
}

/** PATCH /api/shipments/:id/status */
export async function updateShipmentStatus(
  id: ID,
  status: ShipmentStatus,
  location: string,
  description: string,
): Promise<void> {
  const { shipments, updateShipment } = state();
  const shipment = shipments.find((s) => s.id === id);
  if (!shipment) return delay(undefined);

  const at = now().toISOString();
  updateShipment(id, {
    status,
    deliveredAt: status === "delivered" ? at : shipment.deliveredAt,
    events: [
      ...shipment.events,
      {
        id: `${id}-evt-${shipment.events.length + 1}`,
        at,
        status,
        location,
        description,
      },
    ],
  });
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
    recordedBy: "Yalda Sediqi",
    ...input,
  };

  addPayment(payment);

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
          "Yalda Sediqi",
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

/** Restores the seeded demo dataset. */
export async function resetDemoData(): Promise<void> {
  state().reset();
  return delay(undefined);
}
