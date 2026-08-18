/**
 * The way in.
 *
 * No sidebar, no top bar, nothing to click but the form — everything the app
 * chrome offers needs a session, and rendering it around a login page invites
 * people to try. Deliberately unlike both admin shells.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground mt-8 text-center text-xs">
        Amanat Shopping · Kabul
      </p>
    </div>
  );
}
