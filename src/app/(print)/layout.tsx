import { OperationsSeed } from "@/components/shared/operations-seed";
import { StoreGate } from "@/components/shared/store-gate";
import { requireStaff } from "@/lib/auth/session";
import { loadOperationsSafely } from "@/lib/server/operations";

/**
 * Print route group.
 *
 * No sidebar, no topbar — just a white A4 sheet centred on a neutral backdrop,
 * with a small toolbar that disappears when the page is actually printed
 * (`.no-print` is handled by the @media print block in globals.css).
 *
 * It seeds the data, and gates on it.
 *
 * The documents are client components that look their order or payment up in
 * the store and call `notFound()` when it is not there. Every other group fills
 * that store; this one did not — so a print URL opened directly, which is the
 * only way anybody opens one, found an empty store and answered 404. Printing
 * did not work at all, and nothing caught it because no test covered these
 * routes.
 *
 * Seeding alone was not enough. The seed and the document are separate
 * subtrees, and nothing promises the seed renders first — so the document could
 * still ask an empty store, call `notFound()`, and set a 404 on a response
 * whose body had the invoice in it. `StoreGate` is the component that already
 * knows how to wait for this data, so the document is not rendered until there
 * is something to look up, and "not found" once again means the order is
 * genuinely not there.
 */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // An invoice carries a client's name, address and what they owe. Staff only.
  await requireStaff();
  const operations = await loadOperationsSafely();

  return (
    <div className="bg-neutral-100 min-h-dvh py-6 print:bg-white print:py-0 dark:bg-neutral-900">
      {operations.ok && (
        <OperationsSeed data={operations.data} now={new Date().toISOString()} />
      )}
      <StoreGate>{children}</StoreGate>
    </div>
  );
}
