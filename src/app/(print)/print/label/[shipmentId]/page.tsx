import { LabelDocument } from "@/features/print/label-document";

export default async function PrintLabelPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  return <LabelDocument shipmentId={shipmentId} />;
}
