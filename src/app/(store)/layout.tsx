import { StorefrontShell } from "@/features/store/storefront-shell";
import { listPublishedProducts } from "@/lib/server/shop";

/**
 * Storefront route group.
 *
 * A customer surface, so it inherits none of the admin chrome — same reasoning
 * as `(public)`. Kept separate from `(public)` because the shop has its own
 * header, basket and navigation, where the tracking page has none.
 *
 * The published catalogue is fetched once here and handed to the shell, which
 * seeds it for the basket to read. It carries no cost prices: `PublicProduct`
 * has them stripped at the server boundary, so they are not in the page a
 * customer receives.
 */
/**
 * Rendered per request, for the whole group.
 *
 * The catalogue comes from the database, so there is nothing to prerender at
 * build time — where there are deliberately no credentials, and the build fails
 * trying. Caching it for a period was the alternative and is worse here:
 * publishing a product and not seeing it on the shop for a minute reads as the
 * publish having failed.
 */
export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const catalogue = await listPublishedProducts();

  return <StorefrontShell catalogue={catalogue}>{children}</StorefrontShell>;
}
