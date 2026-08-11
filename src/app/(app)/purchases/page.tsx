import type { Metadata } from "next";

import { PurchasesScreen } from "@/features/purchases/purchases-screen";

export const metadata: Metadata = { title: "Purchases" };

export default function PurchasesPage() {
  return <PurchasesScreen />;
}
