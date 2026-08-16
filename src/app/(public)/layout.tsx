/**
 * Public route group.
 *
 * No sidebar, no topbar, no command palette — this is the only surface a
 * non-staff member ever sees, so it gets none of the admin chrome. Like the
 * print group it still inherits the root layout (fonts, theme, Toaster);
 * `(app)/layout.tsx` wraps only its own group's children, so `AppShell` never
 * reaches here.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-background min-h-dvh">{children}</div>;
}
