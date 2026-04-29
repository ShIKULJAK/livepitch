import { SettingsTemplate } from "@/components/settings/settings-template";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PrivacySettingsPage() {
  return (
    <SettingsTemplate title="Data & Privacy" description="Control data usage, exports and account deletion."
      aside={<Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>We never sell personal data. Export requests processed in 48h.</Card>}
    >
      <div className="space-y-3">
        <Card className="p-4"><p className="font-semibold">Privacy Overview</p><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Manage profile visibility, data collection and sharing preferences.</p></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Request Data Export</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Download account, teams and tournament data.</p></div><Button>Request Export</Button></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Delete Account</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Permanent action. This cannot be undone.</p></div><Button variant="danger">Delete Account</Button></div></Card>
      </div>
    </SettingsTemplate>
  );
}

