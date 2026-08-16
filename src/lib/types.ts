/**
 * Amanat Shopping — domain model.
 *
 * These types are the contract the future backend must satisfy. Everything the UI
 * renders is derived from them; nothing in `src/app` or `src/components` reaches
 * past this file into raw mock data.
 *
 * Money convention
 * ----------------
 * The business runs in Afghani. Every monetary field is named `*Afn` and holds a
 * whole number of AFN — there is no second currency and no exchange rate anywhere
 * in the model. A purchase records what was actually paid out in Afghani.
 */

export type ID = string;

/** ISO-8601 date string, e.g. "2026-07-14T09:12:00.000Z" */
export type ISODate = string;

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

export type ClientType = "individual" | "business";
export type ClientStatus = "active" | "inactive" | "blocked";
export type ContactChannel = "whatsapp" | "phone" | "email" | "in_person";

export interface Client {
  id: ID;
  /** Human-facing reference, e.g. "AMN-C-0042" */
  code: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  phone: string;
  whatsapp?: string;
  email?: string;
  city: string;
  address?: string;
  preferredContact: ContactChannel;
  /** Optional agreed markup for this client; falls back to company default. */
  serviceFeePercent?: number;
  notes?: string;
  createdAt: ISODate;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export type OrderStatus =
  | "requested"
  | "quoted"
  | "confirmed"
  | "purchasing"
  | "purchased"
  | "in_transit"
  | "arrived"
  | "ready_for_pickup"
  | "delivered"
  | "on_hold"
  | "cancelled"
  | "refunded";

export type OrderSource =
  | "whatsapp"
  | "phone"
  | "walk_in"
  | "facebook"
  | "referral";

export type ProductCategory =
  | "electronics"
  | "mobile"
  | "computers"
  | "beauty"
  | "health"
  | "baby"
  | "fashion"
  | "home"
  | "auto"
  | "other";

export interface OrderItem {
  id: ID;
  name: string;
  /** Link the client sent us (Amazon / Daraz / …). */
  productUrl?: string;
  /** Photo the client sent, or the store's image. Empty → branded placeholder. */
  imageUrl?: string;
  storeId: ID;
  category: ProductCategory;
  /** Colour / size / model the client asked for. */
  variant?: string;
  qty: number;
  /** What we charge the client, per unit, in AFN. */
  unitPriceAfn: number;
  /** What we expect to pay the store, per unit, in AFN. */
  unitCostAfn: number;
  weightKg?: number;
  notes?: string;
}

export interface OrderEvent {
  id: ID;
  at: ISODate;
  status: OrderStatus | "note" | "payment" | "purchase" | "shipment";
  title: string;
  description?: string;
  actor: string;
}

export interface Order {
  id: ID;
  /** Internal sequential reference, e.g. "AS-2026-0148". Staff-facing. */
  orderNo: string;
  /**
   * The number the client uses on the public tracking page, e.g.
   * "AS-2026-4F7K2Q". Random, not sequential, so holding one does not let you
   * read another. Unique across orders.
   */
  trackingNumber: string;
  clientId: ID;
  status: OrderStatus;
  source: OrderSource;
  requestedAt: ISODate;
  /** Set when status first reaches `delivered`. */
  deliveredAt?: ISODate;
  items: OrderItem[];
  serviceFeeType: "percent" | "fixed";
  /** Percent (0-100) or a flat AFN amount, per `serviceFeeType`. */
  serviceFeeValue: number;
  /** Shipping we re-bill to the client, AFN. */
  shippingChargedAfn: number;
  /** Goodwill discount, AFN. */
  discountAfn: number;
  notes?: string;
  timeline: OrderEvent[];
}

/* -------------------------------------------------------------------------- */
/* Purchases — what we bought, and where                                       */
/* -------------------------------------------------------------------------- */

export type PurchaseStatus =
  | "pending"
  | "placed"
  | "shipped_to_warehouse"
  | "received"
  | "cancelled"
  | "refunded";

export interface Purchase {
  id: ID;
  /** Human-facing reference, e.g. "PO-2026-0231" */
  purchaseNo: string;
  orderId: ID;
  /** Which lines of the order this purchase covers. */
  orderItemIds: ID[];
  storeId: ID;
  /** The store's own order number, e.g. "114-3941820-7756208". */
  externalOrderNumber: string;
  status: PurchaseStatus;
  purchasedAt: ISODate;
  purchasedBy: string;
  paymentMethodId: ID;
  /** Everything we paid out for this store order, in AFN. */
  totalCostAfn: number;
  invoiceRef?: string;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                   */
/* -------------------------------------------------------------------------- */

export type ShipmentStatus =
  | "label_created"
  | "picked_up"
  | "in_transit"
  | "customs"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface ShipmentEvent {
  id: ID;
  at: ISODate;
  status: ShipmentStatus;
  location: string;
  description: string;
}

export interface Shipment {
  id: ID;
  orderId: ID;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  shippedAt?: ISODate;
  etaAt?: ISODate;
  deliveredAt?: ISODate;
  weightKg: number;
  /** Freight we pay the carrier, AFN. */
  freightCostAfn: number;
  /** Import duty we pay, AFN. */
  customsDutyAfn: number;
  events: ShipmentEvent[];
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

export type PaymentType = "advance" | "partial" | "final" | "refund";

export interface Payment {
  id: ID;
  /** Human-facing reference, e.g. "RCT-2026-0512" */
  receiptNo: string;
  clientId: ID;
  /** Payments are normally applied to one order; unallocated credit has none. */
  orderId?: ID;
  at: ISODate;
  /** AFN. Negative for refunds paid back to the client. */
  amountAfn: number;
  methodId: ID;
  type: PaymentType;
  reference?: string;
  note?: string;
  recordedBy: string;
}

/* -------------------------------------------------------------------------- */
/* Settings / reference data                                                   */
/* -------------------------------------------------------------------------- */

export interface Store {
  id: ID;
  name: string;
  url: string;
  country: string;
  /** Typical lead time in days from purchase to arrival in Kabul. */
  leadTimeDays: number;
  active: boolean;
}

export type PaymentMethodKind =
  | "cash"
  | "bank"
  | "mobile_wallet"
  | "card"
  | "hawala";

export interface PaymentMethod {
  id: ID;
  name: string;
  kind: PaymentMethodKind;
  accountRef?: string;
  /** Which side of the business uses it. */
  usedFor: "incoming" | "outgoing" | "both";
  active: boolean;
}

export type TeamRole = "owner" | "manager" | "operator" | "accountant";

export interface TeamMember {
  id: ID;
  name: string;
  email: string;
  role: TeamRole;
  phone?: string;
  active: boolean;
}

export interface CompanyProfile {
  name: string;
  legalName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  taxId: string;
  /** Prefix used when generating the next invoice number. */
  invoicePrefix: string;
  orderPrefix: string;
  /** Default markup applied to new orders, percent. */
  defaultServiceFeePercent: number;
  /** Reporting currency. The money layer reads this. */
  currency: "AFN";
  invoiceFooter: string;
  termsAndConditions: string;
}

export interface Settings {
  company: CompanyProfile;
  stores: Store[];
  paymentMethods: PaymentMethod[];
  team: TeamMember[];
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export type DocumentKind =
  | "invoice"
  | "quotation"
  | "receipt"
  | "packing_list"
  | "shipping_label";

export interface BusinessDocument {
  id: ID;
  kind: DocumentKind;
  /** Human-facing reference, e.g. "INV-2026-0148". */
  number: string;
  /** Whichever entity the document renders from. */
  orderId?: ID;
  paymentId?: ID;
  shipmentId?: ID;
  clientId: ID;
  issuedAt: ISODate;
  /** AFN total the document shows, for the register view. */
  totalAfn: number;
  /** Route that renders the printable version. */
  href: string;
}
