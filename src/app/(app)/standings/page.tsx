"use client";

import { useStandings } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function StandingsPage() {
  const standingsQuery = useStandings();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Standings"
        description={
          standingsQuery.data?.competitionType === "LEAGUE"
            ? "League table (3 points win, 1 draw, 0 loss)."
            : "View tournament standings and team performance."
        }
      />
      {standingsQuery.isLoading ? <LoadingSkeleton /> : null}

      {!standingsQuery.isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            {standingsQuery.data?.competitionName ?? "Competition"}
          </div>
          <div className="overflow-x-auto lp-scrollbar">
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: "var(--surface-2)" }}>
                <tr>{["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "PTS", "Form"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(standingsQuery.data?.rows ?? []).map((row) => (
                  <tr key={row.team} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">{row.position}</td>
                    <td className="px-4 py-3 font-medium">{row.team}</td>
                    <td className="px-4 py-3">{row.played}</td>
                    <td className="px-4 py-3">{row.wins}</td>
                    <td className="px-4 py-3">{row.draws}</td>
                    <td className="px-4 py-3">{row.losses}</td>
                    <td className="px-4 py-3">{row.goalsFor}</td>
                    <td className="px-4 py-3">{row.goalsAgainst}</td>
                    <td className="px-4 py-3">{row.goalDiff}</td>
                    <td className="px-4 py-3" style={{ color: "var(--primary)" }}>{row.points}</td>
                    <td className="px-4 py-3">{row.form || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {standingsQuery.isError ? <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>{(standingsQuery.error as Error).message}</Card> : null}
    </div>
  );
}
