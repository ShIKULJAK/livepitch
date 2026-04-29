"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavigation } from "@/lib/constants/navigation";
import { useI18n } from "@/lib/i18n";

const mobileItems = appNavigation.slice(0, 5);

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t p-2 lg:hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }} aria-label="Mobile navigation">
      {mobileItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="flex flex-col items-center rounded-lg py-2 text-[11px]" style={active ? { color: "var(--primary)" } : { color: "var(--text-secondary)" }} aria-current={active ? "page" : undefined}>
            <Icon className="mb-1 h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

