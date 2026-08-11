import type { Metadata } from "next";

import { ExpenseCategoriesSettingsScreen } from "@/features/settings/expense-categories-screen";

export const metadata: Metadata = { title: "Expense categories" };

export default function ExpenseCategoriesSettingsPage() {
  return <ExpenseCategoriesSettingsScreen />;
}
