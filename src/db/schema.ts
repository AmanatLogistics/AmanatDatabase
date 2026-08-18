/**
 * The database, as tables.
 *
 * This mirrors `src/lib/types.ts` — that file stays the contract the UI reads,
 * and the mapping between the two lives in `src/db/map.ts`. Where the two
 * disagree, the difference is deliberate and commented.
 *
 * Money
 * -----
 * Every `*_afn` column is `integer`: a whole number of Afghani. Never `numeric`
 * or `real` — this business has one currency and no fractions of one, and a
 * float would eventually turn 8,950 into 8,949.999999.
 *
 * Deletes
 * -------
 * The cascades encode the same rules the app already enforced in the browser:
 * a purchase or a payment recorded *against an order* has no meaning without it,
 * so it goes when the order goes. A client takes their orders with them.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enumerations — the same unions the TypeScript types use                     */
/* -------------------------------------------------------------------------- */

export const clientTypeEnum = pgEnum("client_type", ["individual", "business"]);
export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "inactive",
  "blocked",
]);
export const contactChannelEnum = pgEnum("contact_channel", [
  "whatsapp",
  "phone",
  "email",
  "in_person",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "requested",
  "quoted",
  "confirmed",
  "purchasing",
  "purchased",
  "in_transit",
  "arrived",
  "ready_for_pickup",
  "delivered",
  "on_hold",
  "cancelled",
  "refunded",
]);
export const orderSourceEnum = pgEnum("order_source", [
  "whatsapp",
  "phone",
  "walk_in",
  "facebook",
  "referral",
]);
/** An order's timeline carries status changes and three kinds of note. */
export const orderEventKindEnum = pgEnum("order_event_kind", [
  "requested",
  "quoted",
  "confirmed",
  "purchasing",
  "purchased",
  "in_transit",
  "arrived",
  "ready_for_pickup",
  "delivered",
  "on_hold",
  "cancelled",
  "refunded",
  "note",
  "payment",
  "purchase",
]);

export const productCategoryEnum = pgEnum("product_category", [
  "electronics",
  "mobile",
  "computers",
  "beauty",
  "health",
  "baby",
  "fashion",
  "home",
  "auto",
  "other",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "placed",
  "shipped_to_warehouse",
  "received",
  "cancelled",
  "refunded",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "advance",
  "partial",
  "final",
  "refund",
]);
export const paymentMethodKindEnum = pgEnum("payment_method_kind", [
  "cash",
  "bank",
  "mobile_wallet",
  "card",
  "hawala",
]);
export const paymentMethodUseEnum = pgEnum("payment_method_use", [
  "incoming",
  "outgoing",
  "both",
]);

export const webOrderStatusEnum = pgEnum("web_order_status", [
  "new",
  "converted",
  "dismissed",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "web_order",
  "order_created",
  "order_status",
  "payment",
  "purchase",
  "deletion",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "manager",
  "operator",
  "accountant",
]);

/* -------------------------------------------------------------------------- */
/* Staff and sessions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A person who can sign in.
 *
 * `passwordHash` is nullable: the owner invites somebody by creating the row,
 * and the password only exists once that person has set one. A row with no hash
 * cannot sign in.
 */
export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: teamRoleEnum("role").notNull().default("operator"),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("staff_email_unique").on(t.email)],
);

/**
 * A signed-in browser.
 *
 * The row's id is a hash of the cookie's token, never the token itself — a
 * dump of this table must not let anyone sign in as somebody else.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_staff_idx").on(t.staffId)],
);

/* -------------------------------------------------------------------------- */
/* Reference data                                                              */
/* -------------------------------------------------------------------------- */

/** Where we buy from. */
export const stores = pgTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().default(""),
  country: text("country").notNull().default(""),
  leadTimeDays: integer("lead_time_days").notNull().default(14),
  active: boolean("active").notNull().default(true),
});

/** How money moves, in or out. */
export const paymentMethods = pgTable("payment_methods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: paymentMethodKindEnum("kind").notNull(),
  accountRef: text("account_ref"),
  usedFor: paymentMethodUseEnum("used_for").notNull().default("both"),
  active: boolean("active").notNull().default(true),
});

