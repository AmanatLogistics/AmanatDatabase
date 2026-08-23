import { notFound } from "next/navigation";

import { WebOrderDetailScreen } from "@/features/shop/web-order-detail-screen";
import { getWebOrder } from "@/lib/server/intake";

export default async function WebOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getWebOrder(id);
  if (!order) notFound();

  return <WebOrderDetailScreen order={order} />;
}
