import { Suspense } from "react";
import type { Metadata } from "next";

import { StorefrontScreen } from "@/features/store/storefront-screen";

export const metadata: Metadata = {
  title: "Shop",
  description: "Order from Amanat Shopping and collect in Kabul.",
};

/**
 * `StorefrontScreen` reads `?category=` to open on a category, which Next
 * requires a Suspense boundary for. The fallback is empty on purpose: the
 * screen renders its own skeletons the moment it mounts.
 */
export default function StorePage() {
  return (
    <Suspense>
      <StorefrontScreen />
    </Suspense>
  );
}
