"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsNavigation } from "@/lib/constants/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdmin } from "@/lib/permissions";
import { useI18n } from "@/lib/i18n";

export function SettingsSideNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { t } = useI18n();

  const visibleItems = settingsNavigation.filter((item) => !("adminOnly" in item) || !item.adminOnly || isAdmin(user?.role));

  return (
    <div className="rounded-[20px] border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}>
      <p className="px-2 pb-2 text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{t("settings.menu")}</p>
      <nav className="space-y-1">
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2 text-sm" style={active ? { backgroundColor: "color-mix(in srgb,var(--primary) 12%, transparent)", color: "var(--primary)" } : { color: "var(--text-secondary)" }} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

