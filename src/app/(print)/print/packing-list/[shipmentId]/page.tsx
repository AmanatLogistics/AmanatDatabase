import { PackingListDocument } from "@/features/print/packing-list-document";

export default async function PrintPackingListPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  return <PackingListDocument shipmentId={shipmentId} />;
}
