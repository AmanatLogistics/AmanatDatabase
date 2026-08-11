import { ReceiptDocument } from "@/features/print/receipt-document";

export default async function PrintReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  return <ReceiptDocument paymentId={paymentId} />;
}
