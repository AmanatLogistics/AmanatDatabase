import { Suspense } from "react";
import type { Metadata } from "next";

import { StorefrontScreen } from "@/features/store/storefront-screen";
import { listPublishedProducts } from "@/lib/server/shop";

export const metadata: Metadata = {
  title: "Shop",
  description: "Order from Amanat Shopping and collect from our office.",
};

/**
 * Rendered per request, from the database.
 *
 * The catalogue used to come out of the visitor's own browser storage, which
 * meant a customer saw whatever the shop looked like on the machine that
 * created it — usually nothing at all. Products are now in the HTML the server
 * sends: no loading flash, and a search engine can read them.
 *
 * `StorefrontScreen` reads `?category=`, which Next requires a Suspense
 * boundary for.
 */
export default async function StorePage() {
  const products = await listPublishedProducts();

  return (
    <Suspense>
      <StorefrontScreen products={products} />
    </Suspense>
  );
}
