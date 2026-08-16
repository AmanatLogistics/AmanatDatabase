import type { Metadata } from "next";

import { ShopProductsScreen } from "@/features/shop/shop-products-screen";

export const metadata: Metadata = { title: "Products" };

export default function ShopProductsPage() {
  return <ShopProductsScreen />;
}
