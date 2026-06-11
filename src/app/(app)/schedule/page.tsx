"use client";

import { useEffect, useMemo, useState } from "react";
import { MatchStatus } from "@prisma/client";
import { useMatches } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { TeamAvatar } from "@/components/teams/team-identity";
import { formatDateDDMMYYYY, formatTimeStable } from "@/lib/utils/date";

function getStatusVariant(status: MatchStatus) {
  if (status === "LIVE") return "live" as const;
  if (status === "FINISHED") return "completed" as const;
  if (status === "POSTPONED") return "inactive" as const;
  return "upcoming" as const;
}

type DrawGroupSnapshot = {
  id: string;
  name: string;
  teams: Array<{ id: string; position: number | null; team: { id: string; name: string; profileImageUrl?: string | null } }>;
};

type ScheduleMatchRow = {
  id: string;
  competitionId: string;
  competition: string;
  seasonLabel?: string | null;
  generationYear?: number | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamProfileImageUrl?: string | null;
  awayTeamProfileImageUrl?: string | null;
  phase: string;
  venue?: string | null;
  pitchName?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  scheduledAt: string;
  status: MatchStatus;
};

type ScheduleGenerationEntry = {
  competitionId: string;
  seasonLabel: string;
  generationYear: number | null;
  generationLabel: string;
  matches: ScheduleMatchRow[];
  groups: DrawGroupSnapshot[];
};

