import { AppShell } from "@/components/layout/app-shell";
import { SignedInProvider } from "@/components/auth/signed-in";
import { requireStaff } from "@/lib/auth/session";

/**
 * Operations, behind the door.
 *
 * `requireStaff()` is the check that counts. `proxy.ts` sends a visitor with no
 * cookie to the login page, but it cannot tell a real session from a cookie
 * somebody typed — only this can, because only this asks the database.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <SignedInProvider staff={staff}>
      <AppShell>{children}</AppShell>
    </SignedInProvider>
  );
}
