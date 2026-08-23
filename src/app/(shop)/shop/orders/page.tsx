import type { Metadata } from "next";

import { WebOrdersScreen } from "@/features/shop/web-orders-screen";
import { listWebOrders } from "@/lib/server/intake";

export const metadata: Metadata = { title: "Website orders" };

export default async function WebOrdersPage() {
  const orders = await listWebOrders();
  return <WebOrdersScreen orders={orders} />;
}
