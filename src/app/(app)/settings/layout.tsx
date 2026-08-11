import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/features/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details and the reference data every other screen reads from."
      />
      <div className="grid gap-6 lg:grid-cols-[210px_1fr]">
        <SettingsNav />
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </>
  );
}
