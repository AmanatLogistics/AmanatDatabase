import { StorefrontShell } from "@/features/store/storefront-shell";

/**
 * Storefront route group.
 *
 * A customer surface, so it inherits none of the admin chrome — same reasoning
 * as `(public)`. Kept separate from `(public)` because the shop has its own
 * header, basket and navigation, where the tracking page has none.
 */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
