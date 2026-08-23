import type { Metadata } from "next";

import { ShopOverviewScreen } from "@/features/shop/shop-overview-screen";
import { listProducts } from "@/lib/server/catalogue";
import { listWebOrders } from "@/lib/server/intake";

export const metadata: Metadata = { title: "Shop overview" };

export default async function ShopPage() {
  const [products, webOrders] = await Promise.all([
    listProducts(),
    listWebOrders(),
  ]);
  return <ShopOverviewScreen products={products} webOrders={webOrders} />;
}
