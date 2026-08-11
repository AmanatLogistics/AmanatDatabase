import { InvoiceDocument } from "@/features/print/invoice-document";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <InvoiceDocument orderId={orderId} variant="invoice" />;
}
