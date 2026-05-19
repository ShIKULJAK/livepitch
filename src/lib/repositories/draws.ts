import { CompetitionType, DrawRoundType, DrawSourceType } from "@prisma/client";
import { canEditEntity } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import type { DrawConfigInput } from "@/lib/validation/draw";

type Participant = { id: string; name: string };
type RoundMatchSeed = {
  homeSourceType: DrawSourceType;
  homeSourceValue: string;
  awaySourceType: DrawSourceType;
  awaySourceValue: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  order: number;
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function groupName(index: number) {
  return String.fromCharCode(65 + index);
}

function distributeParticipants(teams: Participant[], groupsCount: number) {
  const shuffled = shuffle(teams);
  const groups: Array<{ name: string; teams: Participant[] }> = [];
  const baseSize = Math.floor(shuffled.length / groupsCount);
  const remainder = shuffled.length % groupsCount;

  let offset = 0;
  for (let index = 0; index < groupsCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    groups.push({
      name: groupName(index),
      teams: shuffled.slice(offset, offset + size),
    });
    offset += size;
  }

  return groups;
}

function createRoundPairs(
  winners: Array<{ sourceType: DrawSourceType; sourceValue: string }>,
  runners: Array<{ sourceType: DrawSourceType; sourceValue: string }>,
  matchCount: number
) {
  const pairs: Array<{
    homeSourceType: DrawSourceType;
    homeSourceValue: string;
    awaySourceType: DrawSourceType;
    awaySourceValue: string;
  }> = [];

  let index = 0;
  while (pairs.length < matchCount && winners.length > index + 1 && runners.length > index + 1) {
    pairs.push({
      homeSourceType: winners[index].sourceType,
      homeSourceValue: winners[index].sourceValue,
      awaySourceType: runners[index + 1].sourceType,
      awaySourceValue: runners[index + 1].sourceValue,
    });

    if (pairs.length < matchCount) {
      pairs.push({
        homeSourceType: winners[index + 1].sourceType,
        homeSourceValue: winners[index + 1].sourceValue,
        awaySourceType: runners[index].sourceType,
        awaySourceValue: runners[index].sourceValue,
      });
    }
    index += 2;
  }

  while (pairs.length < matchCount) {
    pairs.push({
      homeSourceType: DrawSourceType.MATCH_WINNER,
      homeSourceValue: "TBD",
      awaySourceType: DrawSourceType.MATCH_WINNER,
      awaySourceValue: "TBD",
    });
  }

  return pairs.slice(0, matchCount);
}

function createDirectPairs(teams: Participant[], matchCount: number) {
  const shuffled = shuffle(teams);
  const pairs: Array<{
    homeSourceType: DrawSourceType;
    homeSourceValue: string;
    awaySourceType: DrawSourceType;
    awaySourceValue: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
  }> = [];

  for (let i = 0; i < matchCount; i += 1) {
    const home = shuffled[i * 2] ?? null;
    const away = shuffled[i * 2 + 1] ?? null;
    pairs.push({
      homeSourceType: DrawSourceType.DIRECT_TEAM,
      homeSourceValue: home?.name ?? "TBD",
      awaySourceType: DrawSourceType.DIRECT_TEAM,
      awaySourceValue: away?.name ?? "TBD",
      homeTeamId: home?.id ?? null,
      awayTeamId: away?.id ?? null,
    });
  }

  return pairs;
}

async function ensureCompetition(organizationId: string, competitionId: string) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    include: {
      teams: {
        include: { team: { select: { id: true, name: true, sport: true } } },
      },
      draws: { select: { id: true } },
    },
  });

  if (!competition) return null;
  return competition;
}