/**
 * The company profile — exactly one row, pinned to id 'company'.
 *
 * A single-row table rather than a key/value bag, so each field keeps its own
 * column and the typechecker knows what is there.
 */
export const companyProfile = pgTable("company_profile", {
  id: text("id").primaryKey().default("company"),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull().default(""),
  tagline: text("tagline").notNull().default(""),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  addressLine1: text("address_line1").notNull().default(""),
  addressLine2: text("address_line2").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  orderPrefix: text("order_prefix").notNull().default("AS"),
  invoiceFooter: text("invoice_footer").notNull().default(""),
  termsAndConditions: text("terms_and_conditions").notNull().default(""),
});

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: clientTypeEnum("type").notNull().default("individual"),
    status: clientStatusEnum("status").notNull().default("active"),
    phone: text("phone").notNull(),
    whatsapp: text("whatsapp"),
    email: text("email"),
    city: text("city").notNull().default(""),
    address: text("address"),
    preferredContact: contactChannelEnum("preferred_contact")
      .notNull()
      .default("phone"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("clients_code_unique").on(t.code),
    index("clients_phone_idx").on(t.phone),
  ],
);

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNo: text("order_no").notNull(),
    /*
     * The number the customer holds. Unique at the database level, which is the
     * guarantee the browser-only version could never make: two operators on two
     * machines could each mint the same one and neither would know.
     */
    trackingNumber: text("tracking_number").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull().default("requested"),
    source: orderSourceEnum("source").notNull().default("whatsapp"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    serviceFeeAfn: integer("service_fee_afn").notNull().default(0),
    shippingChargedAfn: integer("shipping_charged_afn").notNull().default(0),
    freightCostAfn: integer("freight_cost_afn"),
    customsDutyAfn: integer("customs_duty_afn"),
    discountAfn: integer("discount_afn").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("orders_order_no_unique").on(t.orderNo),
    uniqueIndex("orders_tracking_number_unique").on(t.trackingNumber),
    index("orders_client_idx").on(t.clientId),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Keeps the operator's ordering stable. */
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    productUrl: text("product_url"),
    imageUrl: text("image_url"),
    storeId: text("store_id").notNull(),
    category: productCategoryEnum("category").notNull().default("other"),
    variant: text("variant"),
    qty: integer("qty").notNull().default(1),
    unitPriceAfn: integer("unit_price_afn").notNull().default(0),
    unitCostAfn: integer("unit_cost_afn").notNull().default(0),
    /*
     * Grams, not kilograms. The UI asks for kg and may be given "1.4"; storing
     * that as a float would drift, and a parcel is weighed to the gram anyway.
     * The conversion lives in the mapping layer, next to the money conversions.
     */
    weightGrams: integer("weight_grams"),
    notes: text("notes"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: orderEventKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    actor: text("actor").notNull(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/* -------------------------------------------------------------------------- */
/* Purchases                                                                   */
/* -------------------------------------------------------------------------- */

export const purchases = pgTable(
  "purchases",
  {
    id: text("id").primaryKey(),
    purchaseNo: text("purchase_no").notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storeId: text("store_id").notNull(),
    externalOrderNumber: text("external_order_number").notNull().default(""),
    status: purchaseStatusEnum("status").notNull().default("pending"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    purchasedBy: text("purchased_by").notNull().default(""),
    paymentMethodId: text("payment_method_id").notNull(),
    totalCostAfn: integer("total_cost_afn").notNull().default(0),
    invoiceRef: text("invoice_ref"),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("purchases_purchase_no_unique").on(t.purchaseNo),
    index("purchases_order_idx").on(t.orderId),
  ],
);

/**
 * Which lines of the order a purchase covers.
 *
 * This was an array of ids on the purchase. A join table instead, so the
 * database can enforce that every line referenced actually exists — and drop
 * the link by itself when a line is removed from the order.
 */
export const purchaseItems = pgTable(
  "purchase_items",
  {
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.purchaseId, t.orderItemId] })],
);

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    receiptNo: text("receipt_no").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Null for unallocated credit sitting against the client. */
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** Negative for a refund paid back out. */
    amountAfn: integer("amount_afn").notNull(),
    methodId: text("method_id").notNull(),
    type: paymentTypeEnum("type").notNull().default("partial"),
    reference: text("reference"),
    note: text("note"),
    recordedBy: text("recorded_by").notNull().default(""),
  },
  (t) => [
    uniqueIndex("payments_receipt_no_unique").on(t.receiptNo),
    index("payments_client_idx").on(t.clientId),
    index("payments_order_idx").on(t.orderId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Shop                                                                        */
/* -------------------------------------------------------------------------- */

export const storeProducts = pgTable(
  "store_products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: productCategoryEnum("category").notNull().default("other"),
    priceAfn: integer("price_afn").notNull().default(0),
    /** Never leaves the server for a customer. See the storefront query. */
    costAfn: integer("cost_afn").notNull().default(0),
    storeId: text("store_id").notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("store_products_slug_unique").on(t.slug)],
);

/** Photos of a product, best first. `position` 0 is the one cards show. */
export const productImages = pgTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => storeProducts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const webOrders = pgTable(
  "web_orders",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerCity: text("customer_city").notNull().default(""),
    customerAddress: text("customer_address"),
    note: text("note"),
    totalAfn: integer("total_afn").notNull().default(0),
    status: webOrderStatusEnum("status").notNull().default("new"),
    convertedOrderId: text("converted_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("web_orders_reference_unique").on(t.reference),
    index("web_orders_status_idx").on(t.status),
    index("web_orders_phone_idx").on(t.customerPhone),
  ],
);

/**
 * A line of a web order.
 *
 * The name and price are copied at checkout rather than joined, so editing a
 * product later does not rewrite what somebody was quoted. `productId` is kept
 * for reference and goes null if the product is deleted.
 */
export const webOrderLines = pgTable(
  "web_order_lines",
  {
    id: text("id").primaryKey(),
    webOrderId: text("web_order_id")
      .notNull()
      .references(() => webOrders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => storeProducts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    qty: integer("qty").notNull().default(1),
    priceAfn: integer("price_afn").notNull().default(0),
  },
  (t) => [index("web_order_lines_order_idx").on(t.webOrderId)],
);

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Things that happened, for the bell in the top bar.
 *
 * Office-wide rather than per-person: this is a shop where everyone works the
 * same queue, and "who has read it" is not information anyone here needs.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    href: text("href"),
    read: boolean("read").notNull().default(false),
  },
  (t) => [index("notifications_at_idx").on(t.at)],
);

