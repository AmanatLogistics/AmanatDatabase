import type { Metadata } from "next";

import { CompanySettingsScreen } from "@/features/settings/company-settings-screen";

export const metadata: Metadata = { title: "Company profile" };

export default function SettingsPage() {
  return <CompanySettingsScreen />;
}
