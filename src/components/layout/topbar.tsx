"use client";

import { Bell, Check, Goal, MessageSquare, Search, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-competitions";
import { formatDateTimeStable } from "@/lib/utils/date";
import { appNavigation } from "@/lib/constants/navigation";

type SearchResult = {
  id: string;
  type: "COMPETITION" | "TEAM" | "MATCH" | "PLAYER" | "VENUE";
  title: string;
  subtitle: string;
  link: string;
};

export function Topbar() {
  const { locale, setLocale, t } = useI18n();
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const notificationsQuery = useNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!searchWrapperRef.current) return;
      if (!searchWrapperRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = (await response.json()) as { data?: SearchResult[] };
        if (!cancelled) {
          setSearchResults(Array.isArray(json.data) ? json.data : []);
          setSearchOpen(true);
          setActiveIndex(-1);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
          setSearchOpen(true);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  function formatWhen(value: string) {
    return formatDateTimeStable(value);
  }

  function typeLabel(type: SearchResult["type"]) {
    if (type === "COMPETITION") return "Competition";
    if (type === "TEAM") return "Team";
    if (type === "MATCH") return "Match";
    if (type === "PLAYER") return "Player";
    return "Venue";
  }

  function openResult(link: string) {
    window.open(link, "_blank", "noopener,noreferrer");
    setSearchOpen(false);
  }

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const localeLabels =
    locale === "bs"
      ? {
          home: "Početna",
          details: "Detalji",
          create: "Kreiraj",
          edit: "Uredi",
          tournaments: "Takmičenja",
          matches: "Utakmice",
          teams: "Timovi",
          players: "Igrači",
          favorites: "Favoriti",
          teamApplications: "Prijavi ekipu",
          draws: "Izvlačenje",
          schedule: "Raspored",
          standings: "Tabela",
          statistics: "Statistika",
          venues: "Lokacije i tereni",
          messages: "Poruke",
          notifications: "Obavještenja",
          settings: "Podešavanja",
          appearance: "Izgled",
          billing: "Naplata",
          integrations: "Integracije",
          roles: "Uloge i dozvole",
          security: "Sigurnost",
          privacy: "Privatnost",
        }
      : {
          home: "Home",
          details: "Details",
          create: "Create",
          edit: "Edit",
          tournaments: "Competitions",
          matches: "Matches",
          teams: "Teams",
          players: "Players",
          favorites: "Favorites",
          teamApplications: "Apply Team",
          draws: "Draws",
          schedule: "Schedule",
          standings: "Standings",
          statistics: "Statistics",
          venues: "Venues & Pitches",
          messages: "Messages",
          notifications: "Notifications",
          settings: "Settings",
          appearance: "Appearance",
          billing: "Billing",
          integrations: "Integrations",
          roles: "Roles & Permissions",
          security: "Security",
          privacy: "Privacy",
        };

  const segmentLabelMap: Record<string, string> = {
    dashboard: t("nav.dashboard"),
    tournaments: localeLabels.tournaments,
    matches: localeLabels.matches,
    teams: localeLabels.teams,
    players: localeLabels.players,
    favorites: localeLabels.favorites,
    "prijavi-ekipu": localeLabels.teamApplications,
    draws: localeLabels.draws,
    schedule: localeLabels.schedule,
    standings: localeLabels.standings,
    statistics: localeLabels.statistics,
    venues: localeLabels.venues,
    messages: localeLabels.messages,
    notifications: localeLabels.notifications,
    settings: localeLabels.settings,
    appearance: localeLabels.appearance,
    billing: localeLabels.billing,
    integrations: localeLabels.integrations,
    roles: localeLabels.roles,
    security: localeLabels.security,
    privacy: localeLabels.privacy,
  };

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const navItem = appNavigation.find((item) => item.href === href);

    let label: string;
    if (navItem) {
      label = t(navItem.labelKey);
    } else if (segmentLabelMap[segment]) {
      label = segmentLabelMap[segment];
    } else if (segment === "create") {
      label = localeLabels.create;
    } else if (segment === "edit") {
      label = localeLabels.edit;
    } else if (/^[a-z0-9]{12,}$/i.test(segment)) {
      label = localeLabels.details;
    } else {
      label = decodeURIComponent(segment)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    return { href, label };
  });

  return (
    <header className="sticky top-0 z-30 border-b px-4 py-3 backdrop-blur lg:px-6" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb,var(--bg) 85%, transparent)" }}>
      <div className="flex items-center gap-3">
        <div className="relative hidden w-full max-w-md md:block" ref={searchWrapperRef}>
          <label htmlFor="topbar-search" className="sr-only">
            Search tournaments, teams and matches
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
          <Input
            id="topbar-search"
            className="pl-9"
            placeholder={t("topbar.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.currentTarget.value);
              setSearchOpen(event.currentTarget.value.trim().length >= 2);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (!searchOpen) return;
              if (event.key === "Escape") {
                setSearchOpen(false);
                setActiveIndex(-1);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => Math.min(current + 1, searchResults.length - 1));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
                return;
              }
              if (event.key === "Enter" && activeIndex >= 0 && searchResults[activeIndex]) {
                event.preventDefault();
                openResult(searchResults[activeIndex].link);
              }
            }}
          />
          {searchOpen ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-xl border p-1 shadow-xl"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
            >
              {searchLoading ? (
                <p className="px-3 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Pretraga...
                </p>
              ) : searchResults.length ? (
                <div className="max-h-80 overflow-y-auto lp-scrollbar">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left"
                      style={{
                        backgroundColor:
                          index === activeIndex ? "color-mix(in srgb,var(--primary) 16%, transparent)" : "transparent",
                      }}
                      onClick={() => openResult(result.link)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{result.title}</p>
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                          {typeLabel(result.type)}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {result.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Nema rezultata za pretragu
                </p>
              )}
            </div>
          ) : null}
        </div>
        <div className="relative ml-auto" ref={dropdownRef}>
          <button
            className="relative rounded-xl border p-2"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
            aria-label="Open notifications"
            onClick={() => setOpen((current) => !current)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span
                className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                style={{ backgroundColor: "var(--danger)", color: "white" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          {open ? (
            <div
              className="absolute right-0 z-50 mt-2 w-[360px] rounded-2xl border p-2 shadow-xl"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
            >
              <div className="mb-2 flex items-center justify-between px-2 py-1">
                <p className="font-semibold">Notifications</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markAllNotificationsRead.mutate()}
                  disabled={markAllNotificationsRead.isPending || unreadCount === 0}
                >
                  Mark all as read
                </Button>
              </div>
              <div className="max-h-96 space-y-1 overflow-y-auto px-1 pb-1 lp-scrollbar">
                {notificationsQuery.data?.notifications.length ? (
                  notificationsQuery.data.notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className="w-full rounded-xl border p-3 text-left"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: notification.isRead
                          ? "var(--surface-1)"
                          : "color-mix(in srgb, var(--primary) 10%, var(--surface-2))",
                      }}
                      onClick={async () => {
                        if (!notification.isRead) {
                          try {
                            await markNotificationRead.mutateAsync(notification.id);
                          } catch {
                            // Keep navigation responsive even if mark-read fails.
                          }
                        }
                        setOpen(false);
                        router.push(notification.link);
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {notification.type === "MESSAGE_RECEIVED" ? (
                            <MessageSquare className="h-4 w-4" />
                          ) : notification.type === "FAVORITE_MATCH_GOAL" ? (
                            <Goal className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          <p className="text-sm font-semibold">{notification.title}</p>
                        </div>
                        {!notification.isRead ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} /> : null}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {notification.body}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {formatWhen(notification.createdAt)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                    No notifications yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <Select
          aria-label="Language"
          value={locale}
          onChange={(event) => setLocale(event.currentTarget.value as "bs" | "en")}
          className="h-10 w-20 text-xs"
        >
          <option value="bs">BS</option>
          <option value="en">EN</option>
        </Select>
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}>
          <UserRound className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <div className="hidden md:block">
            <p className="text-xs leading-none">{user?.name ?? "Guest"}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{user?.role ?? "-"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.location.assign("/logout")}>
          {t("common.logout")}
        </Button>
      </div>
      <nav className="mt-3 flex items-center gap-2 overflow-x-auto text-xs lp-scrollbar" aria-label="Breadcrumb">
        <Link href="/dashboard" className="shrink-0 hover:underline" style={{ color: "var(--text-secondary)" }}>
          {localeLabels.home}
        </Link>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <div key={crumb.href} className="flex items-center gap-2">
              <span style={{ color: "var(--text-secondary)" }}>/</span>
              {isLast ? (
                <span className="shrink-0 font-medium text-white">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="shrink-0 hover:underline" style={{ color: "var(--text-secondary)" }}>
                  {crumb.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </header>
  );
}

