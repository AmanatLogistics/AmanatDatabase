import type { Metadata } from "next";

import { DocumentsScreen } from "@/features/documents/documents-screen";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentsScreen />;
}
