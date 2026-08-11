import type { Metadata } from "next";

import { ExpensesScreen } from "@/features/finance/expenses-screen";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return <ExpensesScreen />;
}
