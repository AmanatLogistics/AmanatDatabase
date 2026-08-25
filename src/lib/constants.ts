import type {
  ClientStatus,
  ClientType,
  ContactChannel,
  DocumentKind,
  OrderSource,
  OrderStatus,
  PaymentMethodKind,
  PaymentType,
  ProductCategory,
  PurchaseStatus,
  TeamRole,
} from "@/lib/types";

type BadgeTone =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "teal"
  | "purple"
  | "muted"
  | "brand"
  | "gold";

export interface StatusMeta<T extends string> {
  value: T;
  label: string;
  tone: BadgeTone;
  /** Tailwind class for dots/bars where a badge is too heavy. */
  dot: string;
}

function meta<T extends string>(
  value: T,
  label: string,
  tone: BadgeTone,
  dot: string,
): StatusMeta<T> {
  return { value, label, tone, dot };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

/** The happy path, in order. Drives the order-detail stepper. */
export const ORDER_PIPELINE: OrderStatus[] = [
  "requested",
  "quoted",
  "confirmed",
  "purchasing",
  "purchased",
  "in_transit",
  "arrived",
  "ready_for_pickup",
  "delivered",
];

/**
 * Paused, but not finished. An order can leave `on_hold` again, so it belongs
 * to neither the pipeline nor the terminal set — it gets its own group in the
 * status menu.
 */
export const ORDER_HOLD: OrderStatus[] = ["on_hold"];

export const ORDER_TERMINAL: OrderStatus[] = ["cancelled", "refunded"];

export const ORDER_STATUS: Record<OrderStatus, StatusMeta<OrderStatus>> = {
  requested: meta("requested", "Requested", "muted", "bg-muted-foreground"),
  quoted: meta("quoted", "Quoted", "info", "bg-info"),
  confirmed: meta("confirmed", "Confirmed", "brand", "bg-brand-600"),
  purchasing: meta("purchasing", "Purchasing", "warning", "bg-warning"),
  purchased: meta("purchased", "Purchased", "teal", "bg-teal"),
  in_transit: meta("in_transit", "In transit", "info", "bg-info"),
  arrived: meta("arrived", "Arrived", "purple", "bg-purple"),
  // The one stage that needs the client to act, so it gets the loudest tone.
  ready_for_pickup: meta(
    "ready_for_pickup",
    "Ready for pickup",
    "gold",
    "bg-gold-500",
  ),
  delivered: meta("delivered", "Delivered", "success", "bg-success"),
  on_hold: meta("on_hold", "On hold", "warning", "bg-warning"),
  cancelled: meta("cancelled", "Cancelled", "secondary", "bg-muted-foreground"),
  refunded: meta("refunded", "Refunded", "destructive", "bg-destructive"),
};

/** Statuses that count as real business (excluded: cancelled). */
export const BILLABLE_ORDER_STATUSES: OrderStatus[] = [
  "confirmed",
  "purchasing",
  "purchased",
  "in_transit",
  "arrived",
  "ready_for_pickup",
  "delivered",
  "refunded",
];

/** Statuses where the job is still open on the operations board. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "requested",
  "quoted",
  "on_hold",
  "confirmed",
  "purchasing",
  "purchased",
  "in_transit",
  "arrived",
  "ready_for_pickup",
];

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone call",
  walk_in: "Walk-in",
  facebook: "Facebook",
  referral: "Referral",
};

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  electronics: "Electronics",
  mobile: "Mobile phones",
  computers: "Computers",
  beauty: "Beauty & perfume",
  health: "Health & medical",
  baby: "Baby & kids",
  fashion: "Fashion",
  home: "Home & kitchen",
  auto: "Auto parts",
  other: "Other",
};

/**
 * The order's journey as a customer experiences it.
 *
 * The admin pipeline has nine stages, which is the right grain for staff and far
 * too much for a client — they do not care about the difference between
 * "quoted" and "confirmed". These five are the ones a customer would actually
 * ask about, and every admin status maps onto one of them.
 */
export const CLIENT_PROGRESS_STAGES = [
  { key: "received", label: "Order received" },
  { key: "purchased", label: "Bought from the store" },
  { key: "in_transit", label: "On the way" },
  { key: "at_office", label: "Arrived at our office" },
  { key: "delivered", label: "Delivered" },
] as const;

export type ClientProgressStage = (typeof CLIENT_PROGRESS_STAGES)[number]["key"];

const STAGE_BY_STATUS: Record<OrderStatus, ClientProgressStage | null> = {
  requested: "received",
  quoted: "received",
  confirmed: "received",
  purchasing: "purchased",
  purchased: "purchased",
  in_transit: "in_transit",
  arrived: "at_office",
  ready_for_pickup: "at_office",
  delivered: "delivered",
  // These are not points on the journey — the page says so in words instead.
  on_hold: null,
  cancelled: null,
  refunded: null,
};

/** How far along the customer-facing rail an order is, or null if it is off it. */
export function clientProgressIndex(status: OrderStatus): number | null {
  const stage = STAGE_BY_STATUS[status];
  if (!stage) return null;
  return CLIENT_PROGRESS_STAGES.findIndex((s) => s.key === stage);
}

/** What we tell the customer an order is doing, in their words rather than ours. */
export const CLIENT_STATUS_MESSAGE: Record<OrderStatus, string> = {
  requested: "We have your request and are preparing a price for you.",
  quoted: "We have sent you a price. Confirm and we will buy it.",
  confirmed: "Confirmed. We are buying it from the store now.",
  purchasing: "We are placing the order with the store.",
  purchased: "Bought. We are waiting for the store to ship it.",
  in_transit: "On its way to Kabul.",
  arrived: "It has reached our office. We will call you shortly.",
  ready_for_pickup: "Ready for you to collect from our office.",
  delivered: "Delivered. Thank you for shopping with us.",
  on_hold: "On hold for the moment. We will contact you about it.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
};

/* -------------------------------------------------------------------------- */
/* Purchases                                                                   */
/* -------------------------------------------------------------------------- */

export const PURCHASE_STATUS: Record<
  PurchaseStatus,
  StatusMeta<PurchaseStatus>
> = {
  pending: meta("pending", "Pending", "muted", "bg-muted-foreground"),
  placed: meta("placed", "Placed", "info", "bg-info"),
  shipped_to_warehouse: meta(
    "shipped_to_warehouse",
    "To warehouse",
    "teal",
    "bg-teal",
  ),
  received: meta("received", "Received", "success", "bg-success"),
  cancelled: meta("cancelled", "Cancelled", "secondary", "bg-muted-foreground"),
  refunded: meta("refunded", "Refunded", "destructive", "bg-destructive"),
};

/**
 * What each purchase stage actually means, in the operator's words.
 *
 * "Placed" and "Received" are ambiguous on their own — received by whom, from
 * whom? These sentences are shown next to the choice so the answer never has to
 * be guessed.
 */
/**
 * The order a purchase moves through, when nothing goes wrong.
 *
 * Cancelled and refunded are outcomes, not stages, so they sit outside it — a
 * parcel does not pass through "cancelled" on its way to arriving.
 */
export const PURCHASE_PIPELINE: PurchaseStatus[] = [
  "pending",
  "placed",
  "shipped_to_warehouse",
  "received",
];

/** The two ways a purchase can end without arriving. */
export const PURCHASE_TERMINAL: PurchaseStatus[] = ["cancelled", "refunded"];

export const PURCHASE_STATUS_DESCRIPTION: Record<PurchaseStatus, string> = {
  pending: "Decided to buy it, but the store order is not placed yet.",
  placed: "Ordered from the store. Our money has left.",
  shipped_to_warehouse:
    "The store has shipped it to our forwarder, not to us yet.",
  received: "It has reached us and can go to the client.",
  cancelled: "The store order was cancelled. No money was spent.",
  refunded: "The store refunded us. The money came back.",
};

/* -------------------------------------------------------------------------- */
/* Payments & clients                                                          */
/* -------------------------------------------------------------------------- */

export const PAYMENT_TYPE: Record<PaymentType, StatusMeta<PaymentType>> = {
  advance: meta("advance", "Advance", "gold", "bg-gold-500"),
  partial: meta("partial", "Partial", "warning", "bg-warning"),
  final: meta("final", "Final", "success", "bg-success"),
  refund: meta("refund", "Refund", "destructive", "bg-destructive"),
};

export const PAYMENT_METHOD_KIND_LABEL: Record<PaymentMethodKind, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  mobile_wallet: "Mobile wallet",
  card: "Card",
  hawala: "Hawala",
};

