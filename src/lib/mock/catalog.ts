import type { ProductCategory } from "@/lib/types";

/**
 * The products Amanat actually moves. `costAfn` is what the store order lands at
 * in Afghani; the client price is derived from it at order-build time using the
 * service fee, exactly the way the team quotes in real life.
 */
export interface CatalogProduct {
  name: string;
  category: ProductCategory;
  storeId: string;
  costAfn: number;
  weightKg: number;
  variants?: string[];
  /** Path segment used to build a believable product URL. */
  slug: string;
}

export const catalog: CatalogProduct[] = [
  // Mobile
  {
    name: "Apple iPhone 15 Pro 256GB",
    category: "mobile",
    storeId: "store-amazon-us",
    costAfn: 69950,
    weightKg: 0.4,
    variants: ["Natural Titanium", "Blue Titanium", "Black Titanium"],
    slug: "apple-iphone-15-pro-256gb",
  },
  {
    name: "Samsung Galaxy A55 5G 128GB",
    category: "mobile",
    storeId: "store-daraz-pk",
    costAfn: 20950,
    weightKg: 0.35,
    variants: ["Awesome Navy", "Awesome Lilac"],
    slug: "samsung-galaxy-a55-5g",
  },
  {
    name: "Xiaomi Redmi Note 13 Pro",
    category: "mobile",
    storeId: "store-daraz-pk",
    costAfn: 13950,
    weightKg: 0.33,
    variants: ["Midnight Black", "Ocean Teal"],
    slug: "xiaomi-redmi-note-13-pro",
  },
  {
    name: "Google Pixel 8a 128GB",
    category: "mobile",
    storeId: "store-amazon-us",
    costAfn: 31450,
    weightKg: 0.34,
    variants: ["Obsidian", "Bay"],
    slug: "google-pixel-8a",
  },

  // Computers
  {
    name: 'Apple MacBook Air 13" M3 256GB',
    category: "computers",
    storeId: "store-amazon-us",
    costAfn: 76950,
    weightKg: 1.6,
    variants: ["Midnight", "Starlight", "Space Grey"],
    slug: "apple-macbook-air-13-m3",
  },
  {
    name: "Dell Latitude 5450 i7 16GB",
    category: "computers",
    storeId: "store-amazon-us",
    costAfn: 59450,
    weightKg: 2.1,
    slug: "dell-latitude-5450",
  },
  {
    name: "Logitech MX Master 3S",
    category: "computers",
    storeId: "store-amazon-us",
    costAfn: 6950,
    weightKg: 0.3,
    variants: ["Graphite", "Pale Grey"],
    slug: "logitech-mx-master-3s",
  },
  {
    name: "HP LaserJet Pro M404dn",
    category: "computers",
    storeId: "store-amazon-ae",
    costAfn: 13950,
    weightKg: 8.5,
    slug: "hp-laserjet-pro-m404dn",
  },
  {
    name: "Wireless keyboard & mouse combo",
    category: "computers",
    storeId: "store-daraz-pk",
    costAfn: 3150,
    weightKg: 0.9,
    slug: "wireless-keyboard-mouse-combo",
  },

  // Electronics
  {
    name: "Apple AirPods Pro (2nd generation)",
    category: "electronics",
    storeId: "store-amazon-us",
    costAfn: 13950,
    weightKg: 0.15,
    slug: "apple-airpods-pro-2",
  },
  {
    name: "Apple Watch SE 44mm GPS",
    category: "electronics",
    storeId: "store-amazon-ae",
    costAfn: 17450,
    weightKg: 0.2,
    variants: ["Midnight", "Starlight"],
    slug: "apple-watch-se-44mm",
  },
  {
    name: "Anker PowerCore 20000 PD",
    category: "electronics",
    storeId: "store-amazon-us",
    costAfn: 3450,
    weightKg: 0.45,
    slug: "anker-powercore-20000-pd",
  },
  {
    name: "JBL Flip 6 Bluetooth speaker",
    category: "electronics",
    storeId: "store-noon",
    costAfn: 6950,
    weightKg: 0.6,
    variants: ["Black", "Blue", "Teal"],
    slug: "jbl-flip-6",
  },
  {
    name: "Canon EOS R50 + 18-45mm kit",
    category: "electronics",
    storeId: "store-amazon-ae",
    costAfn: 47550,
    weightKg: 1.2,
    slug: "canon-eos-r50-kit",
  },
  {
    name: 'Samsung 43" Crystal UHD Smart TV',
    category: "electronics",
    storeId: "store-noon",
    costAfn: 24450,
    weightKg: 9.8,
    slug: "samsung-43-crystal-uhd",
  },
  {
    name: "Fitbit Charge 6",
    category: "electronics",
    storeId: "store-amazon-us",
    costAfn: 11150,
    weightKg: 0.12,
    variants: ["Obsidian", "Porcelain"],
    slug: "fitbit-charge-6",
  },
  {
    name: "Kindle Paperwhite 16GB",
    category: "electronics",
    storeId: "store-amazon-us",
    costAfn: 10450,
    weightKg: 0.25,
    slug: "kindle-paperwhite-16gb",
  },

  // Health
  {
    name: "Omron M3 blood pressure monitor",
    category: "health",
    storeId: "store-amazon-us",
    costAfn: 4150,
    weightKg: 0.6,
    slug: "omron-m3-bp-monitor",
  },
  {
    name: "Accu-Chek Instant glucose meter",
    category: "health",
    storeId: "store-daraz-pk",
    costAfn: 2750,
    weightKg: 0.3,
    slug: "accu-chek-instant",
  },
  {
    name: "Philips compressor nebuliser",
    category: "health",
    storeId: "store-daraz-pk",
    costAfn: 3150,
    weightKg: 1.4,
    slug: "philips-compressor-nebuliser",
  },
  {
    name: "Vitamin D3 5000 IU (360 softgels)",
    category: "health",
    storeId: "store-amazon-us",
    costAfn: 1950,
    weightKg: 0.4,
    slug: "vitamin-d3-5000iu",
  },

  // Baby
  {
    name: "Aptamil Pronutra 2 formula (6 tins)",
    category: "baby",
    storeId: "store-amazon-ae",
    costAfn: 9250,
    weightKg: 5.4,
    slug: "aptamil-pronutra-2-6pack",
  },
  {
    name: "Pampers Baby-Dry mega pack size 4",
    category: "baby",
    storeId: "store-noon",
    costAfn: 2950,
    weightKg: 4.2,
    slug: "pampers-baby-dry-size-4",
  },
  {
    name: "Chicco Ohlalà 3 stroller",
    category: "baby",
    storeId: "store-amazon-ae",
    costAfn: 13250,
    weightKg: 6.5,
    variants: ["Black Night", "Stone"],
    slug: "chicco-ohlala-3-stroller",
  },
  {
    name: "LEGO Technic Ferrari Daytona",
    category: "baby",
    storeId: "store-amazon-us",
    costAfn: 6250,
    weightKg: 1.8,
    slug: "lego-technic-ferrari-daytona",
  },

  // Beauty
  {
    name: "Dior Sauvage EDP 100ml",
    category: "beauty",
    storeId: "store-amazon-ae",
    costAfn: 9450,
    weightKg: 0.5,
    slug: "dior-sauvage-edp-100ml",
  },
  {
    name: "Chanel Coco Mademoiselle EDP 100ml",
    category: "beauty",
    storeId: "store-noon",
    costAfn: 11550,
    weightKg: 0.5,
    slug: "chanel-coco-mademoiselle-100ml",
  },
  {
    name: "The Ordinary skincare set (6 pcs)",
    category: "beauty",
    storeId: "store-amazon-us",
    costAfn: 4750,
    weightKg: 0.8,
    slug: "the-ordinary-skincare-set",
  },
  {
    name: "Dyson Supersonic hair dryer",
    category: "beauty",
    storeId: "store-amazon-ae",
    costAfn: 30050,
    weightKg: 1.6,
    variants: ["Iron/Fuchsia", "Nickel/Copper"],
    slug: "dyson-supersonic-hair-dryer",
  },

  // Fashion
  {
    name: "Nike Air Force 1 '07",
    category: "fashion",
    storeId: "store-amazon-us",
    costAfn: 8050,
    weightKg: 1.1,
    variants: ["US 9 White", "US 10 White", "US 11 Black"],
    slug: "nike-air-force-1-07",
  },
  {
    name: "Adidas Ultraboost 22",
    category: "fashion",
    storeId: "store-amazon-us",
    costAfn: 10150,
    weightKg: 1.0,
    variants: ["US 9", "US 10", "US 11"],
    slug: "adidas-ultraboost-22",
  },
  {
    name: "Levi's 501 Original jeans (3 pairs)",
    category: "fashion",
    storeId: "store-amazon-us",
    costAfn: 10300,
    weightKg: 2.2,
    variants: ["32x32", "34x32", "36x34"],
    slug: "levis-501-original-3pack",
  },
  {
    name: "Casio G-Shock GA-2100",
    category: "fashion",
    storeId: "store-amazon-us",
    costAfn: 6950,
    weightKg: 0.25,
    variants: ["Black", "White"],
    slug: "casio-g-shock-ga-2100",
  },

  // Home
  {
    name: "Nespresso Vertuo Next machine",
    category: "home",
    storeId: "store-amazon-ae",
    costAfn: 12550,
    weightKg: 4.0,
    slug: "nespresso-vertuo-next",
  },
  {
    name: "Philips Airfryer XXL HD9650",
    category: "home",
    storeId: "store-noon",
    costAfn: 15350,
    weightKg: 7.5,
    slug: "philips-airfryer-xxl-hd9650",
  },
  {
    name: "400W solar panel kit with controller",
    category: "home",
    storeId: "store-aliexpress",
    costAfn: 20250,
    weightKg: 18.0,
    slug: "400w-solar-panel-kit",
  },
  {
    name: "Bosch GSR 12V cordless drill",
    category: "home",
    storeId: "store-amazon-us",
    costAfn: 9050,
    weightKg: 2.4,
    slug: "bosch-gsr-12v-drill",
  },
  {
    name: "Ergonomic gaming chair",
    category: "home",
    storeId: "store-noon",
    costAfn: 12550,
    weightKg: 19.0,
    variants: ["Black/Red", "Black/Grey"],
    slug: "ergonomic-gaming-chair",
  },

  // Auto
  {
    name: "Toyota Corolla front brake pads (set)",
    category: "auto",
    storeId: "store-aliexpress",
    costAfn: 5450,
    weightKg: 3.5,
    slug: "toyota-corolla-brake-pads",
  },
  {
    name: "4K dashcam with night vision",
    category: "auto",
    storeId: "store-aliexpress",
    costAfn: 6250,
    weightKg: 0.5,
    slug: "4k-dashcam-night-vision",
  },
  {
    name: "H4 LED headlight conversion kit",
    category: "auto",
    storeId: "store-daraz-pk",
    costAfn: 3850,
    weightKg: 0.8,
    slug: "h4-led-headlight-kit",
  },
];

const storeDomain: Record<string, string> = {
  "store-amazon-us": "https://www.amazon.com/dp",
  "store-amazon-ae": "https://www.amazon.ae/dp",
  "store-daraz-pk": "https://www.daraz.pk/products",
  "store-noon": "https://www.noon.com/uae-en",
  "store-aliexpress": "https://www.aliexpress.com/item",
  "store-ebay": "https://www.ebay.com/itm",
};

/** Believable product link of the kind a client pastes into WhatsApp. */
export function productUrl(product: CatalogProduct, ref: string): string {
  const base = storeDomain[product.storeId] ?? "https://example.com";
  return `${base}/${product.slug}-${ref}`;
}
