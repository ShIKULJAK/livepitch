"use client";

import { useState } from "react";
import { useStandings } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { TeamAvatar } from "@/components/teams/team-identity";

function FormBadge({ result }: { result: "W" | "D" | "L" }) {
  const palette =
    result === "W"
      ? { backgroundColor: "rgba(52, 211, 153, 0.16)", color: "#4ADE80", borderColor: "rgba(52, 211, 153, 0.32)" }
      : result === "D"
        ? { backgroundColor: "rgba(148, 163, 184, 0.14)", color: "#CBD5E1", borderColor: "rgba(148, 163, 184, 0.28)" }
        : { backgroundColor: "rgba(248, 113, 113, 0.16)", color: "#F87171", borderColor: "rgba(248, 113, 113, 0.28)" };

  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold"
      style={palette}
      title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
    >
      {result}
    </span>
  );
}

const standingsColumns = [
  { key: "position", label: "#", className: "w-12 text-center" },
  { key: "club", label: "Club", className: "w-[280px] text-left" },
  { key: "played", label: "MP", className: "w-16 text-center" },
  { key: "wins", label: "W", className: "w-16 text-center" },
  { key: "draws", label: "D", className: "w-16 text-center" },
  { key: "losses", label: "L", className: "w-16 text-center" },
  { key: "goalsFor", label: "GF", className: "w-16 text-center" },
  { key: "goalsAgainst", label: "GA", className: "w-16 text-center" },
  { key: "goalDiff", label: "GD", className: "w-16 text-center" },
  { key: "points", label: "Pts", className: "w-16 text-center" },
  { key: "form", label: "Last 5", className: "w-40 text-center" },
] as const;

export default function StandingsPage() {
  const standingsQuery = useStandings();
  const [openCompetitionNames, setOpenCompetitionNames] = useState<Record<string, boolean>>({});
  const [openSeasons, setOpenSeasons] = useState<Record<string, boolean>>({});
  const [openGenerations, setOpenGenerations] = useState<Record<string, boolean>>({});

  const competitions = standingsQuery.data?.competitions ?? [];
  const groupedCompetitions = Array.from(
    competitions.reduce((map, competition) => {
      const existing = map.get(competition.competitionName) ?? [];
      existing.push(competition);
      map.set(competition.competitionName, existing);
      return map;
    }, new Map<string, typeof competitions>())
  )
    .map(([competitionName, seasons]) => ({
      competitionName,
      seasons: [...seasons].sort((a, b) => (b.seasonLabel ?? "").localeCompare(a.seasonLabel ?? "")),
    }))
    .sort((a, b) => a.competitionName.localeCompare(b.competitionName));

  const hasRows = competitions.some((competition) =>
    competition.generations.some((generation) => generation.groups.some((group) => group.rows.length > 0))
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Standings"
        description="Pregled tabela po takmičenju, generaciji i grupi."
      />

      {standingsQuery.isLoading ? <LoadingSkeleton /> : null}

      {!standingsQuery.isLoading && !standingsQuery.isError ? (
        hasRows ? (
          <div className="space-y-4">
            {groupedCompetitions.map((competitionGroup) => (
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
                    <span>{competitionGroup.competitionName}</span>
                  </summary>
                  <div className="space-y-3 p-3">
                    {competitionGroup.seasons.map((competition) => (
                      <details
                        key={competition.competitionId}
                        open={openSeasons[competition.competitionId] !== false}
                        onToggle={(event) => {
                          const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                          setOpenSeasons((prev) => ({ ...prev, [competition.competitionId]: nextOpen }));
                        }}
                      >
                        <summary
                          className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                        >
                          {competition.seasonLabel ?? "Bez sezone"}
                        </summary>
                        <div className="mt-3 space-y-3">
                          {competition.generations.map((generation) => (
                            <details
                              key={`${competition.competitionId}-${generation.generationLabel}`}
                              open={openGenerations[`${competition.competitionId}-${generation.generationLabel}`] !== false}
                              onToggle={(event) => {
                                const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                                setOpenGenerations((prev) => ({
                                  ...prev,
                                  [`${competition.competitionId}-${generation.generationLabel}`]: nextOpen,
                                }));
                              }}
                            >
                              <summary
                                className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                              >
                                {generation.generationLabel}
                              </summary>
                              <div className="mt-3 grid gap-3">
                                {generation.groups.map((group) => (
                                  <Card key={group.groupId} className="overflow-hidden">
                                    <div
                                      className="border-b px-4 py-3 text-sm font-semibold"
                                      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                                    >
                                      {group.groupLabel}
                                    </div>
                                    <div className="overflow-x-auto lp-scrollbar">
                                      <table className="min-w-full table-fixed text-sm">
                                        <colgroup>
                                          {standingsColumns.map((column) => (
                                            <col key={column.key} className={column.className.split(" ")[0]} />
                                          ))}
                                        </colgroup>
                                        <thead style={{ backgroundColor: "var(--surface)" }}>
                                          <tr>
                                            {standingsColumns.map((column) => (
                                              <th
                                                key={column.key}
                                                className={`px-4 py-3 text-xs uppercase ${column.className}`}
                                                style={{ color: "var(--text-secondary)" }}
                                              >
                                                {column.label}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.rows.length ? (
                                            group.rows.map((row) => (
                                              <tr key={row.teamId} className="border-t" style={{ borderColor: "var(--border)" }}>
                                                <td className="px-4 py-3 text-center font-medium">{row.position}</td>
                                                <td className="px-4 py-3">
                                                  <div className="flex items-center gap-2 truncate font-medium">
                                                    <TeamAvatar name={row.team} profileImageUrl={row.profileImageUrl} size="md" />
                                                    <span className="truncate">{row.team}</span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">{row.played}</td>
                                                <td className="px-4 py-3 text-center">{row.wins}</td>
                                                <td className="px-4 py-3 text-center">{row.draws}</td>
                                                <td className="px-4 py-3 text-center">{row.losses}</td>
                                                <td className="px-4 py-3 text-center">{row.goalsFor}</td>
                                                <td className="px-4 py-3 text-center">{row.goalsAgainst}</td>
                                                <td className="px-4 py-3 text-center">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                                <td className="px-4 py-3 text-center font-semibold" style={{ color: "var(--primary)" }}>
                                                  {row.points}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="flex items-center justify-center gap-1">
                                                    {row.form.length ? row.form.map((result, index) => <FormBadge key={`${row.teamId}-${index}-${result}`} result={result} />) : <span>-</span>}
                                                  </div>
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                                              <td colSpan={11} className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                                                Nema upisanih rezultata za ovu tabelu.
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </Card>
                                ))}
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
            Nema dostupnih rezultata za prikaz.
          </Card>
        )
      ) : null}

      {standingsQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(standingsQuery.error as Error).message}
        </Card>
      ) : null}
    </div>
  );
}