export async function listDrawCompetitions(organizationId: string) {
  const competitions = await prisma.competition.findMany({
    where: { organizationId },
    include: {
      teams: { include: { team: { select: { id: true, name: true } } } },
      draws: { select: { id: true, updatedAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return competitions.map((competition) => ({
    id: competition.id,
    createdById: competition.createdById,
    name: competition.name,
    type: competition.type,
    sport: competition.sport,
    status: competition.status,
    participantsCount: competition.teams.length,
    participants: competition.teams.map((entry) => entry.team),
    hasDraw: Boolean(competition.draws[0]),
    drawUpdatedAt: competition.draws[0]?.updatedAt ?? null,
  }));
}

export async function getDrawByCompetition(organizationId: string, competitionId: string) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;

  const draw = await prisma.draw.findUnique({
    where: { competitionId: competition.id },
    include: {
      groups: {
        include: {
          teams: { include: { team: { select: { id: true, name: true } } }, orderBy: { position: "asc" } },
        },
        orderBy: { order: "asc" },
      },
      knockoutRounds: {
        include: {
          matches: {
            include: {
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
              winnerTeam: { select: { id: true, name: true } },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  return {
    competition: {
      id: competition.id,
      createdById: competition.createdById,
      name: competition.name,
      type: competition.type,
      sport: competition.sport,
      matchDurationMinutes: competition.matchDurationMinutes,
      participants: competition.teams.map((entry) => entry.team),
    },
    draw,
  };
}

export async function resetDraw(organizationId: string, actor: { id: string; role: string }, competitionId: string) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (competition.type !== CompetitionType.TOURNAMENT) {
    return { ok: true };
  }

  await prisma.draw.deleteMany({ where: { competitionId } });
  return { ok: true };
}

export async function generateDraw(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  config: DrawConfigInput
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (competition.type !== CompetitionType.TOURNAMENT) {
    throw new Error("Draw generation is available only for tournament competitions.");
  }

  const participants = competition.teams.map((entry) => ({ id: entry.team.id, name: entry.team.name }));
  if (!participants.length) {
    throw new Error("Competition has no participants.");
  }

  if (config.groupStageEnabled && config.groupsCount > participants.length) {
    throw new Error("Groups count cannot exceed participants count.");
  }

  await prisma.draw.deleteMany({ where: { competitionId } });

  return prisma.$transaction(async (tx) => {
    const draw = await tx.draw.create({
      data: {
        competitionId,
        createdById: actor.id,
        groupStageEnabled: config.groupStageEnabled,
        groupsCount: config.groupStageEnabled ? config.groupsCount : 0,
        roundOf16Enabled: config.roundOf16Enabled,
        quarterfinalsEnabled: config.quarterfinalsEnabled,
        thirdPlaceMatchEnabled: config.thirdPlaceMatchEnabled,
      },
    });

    const createdGroups: Array<{ id: string; name: string }> = [];
    if (config.groupStageEnabled) {
      const groups = distributeParticipants(participants, config.groupsCount);
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const createdGroup = await tx.drawGroup.create({
          data: { drawId: draw.id, name: group.name, order: index + 1 },
        });
        createdGroups.push({ id: createdGroup.id, name: createdGroup.name });

        if (group.teams.length) {
          await tx.drawGroupTeam.createMany({
            data: group.teams.map((team, teamIndex) => ({
              groupId: createdGroup.id,
              teamId: team.id,
              position: teamIndex + 1,
            })),
          });
        }
      }
    }

    const rounds: Array<{ type: DrawRoundType; order: number; matches: RoundMatchSeed[] }> =
      [];

    if (config.roundOf16Enabled) {
      let matches: RoundMatchSeed[] = [];
      if (config.groupStageEnabled && createdGroups.length >= 2) {
        const winners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_WINNER, sourceValue: group.name }));
        const runners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_RUNNER_UP, sourceValue: group.name }));
        matches = createRoundPairs(winners, runners, 8).map((pair, index) => ({
          ...pair,
          order: index + 1,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        }));
      } else {
        matches = createDirectPairs(participants, 8).map((pair, index) => ({
          ...pair,
          order: index + 1,
          winnerTeamId: null,
        }));
      }

      rounds.push({ type: DrawRoundType.ROUND_OF_16, order: 1, matches });
      rounds.push({
        type: DrawRoundType.QUARTERFINAL,
        order: 2,
        matches: Array.from({ length: 4 }, (_, index) => ({
          order: index + 1,
          homeSourceType: DrawSourceType.MATCH_WINNER,
          homeSourceValue: `R16-${index * 2 + 1}`,
          awaySourceType: DrawSourceType.MATCH_WINNER,
          awaySourceValue: `R16-${index * 2 + 2}`,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        })),
      });
    } else if (config.quarterfinalsEnabled) {
      let matches: RoundMatchSeed[] = [];
      if (config.groupStageEnabled && createdGroups.length >= 2) {
        const winners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_WINNER, sourceValue: group.name }));
        const runners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_RUNNER_UP, sourceValue: group.name }));
        matches = createRoundPairs(winners, runners, 4).map((pair, index) => ({
          ...pair,
          order: index + 1,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        }));
      } else {
        matches = createDirectPairs(participants, 4).map((pair, index) => ({
          ...pair,
          order: index + 1,
          winnerTeamId: null,
        }));
      }

      rounds.push({ type: DrawRoundType.QUARTERFINAL, order: 1, matches });
    }

    const hasQuarter = rounds.some((round) => round.type === DrawRoundType.QUARTERFINAL);
    rounds.push({
      type: DrawRoundType.SEMIFINAL,
      order: hasQuarter ? rounds.length + 1 : 1,
      matches: Array.from({ length: 2 }, (_, index) => ({
        order: index + 1,
        homeSourceType: DrawSourceType.MATCH_WINNER,
        homeSourceValue: hasQuarter ? `QF-${index * 2 + 1}` : `Seed-${index * 2 + 1}`,
        awaySourceType: DrawSourceType.MATCH_WINNER,
        awaySourceValue: hasQuarter ? `QF-${index * 2 + 2}` : `Seed-${index * 2 + 2}`,
        homeTeamId: null,
        awayTeamId: null,
        winnerTeamId: null,
      })),
    });

    rounds.push({
      type: DrawRoundType.FINAL,
      order: rounds.length + 1,
      matches: [
        {
          order: 1,
          homeSourceType: DrawSourceType.MATCH_WINNER,
          homeSourceValue: "SF-1",
          awaySourceType: DrawSourceType.MATCH_WINNER,
          awaySourceValue: "SF-2",
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        },
      ],
    });

    if (config.thirdPlaceMatchEnabled) {
      rounds.push({
        type: DrawRoundType.THIRD_PLACE,
        order: rounds.length + 1,
        matches: [
          {
            order: 1,
            homeSourceType: DrawSourceType.MATCH_WINNER,
            homeSourceValue: "SF-1-LOSER",
            awaySourceType: DrawSourceType.MATCH_WINNER,
            awaySourceValue: "SF-2-LOSER",
            homeTeamId: null,
            awayTeamId: null,
            winnerTeamId: null,
          },
        ],
      });
    }

    for (const round of rounds) {
      const createdRound = await tx.drawKnockoutRound.create({
        data: {
          drawId: draw.id,
          roundType: round.type,
          order: round.order,
        },
      });
      await tx.drawKnockoutMatch.createMany({
        data: round.matches.map((match) => ({
          roundId: createdRound.id,
          ...match,
        })),
      });
    }

    return draw;
  });
}

