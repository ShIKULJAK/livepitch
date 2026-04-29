"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { BrandLogo } from "@/components/navigation/brand-logo";
import { useI18n } from "@/lib/i18n";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden h-screen w-[250px] shrink-0 border-r p-4 lg:flex lg:flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }} aria-label="Primary sidebar">
      <BrandLogo />
      <nav className="mt-6 space-y-1" aria-label="Main navigation">
        {appNavigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active && "font-medium")}
              style={active ? { backgroundColor: "color-mix(in srgb,var(--primary) 12%, transparent)", color: "var(--primary)" } : { color: "var(--text-secondary)" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
        <p className="text-sm font-semibold">Upgrade to Pro</p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Unlock advanced stats, automation and premium support.</p>
      </div>
    </aside>
  );
}