export const CLIENT_STATUS: Record<ClientStatus, StatusMeta<ClientStatus>> = {
  active: meta("active", "Active", "success", "bg-success"),
  inactive: meta("inactive", "Inactive", "muted", "bg-muted-foreground"),
  blocked: meta("blocked", "Blocked", "destructive", "bg-destructive"),
};

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  individual: "Individual",
  business: "Business",
};

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone",
  email: "Email",
  in_person: "In person",
};

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  manager: "Manager",
  operator: "Operator",
  accountant: "Accountant",
};

/**
 * The customer tracking page at /track. On by default, and the point of the
 * public side of this app: a client types their reference and sees where their
 * parcel is.
 *
 * It reads a projection assembled on the server by naming the fields a customer
 * may see, so there is nothing here to leak. Set
 * NEXT_PUBLIC_PUBLIC_TRACKING_ENABLED=false to take the page down.
 */
export const PUBLIC_TRACKING_ENABLED =
  process.env.NEXT_PUBLIC_PUBLIC_TRACKING_ENABLED !== "false";

/**
 * The online shop — the storefront at /store and its admin at /shop. **Off by
 * default.**
 *
 * The business runs on the operations side and the tracking page: staff enter
 * orders, clients look them up. Selling from a catalogue is a separate thing
 * that is not wanted yet, and a half-stocked shop on a public URL is worse than
 * no shop at all.
 *
 * Off means gone rather than hidden: the routes answer 404 and the sidebar link
 * disappears. Nothing is deleted — the screens, the tables and the checkout are
 * all still here. Set NEXT_PUBLIC_SHOP_ENABLED=true to open it again.
 *
 * `/track` is deliberately not covered by this. It serves operations orders too,
 * and is the one public page that matters.
 */
export const SHOP_ENABLED = process.env.NEXT_PUBLIC_SHOP_ENABLED === "true";

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  receipt: "Receipt",
};

export const DOCUMENT_KIND_TONE: Record<DocumentKind, BadgeTone> = {
  invoice: "brand",
  quotation: "info",
  receipt: "success",
};

/**
 * Share of the shipping we charge a client that we expect to pay out in freight
 * once the parcel actually moves — three quarters. Used to estimate margin
 * before the real figure is known.
 *
 * Expressed as a fraction rather than 0.75 so no float enters the money path:
 * every `*Afn` value is a whole number of Afghani, and the only operations
 * allowed on one are integer arithmetic and a `Math.round` at the boundary.
 */
export const FREIGHT_COST_NUMERATOR = 3;
export const FREIGHT_COST_DENOMINATOR = 4;

