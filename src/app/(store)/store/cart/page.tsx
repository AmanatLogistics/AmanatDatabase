import type { Metadata } from "next";

import { CartScreen } from "@/features/store/cart-screen";

export const metadata: Metadata = { title: "Your basket" };

export default function CartPage() {
  return <CartScreen />;
}
