import type { Metadata } from "next";

import { StoresSettingsScreen } from "@/features/settings/stores-settings-screen";

export const metadata: Metadata = { title: "Stores" };

export default function StoresSettingsPage() {
  return <StoresSettingsScreen />;
}
