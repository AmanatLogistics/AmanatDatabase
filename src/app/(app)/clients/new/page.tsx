import type { Metadata } from "next";

import { NewClientScreen } from "@/features/clients/new-client-screen";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return <NewClientScreen />;
}
