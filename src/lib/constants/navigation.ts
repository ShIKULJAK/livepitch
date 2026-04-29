import { BarChart3, CalendarDays, LayoutDashboard, MapPin, MessageSquare, Settings, ShieldCheck, Star, Trophy, Users, UserSquare2, Workflow } from "lucide-react";

type SettingsNavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

export const appNavigation = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/tournaments", labelKey: "nav.tournaments", icon: Trophy },
  { href: "/matches", labelKey: "nav.matches", icon: ShieldCheck },
  { href: "/teams", labelKey: "nav.teams", icon: Users },
  { href: "/players", labelKey: "nav.players", icon: UserSquare2 },
  { href: "/favorites", labelKey: "nav.favorites", icon: Star },
  { href: "/draws", labelKey: "nav.draws", icon: Workflow },
  { href: "/schedule", labelKey: "nav.schedule", icon: CalendarDays },
  { href: "/standings", labelKey: "nav.standings", icon: BarChart3 },
  { href: "/statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { href: "/venues", labelKey: "nav.venues", icon: MapPin },
  { href: "/messages", labelKey: "nav.messages", icon: MessageSquare },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
] as const;

export const settingsNavigation = [
  { href: "/settings", label: "General" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/roles", label: "Roles & Permissions", adminOnly: true },
  { href: "/settings/billing", label: "Billing", adminOnly: true },
  { href: "/settings/security", label: "Security", adminOnly: true },
  { href: "/settings/integrations", label: "Integrations", adminOnly: true },
  { href: "/settings/privacy", label: "Data & Privacy" },
] as const satisfies readonly SettingsNavItem[];

