import { MatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listMatchesForExport } from "@/lib/repositories/matches";
import { formatDateDDMMYYYY } from "@/lib/utils/date";

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatScore(status: MatchStatus, homeScore: number | null, awayScore: number | null) {
  if (status === "LIVE" && homeScore !== null && awayScore !== null) return `${homeScore}:${awayScore}`;
  if (status === "FINISHED" && homeScore !== null && awayScore !== null) return `${homeScore}:${awayScore}`;
  return "VS";
}

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const competitionId = searchParams.get("competitionId") ?? undefined;

  const status = rawStatus && rawStatus in MatchStatus ? (rawStatus as MatchStatus) : undefined;
  const matches = await listMatchesForExport(currentUser.organizationId, { status, competitionId });

  const header = [
    "Competition",
    "Round/Stage",
    "Date",
    "Kickoff Time",
    "Home Team",
    "Away Team",
    "Venue",
    "Status",
    "Score",
  ];

  const rows = matches.map((match) => {
    const date = new Date(match.scheduledAt);
    return [
      match.competition.name,
      match.round ?? "",
      formatDateDDMMYYYY(date),
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      match.homeTeam.name,
      match.awayTeam.name,
      match.venue?.name ?? "",
      match.status,
      formatScore(match.status, match.homeScore, match.awayScore),
    ].map((cell) => escapeCsvCell(String(cell)));
  });

  const csvContent = [header, ...rows].map((line) => line.join(",")).join("\n");
  const fileName = `live-pitch-matches-${formatDateDDMMYYYY(new Date())}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