export default function SchedulePage() {
  const matchesQuery = useMatches();
  const [openCompetitionNames, setOpenCompetitionNames] = useState<Record<string, boolean>>({});
  const [openSeasons, setOpenSeasons] = useState<Record<string, boolean>>({});
  const [openGenerations, setOpenGenerations] = useState<Record<string, boolean>>({});
  const [groupsByGeneration, setGroupsByGeneration] = useState<Record<string, DrawGroupSnapshot[]>>({});

  const matches = matchesQuery.data ?? [];

  const generationTargets = useMemo(
    () =>
      Array.from(
        new Map(
          matches
            .filter((match) => match.generationYear != null)
            .map((match) => [`${match.competitionId}::${match.generationYear}`, { competitionId: match.competitionId, generationYear: match.generationYear as number }])
        ).values()
      ),
    [matchesQuery.data]
  );

  const generationTargetsKey = useMemo(
    () => generationTargets.map((target) => `${target.competitionId}::${target.generationYear}`).join("|"),
    [generationTargets]
  );

  useEffect(() => {
    if (!generationTargets.length) {
      setGroupsByGeneration((current) => (Object.keys(current).length ? {} : current));
      return;
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        generationTargets.map(async ({ competitionId, generationYear }) => {
          try {
            const response = await fetch(`/api/draws/${competitionId}?generationYear=${generationYear}`);
            if (!response.ok) return [`${competitionId}::${generationYear}`, []] as const;
            const payload = (await response.json()) as {
              data?: {
                draw?: {
                  groups?: DrawGroupSnapshot[];
                } | null;
              };
            };
            return [`${competitionId}::${generationYear}`, payload.data?.draw?.groups ?? []] as const;
          } catch {
            return [`${competitionId}::${generationYear}`, []] as const;
          }
        })
      );

      if (cancelled) return;
      const nextGroups = Object.fromEntries(entries);
      setGroupsByGeneration((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(nextGroups);
        if (currentKeys.length === nextKeys.length && currentKeys.every((key) => current[key] === nextGroups[key])) {
          return current;
        }
        return nextGroups;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [generationTargets, generationTargetsKey]);

  const groupedSchedule = useMemo(() => {
    const byCompetitionName = new Map<
      string,
      Map<string, ScheduleGenerationEntry[]>
    >();

    const groupedByCompetitionAndGeneration = new Map<
      string,
      {
        competitionId: string;
        competitionName: string;
        seasonLabel: string;
        generationYear: number | null;
        generationLabel: string;
        matches: typeof matches;
      }
    >();

    for (const match of matches) {
      const generationLabel = match.generationYear ? `Generacija ${match.generationYear}` : "Bez generacije";
      const key = `${match.competitionId}::${match.seasonLabel ?? "Bez sezone"}::${match.generationYear ?? "NONE"}`;
      const existing = groupedByCompetitionAndGeneration.get(key) ?? {
        competitionId: match.competitionId,
        competitionName: match.competition,
        seasonLabel: match.seasonLabel ?? "Bez sezone",
        generationYear: match.generationYear ?? null,
        generationLabel,
        matches: [],
      };
      existing.matches.push(match);
      groupedByCompetitionAndGeneration.set(key, existing);
    }

    for (const entry of groupedByCompetitionAndGeneration.values()) {
      entry.matches.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      const seasonMap = byCompetitionName.get(entry.competitionName) ?? new Map();
      const seasonEntries: ScheduleGenerationEntry[] = seasonMap.get(entry.seasonLabel) ?? [];
      seasonEntries.push({
        ...entry,
        groups:
          entry.generationYear != null ? groupsByGeneration[`${entry.competitionId}::${entry.generationYear}`] ?? [] : [],
      });
      seasonMap.set(entry.seasonLabel, seasonEntries.sort((a, b) => (b.generationYear ?? -1) - (a.generationYear ?? -1)));
      byCompetitionName.set(entry.competitionName, seasonMap);
    }

    return Array.from(byCompetitionName.entries())
      .map(([competitionName, seasons]) => ({
        competitionName,
        seasons: Array.from(seasons.entries())
          .map(([seasonLabel, generations]) => ({ seasonLabel, generations }))
          .sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel)),
      }))
      .sort((a, b) => a.competitionName.localeCompare(b.competitionName));
  }, [groupsByGeneration, matches]);

  const hasRows = groupedSchedule.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Raspored" description="Pregled takmičenja, grupa i zakazanih utakmica po sezonama i generacijama." />
      {matchesQuery.isLoading ? (
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
      ) : null}

      {!matchesQuery.isLoading && !matchesQuery.isError ? (
        hasRows ? (
          <div className="space-y-4">
            {groupedSchedule.map((competitionGroup) => (
              <Card key={competitionGroup.competitionName} className="overflow-hidden">
                <details
                  open={openCompetitionNames[competitionGroup.competitionName] !== false}
                  onToggle={(event) => {
                    const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                    setOpenCompetitionNames((prev) => ({ ...prev, [competitionGroup.competitionName]: nextOpen }));
                  }}
                >
                  <summary
                    className="cursor-pointer border-b px-4 py-3 text-sm font-semibold"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "#9BEA3C" }}
                  >
                    {competitionGroup.competitionName}
                  </summary>
                  <div className="space-y-3 p-3">
                    {competitionGroup.seasons.map((season) => (
                      <details
                        key={`${competitionGroup.competitionName}-${season.seasonLabel}`}
                        open={openSeasons[`${competitionGroup.competitionName}-${season.seasonLabel}`] !== false}
                        onToggle={(event) => {
                          const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                          setOpenSeasons((prev) => ({
                            ...prev,
                            [`${competitionGroup.competitionName}-${season.seasonLabel}`]: nextOpen,
                          }));
                        }}
                      >
                        <summary
                          className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                        >
                          {season.seasonLabel}
                        </summary>
                        <div className="mt-3 space-y-3">
                          {season.generations.map((generation) => (
                            <details
                              key={`${generation.competitionId}-${generation.generationLabel}`}
                              open={openGenerations[`${generation.competitionId}-${generation.generationLabel}`] !== false}
                              onToggle={(event) => {
                                const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                                setOpenGenerations((prev) => ({
                                  ...prev,
                                  [`${generation.competitionId}-${generation.generationLabel}`]: nextOpen,
                                }));
                              }}
                            >
                              <summary
                                className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                              >
                                {generation.generationLabel}
                              </summary>
                              <div className="mt-3 space-y-3">
                                {generation.groups.length ? (
                                  <Card className="overflow-hidden">
                                    <div
                                      className="border-b px-4 py-3 text-sm font-semibold"
                                      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                                    >
                                      Grupe
                                    </div>
                                    <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
                                      {generation.groups.map((group) => (
                                        <div
                                          key={group.id}
                                          className="rounded-xl border p-3"
                                          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                                        >
                                          <p className="mb-2 text-sm font-semibold">{`Grupa ${group.name.toUpperCase()}`}</p>
                                          <div className="space-y-2 text-sm">
                                            {[...group.teams]
                                              .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
                                              .map((entry, index) => (
                                                <div key={entry.id} className="flex items-center gap-2">
                                                  <span style={{ color: "var(--text-secondary)" }}>{entry.position ?? index + 1}.</span>
                                                  <TeamAvatar name={entry.team.name} profileImageUrl={entry.team.profileImageUrl} size="sm" />
                                                  <span>{entry.team.name}</span>
                                                </div>
                                              ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </Card>
                                ) : null}

                                <Card className="overflow-hidden">
                                  <div
                                    className="border-b px-4 py-3 text-sm font-semibold"
                                    style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                                  >
                                    Raspored utakmica
                                  </div>
                                  <div className="overflow-x-auto lp-scrollbar">
                                      <table className="min-w-full table-fixed text-sm">
                                      <colgroup>
                                        <col className="w-32" />
                                        <col className="w-24" />
                                        <col className="w-36" />
                                        <col className="w-[32%]" />
                                        <col className="w-24" />
                                        <col className="w-[28%]" />
                                        <col className="w-32" />
                                      </colgroup>
                                      <thead style={{ backgroundColor: "var(--surface)" }}>
                                        <tr>
                                          {["Datum", "Vrijeme", "Faza", "Par", "Rezultat", "Teren", "Status"].map((header) => (
                                            <th
                                              key={header}
                                              className={`px-4 py-3 text-xs uppercase ${header === "Par" ? "text-left" : "text-center"}`}
                                              style={{ color: "var(--text-secondary)" }}
                                            >
                                              {header}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {generation.matches.length ? (
                                          generation.matches.map((match) => (
                                            <tr key={match.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                                              <td className="px-4 py-3 text-center">{formatDateDDMMYYYY(match.scheduledAt)}</td>
                                              <td className="px-4 py-3 text-center">{formatTimeStable(match.scheduledAt)}</td>
                                              <td className="px-4 py-3 text-center">{match.phase}</td>
                                              <td className="px-4 py-3">
                                                <div className="font-medium">
                                                  <span className="flex items-center gap-2">
                                                    <TeamAvatar name={match.homeTeam} profileImageUrl={match.homeTeamProfileImageUrl} size="sm" />
                                                    <span>{match.homeTeam}</span>
                                                    <span>vs</span>
                                                    <TeamAvatar name={match.awayTeam} profileImageUrl={match.awayTeamProfileImageUrl} size="sm" />
                                                    <span>{match.awayTeam}</span>
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                {match.homeScore != null && match.awayScore != null ? `${match.homeScore}:${match.awayScore}` : "-:-"}
                                              </td>
                                              <td className="px-4 py-3 text-center">{match.pitchName ?? match.venue ?? "-"}</td>
                                              <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center">
                                                  <Badge variant={getStatusVariant(match.status)}>{match.status}</Badge>
                                                </div>
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                                            <td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                                              Nema zakazanih utakmica za ovu generaciju.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </Card>
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            Nema dostupnog rasporeda za prikaz.
          </Card>
        )
      ) : null}

      {matchesQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(matchesQuery.error as Error).message}
        </Card>
      ) : null}
    </div>
  );
}
