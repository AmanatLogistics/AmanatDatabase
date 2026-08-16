import type { Metadata } from "next";

import { ShopOverviewScreen } from "@/features/shop/shop-overview-screen";

export const metadata: Metadata = { title: "Shop overview" };

export default function ShopPage() {
  return <ShopOverviewScreen />;
}
