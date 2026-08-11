import type { Metadata } from "next";

import { FinanceScreen } from "@/features/finance/finance-screen";

export const metadata: Metadata = { title: "Finance & accounting" };

export default function FinancePage() {
  return <FinanceScreen />;
}
