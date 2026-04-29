"use client";

import { useThemeStore } from "@/lib/theme/store";
import { SettingsTemplate } from "@/components/settings/settings-template";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

export default function AppearanceSettingsPage() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <SettingsTemplate title="Appearance" description="Theme, density and accent preferences."
      aside={<Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Preview reflects current theme immediately.</Card>}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm">Theme</p>
          <div className="flex gap-2">
            <Button variant={mode === "dark" ? "primary" : "secondary"} onClick={() => setMode("dark")}>Dark</Button>
            <Button variant={mode === "light" ? "primary" : "secondary"} onClick={() => setMode("light")}>Light</Button>
          </div>
        </div>
        <div><p className="mb-2 text-sm">Density</p><Select className="max-w-xs"><option>Comfortable</option><option>Compact</option></Select></div>
        <div><p className="mb-2 text-sm">Accent</p><Select className="max-w-xs"><option>Lime</option><option>Teal</option><option>Blue</option></Select></div>
      </div>
    </SettingsTemplate>
  );
}

