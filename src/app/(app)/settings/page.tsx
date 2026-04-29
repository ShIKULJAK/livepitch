"use client";

import Link from "next/link";
import { SettingsTemplate } from "@/components/settings/settings-template";
import { Card } from "@/components/ui/card";
import { settingsNavigation } from "@/lib/constants/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdmin } from "@/lib/permissions";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useCurrentUser();
  const visibleItems = settingsNavigation.filter(
    (item) => item.href !== "/settings" && (!("adminOnly" in item) || !item.adminOnly || isAdmin(user?.role))
  );

  return (
    <SettingsTemplate title={t("settings.title")} description={t("settings.description")}
      aside={
        <>
          <Card className="p-4"><p className="font-semibold">Organization</p><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>FC Champion • Pro Plan</p></Card>
          <Card className="p-4"><p className="font-semibold">Security</p><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>2FA enabled • No issues</p></Card>
        </>
      }
    >
      <h2 className="text-xl font-semibold">{t("settings.hubTitle")}</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{t("settings.hubDescription")}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border p-4 text-sm font-medium" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            {item.label}
          </Link>
        ))}
      </div>
    </SettingsTemplate>
  );
}
