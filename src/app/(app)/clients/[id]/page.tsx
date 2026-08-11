import { ClientDetailScreen } from "@/features/clients/client-detail-screen";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientDetailScreen clientId={id} />;
}
