import { ProductDetailScreen } from "@/features/store/product-detail-screen";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductDetailScreen slug={slug} />;
}
