"use client";

import { useEffect, useMemo, useState } from "react";
import { MatchStatus } from "@prisma/client";
import { useMatches } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { formatDateDDMMYYYY, formatTimeHHMM } from "@/lib/utils/date";

function getStatusVariant(status: MatchStatus) {
  if (status === "LIVE") return "live" as const;
  if (status === "FINISHED") return "completed" as const;
  if (status === "POSTPONED") return "inactive" as const;
  return "upcoming" as const;
}

export default function SchedulePage() {
  const matchesQuery = useMatches();
  const [knockoutByCompetition, setKnockoutByCompetition] = useState<
    Record<
      string,
      Array<{
        roundTitle: string;
        matches: Array<{ id: string; home: string; away: string; scheduledAt: string | null; venue: string }>;
      }>
    >
  >({});

  useEffect(() => {
    if (!matchesQuery.data?.length) {
      setKnockoutByCompetition({});
      return;
    }
    const competitionIds = Array.from(new Set(matchesQuery.data.map((item) => item.competitionId)));
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        competitionIds.map(async (competitionId) => {
          try {
            const response = await fetch(`/api/draws/${competitionId}`);
            if (!response.ok) return [competitionId, []] as const;
            const payload = (await response.json()) as {
              data?: {
                draw?: {
                  knockoutRounds?: Array<{
                    id: string;
                    roundType: "ROUND_OF_16" | "QUARTERFINAL" | "SEMIFINAL" | "FINAL" | "THIRD_PLACE";
                    matches: Array<{
                      id: string;
                      homeTeam: { name: string } | null;
                      awayTeam: { name: string } | null;
                      homeSourceValue: string;
                      awaySourceValue: string;
                      scheduledAt?: string | null;
                      venueLabel?: string | null;
                      pitchName?: string | null;
                    }>;
                  }>;
                } | null;
              };
            };
            const rounds = payload.data?.draw?.knockoutRounds ?? [];
            const mapped = rounds.map((round) => ({
              roundTitle:
                round.roundType === "ROUND_OF_16"
                  ? "1/8 FINALA"
                  : round.roundType === "QUARTERFINAL"
                    ? "1/4 FINALA"
                    : round.roundType === "SEMIFINAL"
                      ? "1/2 FINALA"
                      : round.roundType === "FINAL"
                        ? "FINALE"
                        : "UTAKMICA ZA 3. MJESTO",
                matches: round.matches.map((match) => ({
                  id: match.id,
                  home: match.homeTeam?.name ?? match.homeSourceValue,
                  away: match.awayTeam?.name ?? match.awaySourceValue,
                  scheduledAt: match.scheduledAt ?? null,
                  venue: match.venueLabel ?? match.pitchName ?? "Teren",
                })),
              }));
            return [competitionId, mapped] as const;
          } catch {
            return [competitionId, []] as const;
          }
        })
      );

      if (cancelled) return;
      setKnockoutByCompetition(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [matchesQuery.data]);

  const groups = useMemo(() => {
    const grouped = Object.groupBy(matchesQuery.data ?? [], (item) => item.competitionId);
    return Object.entries(grouped).map(([competitionId, matches]) => {
      const competitionName = matches?.[0]?.competition ?? "Competition";
      const byDate = Object.groupBy(matches ?? [], (item) => formatDateDDMMYYYY(item.scheduledAt));
      return { competitionId, competitionName, byDate };
    });
  }, [matchesQuery.data]);

  return (
    <div className="space-y-4">
      <PageHeader title="Schedule" description="View and manage all match schedules." />
      {matchesQuery.isLoading ? (
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
      ) : null}
      <div className="space-y-4">
        {!matchesQuery.isLoading ? groups.map((competitionGroup) => (
          <Card key={competitionGroup.competitionId} className="space-y-4 p-4">
            <h2 className="text-xl font-semibold">{competitionGroup.competitionName}</h2>
            {Object.entries(competitionGroup.byDate).map(([date, rows]) => (
              <div key={`${competitionGroup.competitionId}-${date}`}>
                <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {date}
                </h3>
                <div className="space-y-2">
                  {(rows ?? []).map((match) => (
                    <div
                      key={match.id}
                      className="grid gap-2 rounded-xl border p-3 md:grid-cols-[110px_1fr_auto] md:items-center"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                    >
                      <p className="font-medium">{formatTimeHHMM(match.scheduledAt)}</p>
                      <p>
                        {match.homeTeam} vs {match.awayTeam} - {match.venue}
                      </p>
                      <Badge variant={getStatusVariant(match.status)}>{match.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(knockoutByCompetition[competitionGroup.competitionId] ?? []).length ? (
              <div>
                <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Knockout faza
                </h3>
                <div className="space-y-2">
                  {(knockoutByCompetition[competitionGroup.competitionId] ?? []).map((round) => (
                    <div key={`${competitionGroup.competitionId}-${round.roundTitle}`} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                      <p className="mb-2 text-sm font-semibold">{round.roundTitle}</p>
                      <div className="space-y-1">
                        {round.matches.map((match, index) => (
                          <div key={match.id} className="text-sm">
                            <p>
                              {index + 1}. {match.home} vs {match.away}
                            </p>
                            {match.scheduledAt ? (
                              <p style={{ color: "var(--text-secondary)" }}>
                                {formatDateDDMMYYYY(match.scheduledAt)} {formatTimeHHMM(match.scheduledAt)} - {match.venue}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        )) : null}
      </div>
      {matchesQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(matchesQuery.error as Error).message}
        </Card>
      ) : null}
    </div>
  );
}
