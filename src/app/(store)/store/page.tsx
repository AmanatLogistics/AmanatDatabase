import type { Metadata } from "next";

import { StorefrontScreen } from "@/features/store/storefront-screen";

export const metadata: Metadata = {
  title: "Shop",
  description: "Order from Amanat Shopping and collect in Kabul.",
};

export default function StorePage() {
  return <StorefrontScreen />;
}
