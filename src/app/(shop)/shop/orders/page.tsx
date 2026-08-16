import type { Metadata } from "next";

import { WebOrdersScreen } from "@/features/shop/web-orders-screen";

export const metadata: Metadata = { title: "Website orders" };

export default function WebOrdersPage() {
  return <WebOrdersScreen />;
}
