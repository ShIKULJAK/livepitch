import { SettingsTemplate } from "@/components/settings/settings-template";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const rows = ["Match Started", "Match Result", "Match Updates", "Tournament Announcements", "Registration & Invitations", "Security Alerts"];

export default function NotificationSettingsPage() {
  return (
    <SettingsTemplate title="Notifications" description="Choose how and when you want to be notified."
      aside={<Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Quiet hours from 22:00 to 07:00 enabled.</Card>}
    >
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <p className="text-sm">{row}</p>
            <div className="flex gap-4 text-sm" style={{ color: "var(--text-secondary)" }}><label><input type="checkbox" defaultChecked /> In-app</label><label><input type="checkbox" defaultChecked /> Email</label></div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2 max-w-sm">
          <Input type="time" defaultValue="22:00" />
          <Input type="time" defaultValue="07:00" />
        </div>
      </div>
    </SettingsTemplate>
  );
}

