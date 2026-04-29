import { PageHeader } from "@/components/layout/page-header";
import { SettingsSideNav } from "@/components/settings/settings-side-nav";
import { Card } from "@/components/ui/card";

export function SettingsTemplate({ title, description, children, aside }: { title: string; description: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 xl:grid-cols-[250px_1fr_320px]">
        <SettingsSideNav />
        <Card className="p-5">{children}</Card>
        <div className="space-y-4">{aside}</div>
      </div>
    </div>
  );
}

