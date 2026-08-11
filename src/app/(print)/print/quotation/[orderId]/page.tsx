import { InvoiceDocument } from "@/features/print/invoice-document";

export default async function PrintQuotationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <InvoiceDocument orderId={orderId} variant="quotation" />;
}
