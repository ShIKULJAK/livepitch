import { CompetitionType, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { z } from "zod";
import { calculatePossessionPercentages } from "@/lib/constants/match";
import { notifyFavoriteMatchFinished, notifyFavoriteMatchGoal } from "@/lib/notifications";
import { canEditEntity } from "@/lib/permissions";
import { matchDetailsUpdateSchema } from "@/lib/validation/match-details";
import { matchInputSchema, matchUpdateSchema } from "@/lib/validation/match";

type MatchInput = z.infer<typeof matchInputSchema>;
type MatchUpdate = z.infer<typeof matchUpdateSchema>;
type MatchDetailsUpdate = z.infer<typeof matchDetailsUpdateSchema>;

function parseKnockoutRoundType(stage: string | null | undefined) {
  if (!stage) return null;
  const normalized = stage.toUpperCase();
  if (normalized === "ROUND_OF_16" || normalized === "R16") return { roundType: "ROUND_OF_16" as const, code: "R16" };
  if (normalized === "QUARTERFINAL" || normalized === "QF" || normalized === "QUARTERFINALS") {
    return { roundType: "QUARTERFINAL" as const, code: "QF" };
  }
  if (normalized === "SEMIFINAL" || normalized === "SF" || normalized === "SEMIFINALS") {
    return { roundType: "SEMIFINAL" as const, code: "SF" };
  }
  if (normalized === "FINAL" || normalized === "F") return { roundType: "FINAL" as const, code: "F" };
  if (normalized === "THIRD_PLACE" || normalized === "THIRDPLACE" || normalized === "TP") {
    return { roundType: "THIRD_PLACE" as const, code: "TP" };
  }
  return null;
}

function parseMatchOrder(round: string | null | undefined) {
  if (!round) return null;
  const match = round.match(/(\d+)\s*$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function syncDrawKnockoutProgress(
  tx: Prisma.TransactionClient,
  match: {
    id: string;
    drawId: string | null;
    stage: string | null;
    round: string | null;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    status: MatchStatus;
  }
) {
  if (!match.drawId) return;
  if (match.homeScore === null || match.awayScore === null) return;
  if (match.homeScore === match.awayScore) return;

  const roundMeta = parseKnockoutRoundType(match.stage);
  if (!roundMeta) return;

  const winnerTeamId = match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId;
  const loserTeamId = match.homeScore > match.awayScore ? match.awayTeamId : match.homeTeamId;
  const orderHint = parseMatchOrder(match.round);

  const round = await tx.drawKnockoutRound.findFirst({
    where: { drawId: match.drawId, roundType: roundMeta.roundType },
    include: { matches: { orderBy: { order: "asc" } } },
  });
  if (!round || !round.matches.length) return;

  let currentMatch = orderHint ? round.matches.find((item) => item.order === orderHint) ?? null : null;
  if (!currentMatch) {
    currentMatch =
      round.matches.find((item) => item.homeTeamId === match.homeTeamId && item.awayTeamId === match.awayTeamId) ??
      round.matches.find((item) => item.homeTeamId === match.awayTeamId && item.awayTeamId === match.homeTeamId) ??
      null;
  }
  if (!currentMatch) return;

  const currentRef = `${roundMeta.code}-${currentMatch.order}`;

  await tx.drawKnockoutMatch.update({
    where: { id: currentMatch.id },
    data: {
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      winnerTeamId,
    },
  });

  const dependentMatches = await tx.drawKnockoutMatch.findMany({
    where: {
      round: { drawId: match.drawId },
      OR: [
        { homeSourceType: "MATCH_WINNER", homeSourceValue: currentRef },
        { awaySourceType: "MATCH_WINNER", awaySourceValue: currentRef },
        { homeSourceType: "MATCH_WINNER", homeSourceValue: `${currentRef}-LOSER` },
        { awaySourceType: "MATCH_WINNER", awaySourceValue: `${currentRef}-LOSER` },
      ],
    },
    select: { id: true, homeSourceValue: true, awaySourceValue: true },
  });

  for (const dependent of dependentMatches) {
    const data: Prisma.DrawKnockoutMatchUncheckedUpdateInput = {};
    if (dependent.homeSourceValue === currentRef) data.homeTeamId = winnerTeamId;
    if (dependent.awaySourceValue === currentRef) data.awayTeamId = winnerTeamId;
    if (dependent.homeSourceValue === `${currentRef}-LOSER`) data.homeTeamId = loserTeamId;
    if (dependent.awaySourceValue === `${currentRef}-LOSER`) data.awayTeamId = loserTeamId;
    if (Object.keys(data).length) {
      await tx.drawKnockoutMatch.update({ where: { id: dependent.id }, data });
    }
  }
}

async function assertCompetitionOwnership(organizationId: string, competitionId: string) {
  return prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    select: { id: true, seasonId: true, matchDurationMinutes: true, createdById: true, stadiumName: true, pitchNames: true },
  });
}

const FRIENDLY_COMPETITION_OPTION = "__friendly_game__";

async function resolveCompetitionForCreate(organizationId: string, competitionId: string, homeTeamId: string, actorId: string) {
  if (competitionId !== FRIENDLY_COMPETITION_OPTION) {
    const competition = await assertCompetitionOwnership(organizationId, competitionId);
    if (!competition) throw new Error("Forbidden");
    return competition;
  }

  const homeTeam = await prisma.team.findFirst({
    where: { id: homeTeamId, organizationId },
    select: { sport: true },
  });
  if (!homeTeam) throw new Error("Home team not found");

  const existingFriendlyCompetition = await prisma.competition.findFirst({
    where: {
      organizationId,
      type: "FRIENDLY_MATCH",
      sport: homeTeam.sport,
      name: "Friendly Game",
    },
    select: { id: true, seasonId: true, matchDurationMinutes: true, stadiumName: true, pitchNames: true },
  });

  if (existingFriendlyCompetition) return existingFriendlyCompetition;

  return prisma.competition.create({
    data: {
      organizationId,
      createdById: actorId,
      type: "FRIENDLY_MATCH",
      sport: homeTeam.sport,
      name: "Friendly Game",
      format: "Single Match",
      status: "ONGOING",
      matchDurationMinutes: 90,
      visibility: "public",
    },
    select: { id: true, seasonId: true, matchDurationMinutes: true, stadiumName: true, pitchNames: true },
  });
}

export async function createMatch(organizationId: string, actorId: string, input: MatchInput) {
  const competition = await resolveCompetitionForCreate(organizationId, input.competitionId, input.homeTeamId, actorId);
  const defaultPitch = competition.pitchNames?.[0] ?? "Teren 1";
  const venueLabel = input.venueLabel ?? (competition.stadiumName ? `${competition.stadiumName} - ${input.pitchName ?? defaultPitch}` : null);

  return prisma.match.create({
    data: {
      competitionId: competition.id,
      seasonId: competition.seasonId ?? null,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      venueId: input.venueId ?? null,
      pitchName: input.pitchName ?? defaultPitch,
      venueLabel,
      round: input.round ?? null,
      scheduledAt: new Date(input.scheduledAt),
      status: input.status ?? "SCHEDULED",
      homeScore: input.homeScore ?? null,
      awayScore: input.awayScore ?? null,
      liveMinute: input.liveMinute ?? null,
      regularTimeMinutes: competition.matchDurationMinutes,
      createdById: actorId,
    },
  });
}

export async function updateMatch(organizationId: string, actor: { id: string; role: string }, matchId: string, input: MatchUpdate) {
  const existing = await prisma.match.findFirst({
    where: { id: matchId, competition: { organizationId } },
    select: { id: true, status: true, createdById: true, pitchName: true, venueLabel: true },
  });

  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");

  const nextCompetitionId = input.competitionId ?? undefined;
  const nextCompetition =
    nextCompetitionId !== undefined
      ? await assertCompetitionOwnership(organizationId, nextCompetitionId)
      : null;
  if (nextCompetitionId !== undefined && !nextCompetition) throw new Error("Forbidden");

  const updated = await prisma.match.update({
    where: { id: existing.id },
    data: {
      ...(input.competitionId !== undefined ? { competitionId: input.competitionId } : {}),
      ...(nextCompetition ? { seasonId: nextCompetition.seasonId ?? null } : {}),
      ...(input.homeTeamId !== undefined ? { homeTeamId: input.homeTeamId } : {}),
      ...(input.awayTeamId !== undefined ? { awayTeamId: input.awayTeamId } : {}),
      ...(input.venueId !== undefined ? { venueId: input.venueId } : {}),
      ...(input.pitchName !== undefined ? { pitchName: input.pitchName } : {}),
      ...(input.venueLabel !== undefined ? { venueLabel: input.venueLabel } : {}),
      ...(input.round !== undefined ? { round: input.round } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: new Date(input.scheduledAt) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.homeScore !== undefined ? { homeScore: input.homeScore } : {}),
      ...(input.awayScore !== undefined ? { awayScore: input.awayScore } : {}),
      ...(input.liveMinute !== undefined ? { liveMinute: input.liveMinute } : {}),
      ...(input.regularTimeMinutes !== undefined
        ? { regularTimeMinutes: input.regularTimeMinutes }
        : nextCompetition
          ? { regularTimeMinutes: nextCompetition.matchDurationMinutes }
          : {}),
    },
  });

  if (existing.status !== "FINISHED" && updated.status === "FINISHED") {
    const withTeams = await prisma.match.findUnique({
      where: { id: updated.id },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    });
    if (withTeams) {
      await notifyFavoriteMatchFinished({
        matchId: withTeams.id,
        homeTeam: withTeams.homeTeam.name,
        awayTeam: withTeams.awayTeam.name,
        homeScore: withTeams.homeScore,
        awayScore: withTeams.awayScore,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await syncDrawKnockoutProgress(tx, {
      id: updated.id,
      drawId: (updated as typeof updated & { drawId?: string | null }).drawId ?? null,
      stage: (updated as typeof updated & { stage?: string | null }).stage ?? null,
      round: updated.round ?? null,
      homeTeamId: updated.homeTeamId,
      awayTeamId: updated.awayTeamId,
      homeScore: updated.homeScore,
      awayScore: updated.awayScore,
      status: updated.status,
    });
  });

  return updated;
}

export async function deleteMatch(organizationId: string, actor: { id: string; role: string }, matchId: string) {
  const existing = await prisma.match.findFirst({
    where: { id: matchId, competition: { organizationId } },
    select: { id: true, createdById: true },
  });

  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");
  return prisma.match.delete({ where: { id: existing.id } });
}

export async function listMatchesForExport(
  organizationId: string,
  filters: {
    status?: MatchStatus;
    competitionId?: string;
    competitionType?: CompetitionType;
  }
) {
  const where: Prisma.MatchWhereInput = {
    competition: { organizationId },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.competitionId ? { competitionId: filters.competitionId } : {}),
    ...(filters.competitionType ? { competition: { organizationId, type: filters.competitionType } } : {}),
  };

  return prisma.match.findMany({
    where,
    include: {
      competition: {
        include: {
          season: {
            select: {
              name: true,
            },
          },
        },
      },
      venue: true,
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: [{ scheduledAt: "asc" }],
  });
}

export async function getMatchDetails(organizationId: string, matchId: string) {
  return prisma.match.findFirst({
    where: { id: matchId, competition: { organizationId } },
    include: {
      competition: true,
      venue: true,
      homeTeam: {
        include: {
          players: {
            select: { id: true, fullName: true },
            orderBy: { fullName: "asc" },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            select: { id: true, fullName: true },
            orderBy: { fullName: "asc" },
          },
        },
      },
      goalEvents: {
        include: {
          player: { select: { id: true, fullName: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ minuteBase: "asc" }, { minuteExtra: "asc" }, { createdAt: "asc" }],
      },
      teamStats: {
        include: {
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function saveMatchDetails(
  organizationId: string,
  actor: { id: string; role: string },
  matchId: string,
  payload: MatchDetailsUpdate
) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, competition: { organizationId } },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      status: true,
      regularTimeMinutes: true,
      createdById: true,
      scheduledAt: true,
      competition: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!match) return null;
  if (!canEditEntity(actor, match)) throw new Error("Forbidden");
  if (actor.role !== "ADMIN") {
    if (match.competition.status === "UPCOMING" || match.competition.status === "DRAFT") {
      throw new Error("Unos nije dozvoljen dok takmičenje ne počne.");
    }
    if (new Date() < match.scheduledAt) {
      throw new Error("Unos nije dozvoljen prije početka utakmice.");
    }
  }

  const homeTeamStats = payload.teamStats.find((item) => item.teamId === match.homeTeamId);
  const awayTeamStats = payload.teamStats.find((item) => item.teamId === match.awayTeamId);

  if (!homeTeamStats || !awayTeamStats) {
    throw new Error("Both team stats are required.");
  }

  const possession = calculatePossessionPercentages(homeTeamStats.possessionSeconds, awayTeamStats.possessionSeconds);

  const existingGoals = await prisma.matchGoalEvent.findMany({
    where: { matchId: match.id },
    select: { teamId: true, scorerName: true, minuteBase: true, minuteExtra: true, goalType: true, player: { select: { fullName: true } } },
  });
  const existingGoalKeys = new Set(
    existingGoals.map(
      (goal) =>
        `${goal.teamId}|${goal.player?.fullName ?? goal.scorerName ?? ""}|${goal.minuteBase}|${goal.minuteExtra ?? 0}|${goal.goalType}`
    )
  );

  return prisma.$transaction(async (tx) => {
    const updatedMatch = await tx.match.update({
      where: { id: match.id },
      data: {
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        regularTimeMinutes: payload.regularTimeMinutes,
        status: match.status === "SCHEDULED" ? "FINISHED" : match.status,
      },
    });

    await tx.matchGoalEvent.deleteMany({ where: { matchId: match.id } });
    if (payload.goalEvents.length) {
      await tx.matchGoalEvent.createMany({
        data: payload.goalEvents.map((event) => ({
          matchId: match.id,
          teamId: event.teamId,
          playerId: event.playerId ?? null,
          scorerName: event.scorerName?.trim() || null,
          minuteBase: event.minuteBase,
          minuteExtra: event.minuteExtra ?? null,
          goalType: event.goalType,
          createdById: actor.id,
        })),
      });
    }

    await tx.matchTeamStats.upsert({
      where: { matchId_teamId: { matchId: match.id, teamId: match.homeTeamId } },
      update: {
        possessionPercent: possession.home,
        possessionSeconds: homeTeamStats.possessionSeconds,
        totalShots: homeTeamStats.totalShots,
        shotsOnTarget: homeTeamStats.shotsOnTarget,
        shotsOffTarget: homeTeamStats.shotsOffTarget,
        totalPasses: homeTeamStats.totalPasses,
        accuratePasses: homeTeamStats.accuratePasses,
        inaccuratePasses: homeTeamStats.inaccuratePasses,
        corners: homeTeamStats.corners,
        fouls: homeTeamStats.fouls,
        yellowCards: homeTeamStats.yellowCards,
        redCards: homeTeamStats.redCards,
      },
      create: {
        matchId: match.id,
        teamId: match.homeTeamId,
        possessionPercent: possession.home,
        possessionSeconds: homeTeamStats.possessionSeconds,
        totalShots: homeTeamStats.totalShots,
        shotsOnTarget: homeTeamStats.shotsOnTarget,
        shotsOffTarget: homeTeamStats.shotsOffTarget,
        totalPasses: homeTeamStats.totalPasses,
        accuratePasses: homeTeamStats.accuratePasses,
        inaccuratePasses: homeTeamStats.inaccuratePasses,
        corners: homeTeamStats.corners,
        fouls: homeTeamStats.fouls,
        yellowCards: homeTeamStats.yellowCards,
        redCards: homeTeamStats.redCards,
        createdById: actor.id,
      },
    });

    await tx.matchTeamStats.upsert({
      where: { matchId_teamId: { matchId: match.id, teamId: match.awayTeamId } },
      update: {
        possessionPercent: possession.away,
        possessionSeconds: awayTeamStats.possessionSeconds,
        totalShots: awayTeamStats.totalShots,
        shotsOnTarget: awayTeamStats.shotsOnTarget,
        shotsOffTarget: awayTeamStats.shotsOffTarget,
        totalPasses: awayTeamStats.totalPasses,
        accuratePasses: awayTeamStats.accuratePasses,
        inaccuratePasses: awayTeamStats.inaccuratePasses,
        corners: awayTeamStats.corners,
        fouls: awayTeamStats.fouls,
        yellowCards: awayTeamStats.yellowCards,
        redCards: awayTeamStats.redCards,
      },
      create: {
        matchId: match.id,
        teamId: match.awayTeamId,
        possessionPercent: possession.away,
        possessionSeconds: awayTeamStats.possessionSeconds,
        totalShots: awayTeamStats.totalShots,
        shotsOnTarget: awayTeamStats.shotsOnTarget,
        shotsOffTarget: awayTeamStats.shotsOffTarget,
        totalPasses: awayTeamStats.totalPasses,
        accuratePasses: awayTeamStats.accuratePasses,
        inaccuratePasses: awayTeamStats.inaccuratePasses,
        corners: awayTeamStats.corners,
        fouls: awayTeamStats.fouls,
        yellowCards: awayTeamStats.yellowCards,
        redCards: awayTeamStats.redCards,
        createdById: actor.id,
      },
    });

    if (match.status === "LIVE") {
      const withTeams = await tx.match.findUnique({
        where: { id: match.id },
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      });

      if (withTeams) {
        for (const goal of payload.goalEvents) {
          const scorerName = goal.scorerName?.trim() || "Unknown scorer";
          const key = `${goal.teamId}|${scorerName}|${goal.minuteBase}|${goal.minuteExtra ?? 0}|${goal.goalType}`;
          if (existingGoalKeys.has(key)) continue;
          await notifyFavoriteMatchGoal({
            matchId: match.id,
            homeTeam: withTeams.homeTeam.name,
            awayTeam: withTeams.awayTeam.name,
            teamName: goal.teamId === withTeams.homeTeam.id ? withTeams.homeTeam.name : withTeams.awayTeam.name,
            scorerName,
            minuteBase: goal.minuteBase,
            minuteExtra: goal.minuteExtra,
            regularTimeMinutes: match.regularTimeMinutes,
            dedupeSuffix: key,
          });
        }
      }
    }

    if (match.status !== "FINISHED" && updatedMatch.status === "FINISHED") {
      const withTeams = await tx.match.findUnique({
        where: { id: match.id },
        include: {
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      });
      if (withTeams) {
        await notifyFavoriteMatchFinished({
          matchId: withTeams.id,
          homeTeam: withTeams.homeTeam.name,
          awayTeam: withTeams.awayTeam.name,
          homeScore: updatedMatch.homeScore,
          awayScore: updatedMatch.awayScore,
        });
      }
    }

    await syncDrawKnockoutProgress(tx, {
      id: updatedMatch.id,
      drawId: (updatedMatch as typeof updatedMatch & { drawId?: string | null }).drawId ?? null,
      stage: (updatedMatch as typeof updatedMatch & { stage?: string | null }).stage ?? null,
      round: updatedMatch.round ?? null,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: updatedMatch.homeScore,
      awayScore: updatedMatch.awayScore,
      status: updatedMatch.status,
    });

    return updatedMatch;
  });
}

export async function resetMatchDetails(organizationId: string, actor: { id: string; role: string }, matchId: string) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, competition: { organizationId } },
    select: { id: true, createdById: true },
  });

  if (!match) return null;
  if (!canEditEntity(actor, match)) throw new Error("Forbidden");

  return prisma.$transaction(async (tx) => {
    await tx.matchGoalEvent.deleteMany({ where: { matchId } });
    await tx.matchTeamStats.deleteMany({ where: { matchId } });
    return tx.match.update({
      where: { id: matchId },
      data: {
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
      },
    });
  });
}
