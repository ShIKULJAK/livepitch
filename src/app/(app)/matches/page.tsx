"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MatchStatus } from "@prisma/client";
import { FavoriteTargetType } from "@prisma/client";
import { useDeleteMatch, useMatches } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { canManageMatches } from "@/lib/permissions";
import { formatDateDDMMYYYY, formatTimeStable } from "@/lib/utils/date";
import { FavoriteButton } from "@/components/ui/favorite-button";

function getBadgeVariant(status: MatchStatus) {
  if (status === "LIVE") return "live" as const;
  if (status === "FINISHED") return "completed" as const;
  if (status === "POSTPONED") return "inactive" as const;
  return "upcoming" as const;
}

function isHomeWinner(status: MatchStatus, homeScore: number | null, awayScore: number | null) {
  if ((status !== "LIVE" && status !== "FINISHED") || homeScore === null || awayScore === null) return false;
  return homeScore > awayScore;
}

function isAwayWinner(status: MatchStatus, homeScore: number | null, awayScore: number | null) {
  if ((status !== "LIVE" && status !== "FINISHED") || homeScore === null || awayScore === null) return false;
  return awayScore > homeScore;
}

function MatchesPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const competitionId = searchParams.get("competitionId") ?? undefined;
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const matchesQuery = useMatches({ status: statusFilter, competitionId });
  const deleteMatch = useDeleteMatch();
  const { user } = useCurrentUser();
  const canManage = canManageMatches(user?.role);

  const rows = useMemo(
    () => (matchesQuery.data ?? []).filter((match) => statusFilter === "ALL" || match.status === statusFilter),
    [matchesQuery.data, statusFilter]
  );

  async function exportMatches() {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (competitionId) params.set("competitionId", competitionId);

    const response = await fetch(`/api/matches/export?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Export failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `live-pitch-matches-${formatDateDDMMYYYY(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("matches.title")}
        description={t("matches.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Link href="/matches/create">
                <Button variant="primary">Create Match</Button>
              </Link>
            ) : null}
            <Button variant="primary" onClick={() => void exportMatches()}>
              {t("matches.export")}
            </Button>
          </div>
        }
      />

      <FilterBar>
        <Select className="w-44" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value as MatchStatus | "ALL")}>
          <option value="ALL">{t("matches.all")}</option>
          <option value="LIVE">{t("matches.live")}</option>
          <option value="SCHEDULED">{t("matches.upcoming")}</option>
          <option value="FINISHED">{t("matches.finished")}</option>
          <option value="POSTPONED">Postponed</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto lp-scrollbar">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>
                {[t("table.time"), t("table.match"), t("table.tournament"), t("table.venue"), t("table.status"), t("table.action")].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-secondary)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((match) => (
                <tr key={match.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3">{formatTimeStable(match.scheduledAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FavoriteButton targetType={FavoriteTargetType.MATCH} targetId={match.id} className="mt-0.5" />
                      <div className="min-w-[220px] space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className={isHomeWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}>{match.homeTeam}</span>
                          <span className={isHomeWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}>
                            {match.homeScore ?? (match.status === "SCHEDULED" ? "-" : "")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className={isAwayWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}>{match.awayTeam}</span>
                          <span className={isAwayWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}>
                            {match.awayScore ?? (match.status === "SCHEDULED" ? "-" : "")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{match.competition}</td>
                  <td className="px-4 py-3">{match.venue}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getBadgeVariant(match.status)}>{match.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/matches/${match.id}`} style={{ color: "var(--primary)" }}>
                        {t("common.open")}
                      </Link>
                      {canManage ? (
                        <>
                          <Link href={`/matches/${match.id}/edit`} style={{ color: "var(--info)" }}>
                            Edit
                          </Link>
                          <button
                            type="button"
                            style={{ color: "var(--danger)" }}
                            onClick={() => {
                              if (!window.confirm(`Delete match ${match.homeTeam} vs ${match.awayTeam}?`)) return;
                              deleteMatch.mutate(match.id);
                            }}
                            disabled={deleteMatch.isPending}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {matchesQuery.isLoading ? (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("matches.loading")}
        </Card>
      ) : null}
      {matchesQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(matchesQuery.error as Error).message}
        </Card>
      ) : null}
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={null}>
      <MatchesPageContent />
    </Suspense>
  );
}