/* -------------------------------------------------------------------------- */
/* Relations — for Drizzle's relational queries                                */
/* -------------------------------------------------------------------------- */

export const clientRelations = relations(clients, ({ many }) => ({
  orders: many(orders),
  payments: many(payments),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, {
    fields: [orders.clientId],
    references: [clients.id],
  }),
  items: many(orderItems),
  timeline: many(orderEvents),
  purchases: many(purchases),
  payments: many(payments),
}));

export const orderItemRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  purchaseLinks: many(purchaseItems),
}));

export const orderEventRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, {
    fields: [orderEvents.orderId],
    references: [orders.id],
  }),
}));

export const purchaseRelations = relations(purchases, ({ one, many }) => ({
  order: one(orders, {
    fields: [purchases.orderId],
    references: [orders.id],
  }),
  items: many(purchaseItems),
}));

export const purchaseItemRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  orderItem: one(orderItems, {
    fields: [purchaseItems.orderItemId],
    references: [orderItems.id],
  }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.id],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const storeProductRelations = relations(storeProducts, ({ many }) => ({
  images: many(productImages),
}));

export const productImageRelations = relations(productImages, ({ one }) => ({
  product: one(storeProducts, {
    fields: [productImages.productId],
    references: [storeProducts.id],
  }),
}));

export const webOrderRelations = relations(webOrders, ({ one, many }) => ({
  lines: many(webOrderLines),
  convertedOrder: one(orders, {
    fields: [webOrders.convertedOrderId],
    references: [orders.id],
  }),
}));

export const webOrderLineRelations = relations(webOrderLines, ({ one }) => ({
  webOrder: one(webOrders, {
    fields: [webOrderLines.webOrderId],
    references: [webOrders.id],
  }),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  staff: one(staff, {
    fields: [sessions.staffId],
    references: [staff.id],
  }),
}));
