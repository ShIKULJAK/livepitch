"use client";

import { useMemo } from "react";
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

  const groups = useMemo(() => {
    const grouped = Object.groupBy(matchesQuery.data ?? [], (item) => item.competition);
    return Object.entries(grouped).map(([competition, matches]) => {
      const byDate = Object.groupBy(matches ?? [], (item) => formatDateDDMMYYYY(item.scheduledAt));
      return { competition, byDate };
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
          <Card key={competitionGroup.competition} className="space-y-4 p-4">
            <h2 className="text-xl font-semibold">{competitionGroup.competition}</h2>
            {Object.entries(competitionGroup.byDate).map(([date, rows]) => (
              <div key={`${competitionGroup.competition}-${date}`}>
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
