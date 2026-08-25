import { notFound } from "next/navigation";

import { ShopShell } from "@/components/layout/shop-shell";
import { SignedInProvider } from "@/components/auth/signed-in";
import { requireStaff } from "@/lib/auth/session";
import { SHOP_ENABLED } from "@/lib/constants";

/**
 * Shop admin route group.
 *
 * A sibling of `(app)`, not a child of it: the storefront admin gets its own
 * shell so it can never inherit the operations navigation, and the two cannot
 * drift into looking like one system. Being a sibling also means it does not
 * inherit that group's session check, so it makes its own.
 */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!SHOP_ENABLED) notFound();

  const staff = await requireStaff();

  return (
    <SignedInProvider staff={staff}>
      <ShopShell>{children}</ShopShell>
    </SignedInProvider>
  );
}
