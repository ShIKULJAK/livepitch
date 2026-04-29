"use client";

import Link from "next/link";
import { useDashboardSnapshot, useMatches, usePlayers, useStandings } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/charts/donut-chart";
import { useI18n } from "@/lib/i18n";
import { canManageTournaments } from "@/lib/permissions";
import { formatDateTimeDDMMYYYY } from "@/lib/utils/date";

export default function DashboardPage() {
  const { t } = useI18n();
  const { user } = useCurrentUser();
  const dashboardQuery = useDashboardSnapshot();
  const matchesQuery = useMatches();
  const playersQuery = usePlayers();
  const standingsQuery = useStandings();

  const snapshot = dashboardQuery.data;
  const matches = matchesQuery.data ?? [];
  const players = playersQuery.data ?? [];
  const standings = standingsQuery.data?.rows ?? [];

  const activities = matches.slice(0, 4).map((match) => {
    if (match.status === "LIVE" && match.homeScore !== null && match.awayScore !== null) {
      return `${match.homeTeam} ${match.homeScore}:${match.awayScore} ${match.awayTeam} (${match.liveMinute ?? 0}')`;
    }
    return `${match.homeTeam} vs ${match.awayTeam} - ${match.status.toLowerCase()}`;
  });

  const topScorers = players.slice(0, 5);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          canManageTournaments(user?.role) ? (
            <Link href="/tournaments/create">
              <Button variant="primary">{t("tournaments.create")}</Button>
            </Link>
          ) : undefined
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("dashboard.activeCompetitions")} value={String(snapshot?.activeCompetitions ?? 0)} change={dashboardQuery.isLoading ? t("common.loading") : "Live from database"} trend="up" />
        <StatCard title={t("dashboard.totalTeams")} value={String(snapshot?.totalTeams ?? 0)} change="Synced" trend="up" />
        <StatCard title={t("dashboard.matchesToday")} value={String(snapshot?.matchesToday ?? 0)} change={`Live: ${snapshot?.liveMatches ?? 0}`} trend="up" />
        <StatCard title={t("dashboard.totalPlayers")} value={String(snapshot?.totalPlayers ?? 0)} change="Synced" trend="up" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("dashboard.upcomingMatches")} className="xl:col-span-2" action={<Link href="/matches" className="text-sm" style={{ color: "var(--primary)" }}>{t("dashboard.viewAll")}</Link>}>
          <div className="space-y-2">
            {matches.slice(0, 4).map((match) => (
              <div key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <div>
                  <p className="font-medium">{match.homeTeam} vs {match.awayTeam}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatDateTimeDDMMYYYY(match.scheduledAt)} • {match.venue}</p>
                </div>
                <Badge variant={match.status === "LIVE" ? "live" : match.status === "FINISHED" ? "completed" : "upcoming"}>{match.status.toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t("dashboard.activityFeed")}>
          <ul className="space-y-3">
            {activities.map((item) => (
              <li key={item} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>{item}</li>
            ))}
          </ul>
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("dashboard.standingsPreview")} className="xl:col-span-2">
          <div className="space-y-2">
            {standings.slice(0, 5).map((row) => (
              <div key={row.team} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{row.position}</span>
                <span>{row.team}</span>
                <span className="font-semibold" style={{ color: "var(--primary)" }}>{row.points} pts</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t("dashboard.topScorers")}>
          <div className="space-y-3">
            {topScorers.map((player, idx) => (
              <div key={player.id} className="flex items-center justify-between text-sm">
                <p>{idx + 1}. {player.fullName}</p>
                <p className="font-semibold" style={{ color: "var(--primary)" }}>{player.position === "FW" ? "*" : "-"}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <DonutChart values={[{ name: "Wins", value: 63 }, { name: "Draws", value: 28 }, { name: "Losses", value: 33 }]} colors={["#a6ff00", "#94a3b8", "#ef4444"]} />
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

