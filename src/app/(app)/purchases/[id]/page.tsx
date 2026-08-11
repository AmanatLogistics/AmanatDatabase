import { PurchaseDetailScreen } from "@/features/purchases/purchase-detail-screen";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseDetailScreen purchaseId={id} />;
}
