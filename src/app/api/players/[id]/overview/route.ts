import { CompetitionType, MatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

type BucketKey = "League" | "Cup" | "Friendly";

function toBucket(type: CompetitionType): BucketKey {
  if (type === "LEAGUE") return "League";
  if (type === "FRIENDLY_MATCH") return "Friendly";
  return "Cup";
}

function makeEmptyRow(label: BucketKey) {
  return {
    competition: label,
    matches: 0,
    goals: 0,
    assists: 0,
    minutes: 0,
    rating: 0,
  };
}

function toPlayerSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id: rawId } = await params;
  const url = new URL(request.url);
  const seasonIdParam = url.searchParams.get("seasonId");

  let player = await prisma.player.findFirst({
    where: {
      id: rawId,
      team: { organizationId: currentUser.organizationId },
    },
    include: {
      clubHistory: { select: { teamId: true } },
    },
  });

  if (!player) {
    const candidates = await prisma.player.findMany({
      where: { team: { organizationId: currentUser.organizationId } },
      select: { id: true, fullName: true },
    });
    const matched = candidates.find((item) => toPlayerSlug(item.fullName) === rawId);
    if (matched) {
      player = await prisma.player.findFirst({
        where: {
          id: matched.id,
          team: { organizationId: currentUser.organizationId },
        },
        include: {
          clubHistory: { select: { teamId: true } },
        },
      });
    }
  }

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const teamIds = Array.from(new Set([player.teamId, ...player.clubHistory.map((item) => item.teamId)]));

  const seasonRows = await prisma.match.findMany({
    where: {
      status: MatchStatus.FINISHED,
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      competition: { seasonId: { not: null } },
    },
    select: {
      competition: { select: { seasonId: true, season: { select: { name: true } } } },
    },
  });

  const uniqueSeasons = Array.from(
    new Map(
      seasonRows
        .map((row) => ({
          seasonId: row.competition.seasonId,
          seasonLabel: row.competition.season?.name ?? null,
        }))
        .filter((row) => row.seasonId)
        .map((row) => [row.seasonId as string, row])
    ).values()
  );

  const selectedSeasonId =
    seasonIdParam && uniqueSeasons.some((season) => season.seasonId === seasonIdParam)
      ? seasonIdParam
      : uniqueSeasons.find((season) => (season.seasonLabel ?? "").includes(String(new Date().getFullYear())))?.seasonId ??
        uniqueSeasons[0]?.seasonId ??
        null;

  const [matches, goals, assists] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
        ...(selectedSeasonId ? { competition: { seasonId: selectedSeasonId } } : {}),
      },
      select: {
        id: true,
        regularTimeMinutes: true,
        competition: {
          select: {
            type: true,
          },
        },
      },
    }),
    prisma.matchGoalEvent.findMany({
      where: {
        playerId: player.id,
        match: {
          status: MatchStatus.FINISHED,
          ...(selectedSeasonId ? { competition: { seasonId: selectedSeasonId } } : {}),
        },
      },
      select: {
        id: true,
        match: { select: { competition: { select: { type: true } } } },
      },
    }),
    prisma.matchEvent.findMany({
      where: {
        playerId: player.id,
        match: {
          status: MatchStatus.FINISHED,
          ...(selectedSeasonId ? { competition: { seasonId: selectedSeasonId } } : {}),
        },
        OR: [
          { type: { equals: "ASSIST" } },
          { type: { contains: "assist", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        match: { select: { competition: { select: { type: true } } } },
      },
    }),
  ]);

  const byBucket: Record<BucketKey, ReturnType<typeof makeEmptyRow>> = {
    League: makeEmptyRow("League"),
    Cup: makeEmptyRow("Cup"),
    Friendly: makeEmptyRow("Friendly"),
  };

  for (const match of matches) {
    const bucket = toBucket(match.competition.type);
    byBucket[bucket].matches += 1;
    byBucket[bucket].minutes += match.regularTimeMinutes ?? 0;
  }

  for (const event of goals) {
    const bucket = toBucket(event.match.competition.type);
    byBucket[bucket].goals += 1;
  }

  for (const event of assists) {
    const bucket = toBucket(event.match.competition.type);
    byBucket[bucket].assists += 1;
  }

  const rows = (["League", "Cup", "Friendly"] as const).map((bucket) => {
    const row = byBucket[bucket];
    const intensity = row.matches > 0 ? row.minutes / (row.matches * 90) : 0;
    const ratingRaw = 5.8 + row.goals * 0.22 + row.assists * 0.15 + intensity * 0.9;
    const rating = row.matches > 0 ? Math.max(5.0, Math.min(10.0, Number(ratingRaw.toFixed(1)))) : 0;
    return { ...row, rating };
  });

  const total = rows.reduce(
    (acc, row) => ({
      competition: "Total",
      matches: acc.matches + row.matches,
      goals: acc.goals + row.goals,
      assists: acc.assists + row.assists,
      minutes: acc.minutes + row.minutes,
      rating: 0,
    }),
    { competition: "Total", matches: 0, goals: 0, assists: 0, minutes: 0, rating: 0 }
  );

  const totalIntensity = total.matches > 0 ? total.minutes / (total.matches * 90) : 0;
  const totalRatingRaw = 5.8 + total.goals * 0.22 + total.assists * 0.15 + totalIntensity * 0.9;
  total.rating = total.matches > 0 ? Math.max(5.0, Math.min(10.0, Number(totalRatingRaw.toFixed(1)))) : 0;

  return NextResponse.json({
    data: {
      season: new Date().getFullYear(),
      selectedSeasonId,
      seasons: uniqueSeasons,
      rows,
      total,
    },
  });
}
