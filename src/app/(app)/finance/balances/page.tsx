import type { Metadata } from "next";

import { BalancesScreen } from "@/features/finance/balances-screen";

export const metadata: Metadata = { title: "Client balances" };

export default function BalancesPage() {
  return <BalancesScreen />;
}
