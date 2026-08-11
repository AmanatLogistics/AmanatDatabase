import type { Metadata } from "next";

import { TeamSettingsScreen } from "@/features/settings/team-settings-screen";

export const metadata: Metadata = { title: "Team" };

export default function TeamSettingsPage() {
  return <TeamSettingsScreen />;
}
