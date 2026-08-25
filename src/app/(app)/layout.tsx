import { AppShell } from "@/components/layout/app-shell";
import { OperationsSeed } from "@/components/shared/operations-seed";
import { SignedInProvider } from "@/components/auth/signed-in";
import { requireStaff } from "@/lib/auth/session";
import { loadOperationsSafely } from "@/lib/server/operations";

/**
 * Operations, behind the door.
 *
 * `requireStaff()` is the check that counts. `proxy.ts` sends a visitor with no
 * cookie to the login page, but it cannot tell a real session from a cookie
 * somebody typed — only this can, because only this asks the database.
 *
 * It reads the operations data here too. This layout was already waiting on the
 * database to check the session, so the rest costs one more query on a
 * connection that is open anyway — and it saves the browser an entire round
 * trip it used to make after hydrating, with placeholders on screen the whole
 * time. A failure is not fatal: `StoreGate` asks again from the browser and
 * shows the reason if that fails too.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const operations = await loadOperationsSafely();

  return (
    <SignedInProvider staff={staff}>
      {operations.ok && (
        <OperationsSeed data={operations.data} now={new Date().toISOString()} />
      )}
      <AppShell>{children}</AppShell>
    </SignedInProvider>
  );
}
