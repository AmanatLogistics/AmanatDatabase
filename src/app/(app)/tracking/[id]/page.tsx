import { ShipmentDetailScreen } from "@/features/tracking/shipment-detail-screen";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShipmentDetailScreen shipmentId={id} />;
}
