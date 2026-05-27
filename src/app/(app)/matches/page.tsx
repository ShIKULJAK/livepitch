"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CompetitionType, MatchStatus } from "@prisma/client";
import { FavoriteTargetType } from "@prisma/client";
import { useDeleteMatch, useMatches } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { canCreateMatches, canEditEntity } from "@/lib/permissions";
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

function TeamBadge({ name, profileImageUrl }: { name: string; profileImageUrl?: string | null }) {
  if (profileImageUrl) {
    return (
      <img
        src={profileImageUrl}
        alt={name}
        className="h-4 w-4 rounded-full object-cover"
        loading="lazy"
      />
    );
  }

  return <span className="inline-flex h-4 w-4 items-center justify-center text-[10px]">🛡️</span>;
}

function MatchesPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const competitionId = searchParams.get("competitionId") ?? undefined;
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const [competitionTypeFilter, setCompetitionTypeFilter] = useState<CompetitionType | "ALL">("ALL");
  const [competitionFilter, setCompetitionFilter] = useState<string>("ALL");
  const [generationFilter, setGenerationFilter] = useState<string>("ALL");
  const [searchValue, setSearchValue] = useState("");
  const [openCompetitions, setOpenCompetitions] = useState<Record<string, boolean>>({});
  const [openGenerations, setOpenGenerations] = useState<Record<string, boolean>>({});
  const [isMounted, setIsMounted] = useState(false);
  const matchesQuery = useMatches({ status: statusFilter, competitionId });
  const deleteMatch = useDeleteMatch();
  const { user } = useCurrentUser();
  const canManage = canCreateMatches(user?.role);

  const generationOptions = useMemo(() => {
    const values = Array.from(
      new Set((matchesQuery.data ?? []).map((match) => match.generationYear).filter((value): value is number => value != null))
    ).sort((a, b) => b - a);
    return values;
  }, [matchesQuery.data]);

  const competitionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const match of matchesQuery.data ?? []) {
      if (!map.has(match.competitionId)) {
        map.set(match.competitionId, match.competition);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [matchesQuery.data]);

  const rows = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return (matchesQuery.data ?? []).filter((match) => {
      if (statusFilter !== "ALL" && match.status !== statusFilter) return false;
      if (competitionTypeFilter !== "ALL" && match.competitionType !== competitionTypeFilter) return false;
      if (competitionFilter !== "ALL" && match.competitionId !== competitionFilter) return false;
      if (generationFilter !== "ALL") {
        if (generationFilter === "NONE" && match.generationYear != null) return false;
        if (generationFilter !== "NONE" && String(match.generationYear ?? "") !== generationFilter) return false;
      }
      if (q) {
        const haystack = [
          match.competition,
          match.homeTeam,
          match.awayTeam,
          match.venue,
          match.round ?? "",
          match.seasonLabel ?? "",
          match.generationYear ? String(match.generationYear) : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [matchesQuery.data, statusFilter, competitionTypeFilter, competitionFilter, generationFilter, searchValue]);
  const hasSearchQuery = searchValue.trim().length > 0;
  const groupedByCompetition = useMemo(() => {
    const map = new Map<string, { competitionId: string; competitionName: string; generationGroups: Map<string, typeof rows> }>();
    for (const match of rows) {
      const competitionKey = match.competitionId;
      const generationKey = match.generationYear ? `Generacija ${match.generationYear}` : "Bez generacije";
      const existing =
        map.get(competitionKey) ??
        {
          competitionId: competitionKey,
          competitionName: match.competition,
          generationGroups: new Map<string, typeof rows>(),
        };
      const generationList = existing.generationGroups.get(generationKey) ?? [];
      generationList.push(match);
      existing.generationGroups.set(generationKey, generationList);
      map.set(competitionKey, existing);
    }
    return Array.from(map.values())
      .map((competitionEntry) => ({
        ...competitionEntry,
        generationItems: Array.from(competitionEntry.generationGroups.entries()).sort((a, b) => {
          if (a[0] === "Bez generacije") return 1;
          if (b[0] === "Bez generacije") return -1;
          return b[0].localeCompare(a[0]);
        }),
      }))
      .sort((a, b) => a.competitionName.localeCompare(b.competitionName));
  }, [rows]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton />
      </div>
    );
  }

  async function exportMatches(format: "csv" | "pdf") {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (competitionFilter !== "ALL") params.set("competitionId", competitionFilter);
    else if (competitionId) params.set("competitionId", competitionId);
    if (competitionTypeFilter !== "ALL") params.set("competitionType", competitionTypeFilter);
    if (generationFilter !== "ALL") params.set("generation", generationFilter);
    const q = searchValue.trim();
    if (q) params.set("q", q);
    params.set("format", format);
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    params.set("theme", theme);

    const response = await fetch(`/api/matches/export?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Export failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `live-pitch-raspored-${formatDateDDMMYYYY(new Date())}.${format}`;
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
            <Button variant="primary" onClick={() => void exportMatches("csv")}>
              {t("matches.export")}
            </Button>
            <Button variant="secondary" onClick={() => void exportMatches("pdf")}>
              Export PDF
            </Button>
          </div>
        }
      />

      <FilterBar>
        <Select className="w-44" value={competitionTypeFilter} onChange={(event) => setCompetitionTypeFilter(event.currentTarget.value as CompetitionType | "ALL")}>
          <option value="ALL">Tip meca: svi</option>
          <option value="TOURNAMENT">Tournament</option>
          <option value="LEAGUE">League</option>
          <option value="FRIENDLY_MATCH">Friendly</option>
        </Select>
        <Select className="w-56" value={competitionFilter} onChange={(event) => setCompetitionFilter(event.currentTarget.value)}>
          <option value="ALL">Takmicenje: sva</option>
          {competitionOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select className="w-52" value={generationFilter} onChange={(event) => setGenerationFilter(event.currentTarget.value)}>
          <option value="ALL">Sve generacije</option>
          {generationOptions.map((year) => (
            <option key={year} value={String(year)}>
              Generacija {year}
            </option>
          ))}
          <option value="NONE">Bez generacije</option>
        </Select>
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.currentTarget.value)}
          placeholder="Pretraga meceva..."
          className="h-10 w-64 rounded-md border px-3 text-sm outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface-2)",
            color: "var(--text-primary)",
          }}
        />
        <Select className="w-44" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value as MatchStatus | "ALL")}>
          <option value="ALL">{t("matches.all")}</option>
          <option value="LIVE">{t("matches.live")}</option>
          <option value="SCHEDULED">{t("matches.upcoming")}</option>
          <option value="FINISHED">{t("matches.finished")}</option>
          <option value="POSTPONED">Postponed</option>
        </Select>
      </FilterBar>

      <div className="w-full space-y-4">
        {!matchesQuery.isLoading ? groupedByCompetition.map((competitionEntry) => (
          <Card key={competitionEntry.competitionId} className="overflow-hidden">
            <details
              open={hasSearchQuery || openCompetitions[competitionEntry.competitionId] !== false}
              onToggle={(event) => {
                const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                setOpenCompetitions((prev) => ({ ...prev, [competitionEntry.competitionId]: nextOpen }));
              }}
            >
              <summary className="cursor-pointer border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "#9BEA3C" }}>
                {competitionEntry.competitionName}
              </summary>
              <div className="space-y-3 p-3">
                {competitionEntry.generationItems.map(([generationLabel, generationMatches]) => (
                  <details
                    key={`${competitionEntry.competitionId}-${generationLabel}`}
                    open={hasSearchQuery || openGenerations[`${competitionEntry.competitionId}-${generationLabel}`] !== false}
                    onToggle={(event) => {
                      const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                      setOpenGenerations((prev) => ({
                        ...prev,
                        [`${competitionEntry.competitionId}-${generationLabel}`]: nextOpen,
                      }));
                    }}
                  >
                    <summary className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                      {generationLabel}
                    </summary>
                    <div className="mt-2 overflow-x-auto lp-scrollbar rounded-md border" style={{ borderColor: "var(--border)" }}>
                      <table className="min-w-full text-sm">
                        <thead style={{ backgroundColor: "var(--surface-2)" }}>
                          <tr>
                            {["Datum", t("table.time"), t("table.match"), t("table.tournament"), t("table.venue"), t("table.status"), t("table.action")].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-secondary)" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {generationMatches.map((match) => (
                            (() => {
                              const canEditRow = canEditEntity(user, match);
                              const isVirtualKnockout = Boolean(match.isVirtualKnockout);
                              return (
                                <tr key={match.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                                  <td className="px-4 py-3">{formatDateDDMMYYYY(match.scheduledAt)}</td>
                                  <td className="px-4 py-3">{formatTimeStable(match.scheduledAt)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-start gap-2">
                                      <FavoriteButton targetType={FavoriteTargetType.MATCH} targetId={match.id} className="mt-0.5" />
                                      <div className="min-w-[220px] space-y-1">
                                        <div className="flex items-center justify-between gap-3">
                                          <span className={`flex items-center gap-1.5 ${isHomeWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}`}>
                                            <TeamBadge name={match.homeTeam} profileImageUrl={match.homeTeamProfileImageUrl} />
                                            {match.homeTeam}
                                          </span>
                                          <span className={isHomeWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}>
                                            {match.homeScore ?? (match.status === "SCHEDULED" ? "-" : "")}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                          <span className={`flex items-center gap-1.5 ${isAwayWinner(match.status, match.homeScore, match.awayScore) ? "font-semibold" : ""}`}>
                                            <TeamBadge name={match.awayTeam} profileImageUrl={match.awayTeamProfileImageUrl} />
                                            {match.awayTeam}
                                          </span>
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
                                      {!isVirtualKnockout ? (
                                        <Link href={`/matches/${match.id}`} style={{ color: "var(--primary)" }}>
                                          {t("common.open")}
                                        </Link>
                                      ) : (
                                        <span style={{ color: "var(--text-secondary)" }}>Knockout</span>
                                      )}
                                      {canEditRow && !isVirtualKnockout ? (
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
                              );
                            })()
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
                {!competitionEntry.generationItems.length ? (
                  <p className="px-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Nema meceva za prikaz.
                  </p>
                ) : null}
              </div>
            </details>
          </Card>
        )) : null}
      </div>

      {!matchesQuery.isLoading && groupedByCompetition.length === 0 ? (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Nema meceva za prikaz.
        </Card>
      ) : null}
      {matchesQuery.isLoading ? (
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
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
