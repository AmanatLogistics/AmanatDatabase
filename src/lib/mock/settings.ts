import type {
  CompanyProfile,
  PaymentMethod,
  Settings,
  Store,
  TeamMember,
} from "@/lib/types";

export const company: CompanyProfile = {
  name: "Amanat Shopping",
  legalName: "Amanat Logistics & Trading Ltd.",
  tagline: "We buy it. We ship it. You receive it.",
  phone: "+93 700 12 34 56",
  whatsapp: "+93 700 12 34 56",
  email: "orders@amanatshopping.af",
  website: "amanatshopping.af",
  addressLine1: "Shop 14, Zarnegar Plaza",
  addressLine2: "Shahr-e-Naw, District 4",
  city: "Kabul",
  country: "Afghanistan",
  taxId: "9014-2287",
  invoicePrefix: "INV",
  orderPrefix: "AS",
  defaultServiceFeePercent: 14,
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
    accountRef: "Shop counter",
    active: true,
  },
  {
    id: "pm-azizi",
    name: "Azizi Bank transfer",
    kind: "bank",
    usedFor: "incoming",
    accountRef: "0041 8829 3310",
    active: true,
  },
  {
    id: "pm-aib",
    name: "AIB transfer",
    kind: "bank",
    usedFor: "incoming",
    accountRef: "1120 5567 0092",
    active: true,
  },
  {
    id: "pm-hesabpay",
    name: "HesabPay wallet",
    kind: "mobile_wallet",
    usedFor: "incoming",
    accountRef: "+93 700 12 34 56",
    active: true,
  },
  {
    id: "pm-hawala",
    name: "Hawala (Sarai Shahzada)",
    kind: "hawala",
    usedFor: "outgoing",
    accountRef: "Haji Rafi exchange",
    active: true,
  },
  {
    id: "pm-visa",
    name: "Business Visa card",
    kind: "card",
    usedFor: "outgoing",
    accountRef: "•••• 4417",
    active: true,
  },
];

export const team: TeamMember[] = [
  {
    id: "user-owner",
    name: "Bashir Khan",
    email: "bashir@amanatshopping.af",
    role: "owner",
    phone: "+93 700 12 34 56",
    active: true,
  },
  {
    id: "user-manager",
    name: "Sohaila Nazari",
    email: "sohaila@amanatshopping.af",
    role: "manager",
    phone: "+93 744 88 12 09",
    active: true,
  },
  {
    id: "user-ops",
    name: "Rahim Jan",
    email: "rahim@amanatshopping.af",
    role: "operator",
    phone: "+93 771 40 55 62",
    active: true,
  },
  {
    id: "user-acct",
    name: "Yalda Sediqi",
    email: "yalda@amanatshopping.af",
    role: "accountant",
    phone: "+93 790 23 77 41",
    active: true,
  },
  {
    id: "user-ops2",
    name: "Mustafa Amiri",
    email: "mustafa@amanatshopping.af",
    role: "operator",
    phone: "+93 728 66 30 18",
    active: false,
  },
];

export const settings: Settings = {
  company,
  stores,
  paymentMethods,
  team,
};
