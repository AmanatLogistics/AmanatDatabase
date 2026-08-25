import type { Metadata } from "next";

import { ShopOverviewScreen } from "@/features/shop/shop-overview-screen";
import { listProducts } from "@/lib/server/catalogue";
import { listWebOrders } from "@/lib/server/intake";

export const metadata: Metadata = { title: "Shop overview" };

export default async function ShopPage() {
  // Sequential, like every other read — see the note in
  // `src/lib/server/operations.ts`. Two at once against a transaction
  // pooler is the thing that stopped pages loading.
  const products = await listProducts();
  const webOrders = await listWebOrders();
  return <ShopOverviewScreen products={products} webOrders={webOrders} />;
}
