import type { Metadata } from "next";

import { ShopProductsScreen } from "@/features/shop/shop-products-screen";
import { listProducts } from "@/lib/server/catalogue";

export const metadata: Metadata = { title: "Products" };

export default async function ShopProductsPage() {
  const products = await listProducts();
  return <ShopProductsScreen products={products} />;
}
