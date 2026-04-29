import { SettingsTemplate } from "@/components/settings/settings-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const integrations = [
  ["Google Calendar", "Connected"],
  ["Slack", "Connected"],
  ["Mailchimp", "Not Connected"],
  ["Zapier", "Not Connected"],
  ["Stripe", "Connected"],
  ["API Access", "Connected"],
];

export default function IntegrationsSettingsPage() {
  return (
    <SettingsTemplate title="Integrations" description="Connect Live Pitch with your favorite tools and services."
      aside={<Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>3 connected • 4 not connected • 25+ available</Card>}
    >
      <div className="space-y-2">
        {integrations.map((row) => (
          <div key={row[0]} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <p className="font-medium">{row[0]}</p>
            <div className="flex items-center gap-2">
              <Badge variant={row[1] === "Connected" ? "active" : "inactive"}>{row[1]}</Badge>
              <Button>{row[1] === "Connected" ? "Manage" : "Connect"}</Button>
            </div>
          </div>
        ))}
      </div>
    </SettingsTemplate>
  );
}

