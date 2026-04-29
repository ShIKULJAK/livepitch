import { SettingsTemplate } from "@/components/settings/settings-template";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SecuritySettingsPage() {
  return (
    <SettingsTemplate title="Security" description="Manage account security settings and active sessions."
      aside={<Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Security status: Strong. 2FA enabled.</Card>}
    >
      <div className="space-y-3">
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Two-Factor Authentication</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Extra layer enabled</p></div><Button>Manage 2FA</Button></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Password</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Last changed Mar 18, 2024</p></div><Button>Change Password</Button></div></Card>
        <Card className="p-4"><p className="font-semibold">Active Sessions</p><div className="mt-2 space-y-2 text-sm"><div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>Windows • Chrome • This device</div><div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>iPhone • Safari • Revoke</div></div></Card>
      </div>
    </SettingsTemplate>
  );
}

