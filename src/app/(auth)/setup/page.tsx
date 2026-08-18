import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { needsFirstOwner } from "@/lib/auth/actions";
import { SetupScreen } from "@/features/auth/setup-screen";

export const metadata: Metadata = { title: "Set up" };

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Open only while there is nobody. After that this page does not exist.
  if (!(await needsFirstOwner())) redirect("/login");
  return <SetupScreen />;
}
