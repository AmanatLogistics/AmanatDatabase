import { WebOrderDetailScreen } from "@/features/shop/web-order-detail-screen";

export default async function WebOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WebOrderDetailScreen webOrderId={id} />;
}
