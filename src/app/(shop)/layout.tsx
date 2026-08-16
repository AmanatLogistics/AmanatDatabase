import { ShopShell } from "@/components/layout/shop-shell";

/**
 * Shop admin route group.
 *
 * A sibling of `(app)`, not a child of it: the storefront admin gets its own
 * shell so it can never inherit the operations navigation, and the two cannot
 * drift into looking like one system.
 */
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShopShell>{children}</ShopShell>;
}
