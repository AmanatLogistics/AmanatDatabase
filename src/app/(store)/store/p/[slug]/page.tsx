import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailScreen } from "@/features/store/product-detail-screen";
import { getPublishedProduct, listPublishedProducts } from "@/lib/server/shop";

/** The product's own name in the browser tab and in a shared link. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.description.slice(0, 160) || undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  // A real 404 from the server, rather than a page that decides after loading.
  if (!product) notFound();

  const catalogue = await listPublishedProducts();
  const related = catalogue
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 5);

  return <ProductDetailScreen product={product} related={related} />;
}
