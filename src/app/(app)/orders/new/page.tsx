import type { Metadata } from "next";

import { NewOrderScreen } from "@/features/orders/new-order-screen";

export const metadata: Metadata = { title: "New order" };

export default function NewOrderPage() {
  return <NewOrderScreen />;
}
