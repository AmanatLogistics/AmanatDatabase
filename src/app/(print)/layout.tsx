import { requireStaff } from "@/lib/auth/session";

/**
 * Print route group.
 *
 * No sidebar, no topbar — just a white A4 sheet centred on a neutral backdrop,
 * with a small toolbar that disappears when the page is actually printed
 * (`.no-print` is handled by the @media print block in globals.css).
 */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // An invoice carries a client's name, address and what they owe. Staff only.
  await requireStaff();

  return (
    <div className="bg-neutral-100 min-h-dvh py-6 print:bg-white print:py-0 dark:bg-neutral-900">
      {children}
    </div>
  );
}
