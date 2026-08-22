import type {
  CompanyProfile,
  PaymentMethod,
  Settings,
  Store,
  TeamMember,
} from "@/lib/types";

/**
 * Reference data the app starts with.
 *
 * Not records — settings. The company profile, the shops we buy from, the ways
 * money moves and who is on the team. All of it is editable in Settings; this is
 * only what is there before anyone has edited anything.
 *
 * The account numbers and staff that used to live here were invented for the
 * demo and have been removed. Fill in the real ones in Settings.
 */
export const company: CompanyProfile = {
  name: "Amanat Shopping",
  legalName: "Amanat Logistics & Trading Ltd.",
  tagline: "We buy it. We ship it. You receive it.",
  /*
   * Blank on purpose. The numbers that used to sit here were invented for the
   * demo, and this profile is what a customer sees on the tracking page and on
   * every printed invoice — a placeholder phone number reaching nobody is worse
   * than an empty line. Fill them in at Settings -> Company.
   */
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "Kandahar",
  country: "Afghanistan",
  taxId: "",
  invoicePrefix: "INV",
  orderPrefix: "AS",
  currency: "AFN",
  invoiceFooter:
    "Thank you for shopping with Amanat. Goods remain the property of Amanat Shopping until paid in full.",
  termsAndConditions:
    "50% advance is required before we place an order abroad. Delivery estimates are indicative and depend on customs clearance. Electronics carry the manufacturer warranty only; returns are accepted within 3 days of handover for damaged goods.",
};

export const stores: Store[] = [
  {
    id: "store-amazon-us",
    name: "Amazon US",
    url: "https://www.amazon.com",
    country: "United States",
    leadTimeDays: 21,
    active: true,
  },
  {
    id: "store-amazon-ae",
    name: "Amazon UAE",
    url: "https://www.amazon.ae",
    country: "United Arab Emirates",
    leadTimeDays: 12,
    active: true,
  },
  {
    id: "store-daraz-pk",
    name: "Daraz PK",
    url: "https://www.daraz.pk",
    country: "Pakistan",
    leadTimeDays: 9,
    active: true,
  },
  {
    id: "store-noon",
    name: "Noon",
    url: "https://www.noon.com",
    country: "United Arab Emirates",
    leadTimeDays: 14,
    active: true,
  },
  {
    id: "store-aliexpress",
    name: "AliExpress",
    url: "https://www.aliexpress.com",
    country: "China",
    leadTimeDays: 28,
    active: true,
  },
  {
    id: "store-ebay",
    name: "eBay",
    url: "https://www.ebay.com",
    country: "United States",
    leadTimeDays: 25,
    active: false,
  },
];

export const paymentMethods: PaymentMethod[] = [
  {
    id: "pm-cash",
    name: "Cash (AFN)",
    kind: "cash",
    usedFor: "both",
    active: true,
  },
  {
    id: "pm-bank",
    name: "Bank transfer",
    kind: "bank",
    usedFor: "incoming",
    active: true,
  },
  {
    id: "pm-wallet",
    name: "Mobile wallet",
    kind: "mobile_wallet",
    usedFor: "incoming",
    active: true,
  },
  {
    id: "pm-hawala",
    name: "Hawala",
    kind: "hawala",
    usedFor: "outgoing",
    active: true,
  },
  {
    id: "pm-card",
    name: "Business card",
    kind: "card",
    usedFor: "outgoing",
    active: true,
  },
];

/**
 * One row, so the app has an author for the events it records and somebody to
 * show in the sidebar. Add the rest of the staff in Settings -> Team.
 */
export const team: TeamMember[] = [
  {
    id: "user-owner",
    name: "Bashir Khan",
    email: "owner@amanatshopping.af",
    role: "owner",
    active: true,
  },
];

export const settings: Settings = {
  company,
  stores,
  paymentMethods,
  team,
};
