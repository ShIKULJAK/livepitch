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

type GroupFixtureSeed = {
  drawGroupId: string;
  groupName: string;
  homeTeamId: string;
  awayTeamId: string;
  groupOrder: number;
  seedOrder: number;
};

type GenerationMatchDuration = {
  generationLabel: string;
  matchDurationMinutes: number;
};

function resolveGenerationMatchDuration(
  generationMatchDurations: unknown,
  generationYear: number | null | undefined,
  fallback: number
) {
  if (!generationYear || !Array.isArray(generationMatchDurations)) return fallback;
  const generationLabel = `Generacija ${generationYear}`;
  const entry = (generationMatchDurations as GenerationMatchDuration[]).find(
    (item) =>
      item &&
      typeof item.generationLabel === "string" &&
      item.generationLabel.trim() === generationLabel &&
      typeof item.matchDurationMinutes === "number" &&
      Number.isFinite(item.matchDurationMinutes)
  );
  if (!entry) return fallback;
  return Math.max(1, Math.min(240, Math.round(entry.matchDurationMinutes)));
}

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

function createGroupFixtures(groupId: string, groupName: string, teamIds: string[], groupOrder: number) {
  const fixtures: GroupFixtureSeed[] = [];
  let seedOrder = 0;
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      fixtures.push({
        drawGroupId: groupId,
        groupName,
        homeTeamId: teamIds[i],
        awayTeamId: teamIds[j],
        groupOrder,
        seedOrder: seedOrder + 1,
      });
      seedOrder += 1;
    }
  }
  return fixtures;
}

function interleaveGroupFixtures(fixtures: GroupFixtureSeed[]) {
  const byGroup = new Map<string, GroupFixtureSeed[]>();
  for (const fixture of fixtures) {
    const key = fixture.drawGroupId;
    const list = byGroup.get(key) ?? [];
    list.push(fixture);
    byGroup.set(key, list);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => a.seedOrder - b.seedOrder);
  }

  const groupIds = Array.from(byGroup.keys()).sort((a, b) => {
    const aOrder = byGroup.get(a)?.[0]?.groupOrder ?? 0;
    const bOrder = byGroup.get(b)?.[0]?.groupOrder ?? 0;
    return aOrder - bOrder;
  });
  const result: GroupFixtureSeed[] = [];
  const recentTeams: string[] = [];
  let cursor = 0;

  while (result.length < fixtures.length) {
    let selected: { groupId: string; fixture: GroupFixtureSeed } | null = null;

    for (let scan = 0; scan < groupIds.length; scan += 1) {
      const groupId = groupIds[(cursor + scan) % groupIds.length];
      const queue = byGroup.get(groupId);
      if (!queue?.length) continue;
      const candidate = queue.find(
        (item) =>
          !recentTeams.includes(item.homeTeamId) &&
          !recentTeams.includes(item.awayTeamId)
      );
      if (candidate) {
        selected = { groupId, fixture: candidate };
        cursor = (cursor + scan + 1) % groupIds.length;
        break;
      }
    }

    if (!selected) {
      for (let scan = 0; scan < groupIds.length; scan += 1) {
        const groupId = groupIds[(cursor + scan) % groupIds.length];
        const queue = byGroup.get(groupId);
        if (!queue?.length) continue;
        selected = { groupId, fixture: queue[0] };
        cursor = (cursor + scan + 1) % groupIds.length;
        break;
      }
    }

    if (!selected) break;
    const queue = byGroup.get(selected.groupId)!;
    const index = queue.findIndex(
      (item) =>
        item.drawGroupId === selected?.fixture.drawGroupId &&
        item.homeTeamId === selected?.fixture.homeTeamId &&
        item.awayTeamId === selected?.fixture.awayTeamId &&
        item.seedOrder === selected?.fixture.seedOrder
    );
    queue.splice(index >= 0 ? index : 0, 1);
    result.push(selected.fixture);

    recentTeams.push(selected.fixture.homeTeamId, selected.fixture.awayTeamId);
    while (recentTeams.length > 4) recentTeams.shift();
  }

  return result;
}

function buildScheduledFixtures(
  fixtures: GroupFixtureSeed[],
  pitchNames: string[],
  startAt: Date,
  scheduleDays: Array<{ dayLabel: string; dayDate?: string; startTime: string; endTime: string; pitchName?: string | null }>,
  slotDurationMinutes: number,
  occupiedIntervalsByPitch: Map<string, Array<{ startAt: number; endAt: number }>> = new Map()
) {
  const ordered = interleaveGroupFixtures(fixtures);
  const slotMs = slotDurationMinutes * 60 * 1000;
  const normalizedPitches = pitchNames.length ? pitchNames : ["Teren 1"];
  const effectiveDays =
    scheduleDays.length > 0 ? scheduleDays : [{ dayLabel: "Dan 1", startTime: "09:00", endTime: "19:00" }];
  const fallbackWindow = {
    startTime: effectiveDays[effectiveDays.length - 1]?.startTime ?? "09:00",
    endTime: effectiveDays[effectiveDays.length - 1]?.endTime ?? "19:00",
  };

  const dayStarts = effectiveDays.map((day, index) => {
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    const base =
      day.dayDate && /^\d{4}-\d{2}-\d{2}$/.test(day.dayDate)
        ? new Date(`${day.dayDate}T00:00:00.000Z`)
        : (() => {
            const fallback = new Date(startAt);
            fallback.setHours(0, 0, 0, 0);
            fallback.setDate(fallback.getDate() + index);
            return fallback;
          })();
    const startTs = new Date(base);
    startTs.setHours(sh, sm, 0, 0);
    const endTs = new Date(base);
    endTs.setHours(eh, em, 0, 0);
    return { startTs: startTs.getTime(), endTs: endTs.getTime(), pitchName: day.pitchName ?? null };
  });

  const pitchState = dayStarts.flatMap((day, dayIndex) => {
    const scopedPitches =
      day.pitchName && day.pitchName.trim().length > 0
        ? [day.pitchName.trim()]
        : [];
    return scopedPitches.map((pitchName) => ({
      pitchName,
      dayIndex,
      nextStartAt: day.startTs,
    }));
  });
  const lastPlayedAt = new Map<string, number>();
  const dayMatchCounts = dayStarts.map(() => 0);
  const scheduled: Array<{ fixture: GroupFixtureSeed; pitchName: string; scheduledAt: Date }> = [];
  const pending = [...ordered];
  if (!pitchState.length) {
    throw new Error("Za odabranu generaciju nisu definisani tereni u Dani i satnica.");
  }

  const findOverlap = (pitchName: string, startAt: number, endAt: number) => {
    const intervals = occupiedIntervalsByPitch.get(pitchName) ?? [];
    return intervals.find((interval) => startAt < interval.endAt && endAt > interval.startAt) ?? null;
  };

  const advancePitch = (state: { pitchName: string; dayIndex: number; nextStartAt: number }) => {
    if (state.dayIndex >= dayStarts.length) return;
    const day = dayStarts[state.dayIndex];
    while (state.nextStartAt + slotMs <= day.endTs) {
      const overlap = findOverlap(state.pitchName, state.nextStartAt, state.nextStartAt + slotMs);
      if (!overlap) return;
      state.nextStartAt = overlap.endAt;
    }
    state.dayIndex = dayStarts.length;
  };

  while (pending.length) {
    for (const state of pitchState) advancePitch(state);
    const available = pitchState.filter((state) => state.dayIndex < dayStarts.length);
    if (!available.length) {
      throw new Error("Nema dovoljno satnice za sve grupne utakmice. Dodaj još termina za ovu generaciju (datum/teren/satnica).");
    }
    const dayIndexes = Array.from(new Set(available.map((state) => state.dayIndex)));
    const minCount = Math.min(...dayIndexes.map((index) => dayMatchCounts[index] ?? 0));
    const leastUsedDays = dayIndexes.filter((index) => (dayMatchCounts[index] ?? 0) === minCount);
    const selectedDay = leastUsedDays[Math.floor(Math.random() * leastUsedDays.length)];
    const dayPitches = available
      .filter((state) => state.dayIndex === selectedDay)
      .sort((a, b) => a.nextStartAt - b.nextStartAt || a.pitchName.localeCompare(b.pitchName));
    const pitch = dayPitches[0] ?? available[0];
    const slotTime = pitch.nextStartAt;

    const candidates = pending
      .map((fixture, index) => ({ fixture, index }))
      .filter(({ fixture }) => {
        const homeLast = lastPlayedAt.get(fixture.homeTeamId);
        const awayLast = lastPlayedAt.get(fixture.awayTeamId);
        const noOverlapHome = homeLast === undefined || slotTime - homeLast >= slotMs;
        const noOverlapAway = awayLast === undefined || slotTime - awayLast >= slotMs;
        return noOverlapHome && noOverlapAway;
      });

    const pool = candidates.length ? candidates : pending.map((fixture, index) => ({ fixture, index }));
    pool.sort((a, b) => {
      const aHomeLast = lastPlayedAt.get(a.fixture.homeTeamId) ?? -Infinity;
      const aAwayLast = lastPlayedAt.get(a.fixture.awayTeamId) ?? -Infinity;
      const bHomeLast = lastPlayedAt.get(b.fixture.homeTeamId) ?? -Infinity;
      const bAwayLast = lastPlayedAt.get(b.fixture.awayTeamId) ?? -Infinity;
      const aRest = Math.min(slotTime - aHomeLast, slotTime - aAwayLast);
      const bRest = Math.min(slotTime - bHomeLast, slotTime - bAwayLast);
      if (bRest !== aRest) return bRest - aRest;
      if (a.fixture.groupOrder !== b.fixture.groupOrder) return a.fixture.groupOrder - b.fixture.groupOrder;
      return a.fixture.seedOrder - b.fixture.seedOrder;
    });

    const chosen = pool[0];
    scheduled.push({
      fixture: chosen.fixture,
      pitchName: pitch.pitchName,
      scheduledAt: new Date(slotTime),
    });
    pending.splice(chosen.index, 1);
    lastPlayedAt.set(chosen.fixture.homeTeamId, slotTime);
    lastPlayedAt.set(chosen.fixture.awayTeamId, slotTime);
    dayMatchCounts[pitch.dayIndex] = (dayMatchCounts[pitch.dayIndex] ?? 0) + 1;
    const intervals = occupiedIntervalsByPitch.get(pitch.pitchName) ?? [];
    intervals.push({ startAt: slotTime, endAt: slotTime + slotMs });
    occupiedIntervalsByPitch.set(pitch.pitchName, intervals);
    pitch.nextStartAt = slotTime + slotMs;
  }

  return scheduled;
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
      homeSourceValue: `${winners[index].sourceValue}1`,
      awaySourceType: runners[index + 1].sourceType,
      awaySourceValue: `${runners[index + 1].sourceValue}2`,
    });

    if (pairs.length < matchCount) {
      pairs.push({
        homeSourceType: winners[index + 1].sourceType,
        homeSourceValue: `${winners[index + 1].sourceValue}1`,
        awaySourceType: runners[index].sourceType,
        awaySourceValue: `${runners[index].sourceValue}2`,
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
      season: { select: { id: true, name: true } },
      teams: {
        include: { team: { select: { id: true, name: true, sport: true, profileImageUrl: true } } },
      },
      teamGenerations: {
        where: { isApproved: true },
        select: {
          teamId: true,
          generationYear: true,
          team: { select: { id: true, name: true, profileImageUrl: true } },
        },
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
      season: { select: { id: true, name: true } },
      teams: { include: { team: { select: { id: true, name: true } } } },
      teamGenerations: { where: { isApproved: true }, select: { teamId: true, generationYear: true } },
      draws: { select: { id: true, updatedAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return competitions.map((competition) => ({
    id: competition.id,
    createdById: competition.createdById,
    name: competition.name,
    type: competition.type,
    seasonId: competition.seasonId,
    seasonLabel: competition.season?.name ?? null,
    sport: competition.sport,
    status: competition.status,
    participantsCount: competition.teams.length,
    participants: competition.teams.map((entry) => entry.team),
    generationYears: Array.from(new Set(competition.teamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a),
    hasDraw: Boolean(competition.draws[0]),
    drawUpdatedAt: competition.draws[0]?.updatedAt ?? null,
  }));
}

export async function getDrawByCompetition(organizationId: string, competitionId: string, generationYear?: number) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  const scopedTeamGenerations = competition.teamGenerations;
  const availableGenerationYears = Array.from(new Set(competition.teamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a);
  const selectedGenerationYear =
    generationYear && availableGenerationYears.includes(generationYear)
      ? generationYear
      : availableGenerationYears[0] ?? null;

  const draw =
    selectedGenerationYear == null
      ? null
      : await prisma.draw.findUnique({
          where: {
            competitionId_generationYear: {
              competitionId: competition.id,
              generationYear: selectedGenerationYear,
            },
          },
          include: {
            groups: {
              include: {
                teams: { include: { team: { select: { id: true, name: true, profileImageUrl: true } } }, orderBy: { position: "asc" } },
              },
              orderBy: { order: "asc" },
            },
            knockoutRounds: {
              include: {
                matches: {
                  include: {
                    homeTeam: { select: { id: true, name: true, profileImageUrl: true } },
                    awayTeam: { select: { id: true, name: true, profileImageUrl: true } },
                    winnerTeam: { select: { id: true, name: true, profileImageUrl: true } },
                  },
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
            matches: {
              where: { stage: "GROUP_STAGE" },
              include: {
                homeTeam: { select: { id: true, name: true, profileImageUrl: true } },
                awayTeam: { select: { id: true, name: true, profileImageUrl: true } },
              },
              orderBy: { scheduledAt: "asc" },
            },
          },
        });

  const participantsByGeneration = new Map<number, Array<{ id: string; name: string; profileImageUrl: string | null }>>();
  for (const item of scopedTeamGenerations) {
    const list = participantsByGeneration.get(item.generationYear) ?? [];
    if (!list.some((entry) => entry.id === item.team.id)) {
      list.push(item.team);
    }
    participantsByGeneration.set(item.generationYear, list);
  }

  return {
    competition: {
      id: competition.id,
      createdById: competition.createdById,
      name: competition.name,
      type: competition.type,
      sport: competition.sport,
      seasonId: competition.seasonId,
      seasonLabel: competition.season?.name ?? null,
      matchDurationMinutes: competition.matchDurationMinutes,
      participants:
        selectedGenerationYear == null
          ? []
          : (participantsByGeneration.get(selectedGenerationYear) ?? []),
      availableGenerationYears,
      selectedGenerationYear,
    },
    draw: draw
      ? {
          ...draw,
          groupMatches: draw.matches,
        }
      : null,
  };
}

export async function resetDraw(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  generationYear?: number
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (competition.type !== CompetitionType.TOURNAMENT) {
    return { ok: true };
  }

  const drawIds =
    generationYear == null
      ? (
          await prisma.draw.findMany({
            where: { competitionId },
            select: { id: true },
          })
        ).map((item) => item.id)
      : (
          await prisma.draw.findMany({
            where: { competitionId, generationYear },
            select: { id: true },
          })
        ).map((item) => item.id);

  if (drawIds.length) {
    await prisma.match.deleteMany({
      where: {
        competitionId,
        drawId: { in: drawIds },
      },
    });
  }
  await prisma.draw.deleteMany({ where: { competitionId, ...(generationYear == null ? {} : { generationYear }) } });
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

  const scopedTeamGenerations = competition.teamGenerations;
  const availableGenerationYears = Array.from(new Set(scopedTeamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a);
  const generationYear = config.generationYear ?? availableGenerationYears[0];
  if (!generationYear) {
    throw new Error("Nema odobrenih generacija za izvlačenje.");
  }
  const participants = scopedTeamGenerations
    .filter((item) => item.generationYear === generationYear)
    .map((item) => ({ id: item.team.id, name: item.team.name }))
    .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index);
  if (!participants.length) {
    throw new Error("Nema učesnika za odabranu generaciju.");
  }

  if (config.groupStageEnabled && config.groupsCount > participants.length) {
    throw new Error("Groups count cannot exceed participants count.");
  }

  const existingDraw = await prisma.draw.findUnique({
    where: {
      competitionId_generationYear: {
        competitionId,
        generationYear,
      },
    },
  });
  if (existingDraw) {
    throw new Error("Draw already exists for this competition. Reset draw before regenerating.");
  }

  const existingGeneratedGroupMatches = await prisma.match.count({
    where: {
      competitionId,
      stage: "GROUP_STAGE",
      drawId: { not: null },
      generationYear,
    },
  });
  if (existingGeneratedGroupMatches > 0) {
    throw new Error("Group-stage matches already exist. Reset draw before regenerating.");
  }

  return prisma.$transaction(async (tx) => {
    const draw = await tx.draw.create({
      data: {
        competitionId,
        generationYear,
        createdById: actor.id,
        groupStageEnabled: config.groupStageEnabled,
        groupsCount: config.groupStageEnabled ? config.groupsCount : 0,
        roundOf16Enabled: config.roundOf16Enabled,
        quarterfinalsEnabled: config.quarterfinalsEnabled,
        thirdPlaceMatchEnabled: config.thirdPlaceMatchEnabled,
      },
    });

    const createdGroups: Array<{ id: string; name: string; teamIds: string[]; order: number }> = [];
    if (config.groupStageEnabled) {
      const groups = distributeParticipants(participants, config.groupsCount);
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const createdGroup = await tx.drawGroup.create({
          data: { drawId: draw.id, name: group.name, order: index + 1 },
        });
        createdGroups.push({
          id: createdGroup.id,
          name: createdGroup.name,
          teamIds: group.teams.map((team) => team.id),
          order: index + 1,
        });

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

    if (config.groupStageEnabled) {
      const placeholderBaseDate = competition.startDate ?? new Date();
      const fixtures = createdGroups.flatMap((group) =>
        createGroupFixtures(group.id, group.name, group.teamIds, group.order)
      );
      const pitchNames =
        competition.pitchNames && competition.pitchNames.length
          ? competition.pitchNames
          : ["Teren 1"];
      const scheduleDays =
        ((competition.scheduleDays as unknown as Array<{ dayLabel: string; dayDate?: string; generationLabel?: string; pitchId?: string | null; startTime: string; endTime: string }> | null) ?? [
          { dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), pitchId: null, startTime: "09:00", endTime: "19:00" },
        ]).filter((day) => day.dayLabel && day.startTime && day.endTime);
      const generationLabel = `Generacija ${generationYear}`;
      const generationScheduleDays = scheduleDays.filter((day) => day.generationLabel === generationLabel);
      if (!generationScheduleDays.length) {
        throw new Error(`Nema definisanih termina za ${generationLabel}.`);
      }
      const effectiveScheduleDays = generationScheduleDays;
      const dayPitchIds = Array.from(new Set(effectiveScheduleDays.map((day) => day.pitchId).filter((value): value is string => Boolean(value))));
      if (!dayPitchIds.length) {
        throw new Error(`Za ${generationLabel} moraš odabrati teren(e) u Dani i satnica.`);
      }
      const selectedPitches = dayPitchIds.length
        ? await tx.pitch.findMany({ where: { id: { in: dayPitchIds }, organizationId, isActive: true }, select: { id: true, name: true } })
        : [];
      const selectedPitchNames = selectedPitches.map((item) => item.name);
      if (!selectedPitchNames.length) {
        throw new Error(`Nije pronađen nijedan aktivan teren za ${generationLabel}.`);
      }
      const effectivePitchNames = selectedPitchNames;
      const pitchById = new Map(selectedPitches.map((pitch) => [pitch.id, pitch.name]));
      const scheduleWithPitch = effectiveScheduleDays.map((day) => ({
        ...day,
        pitchName: day.pitchId ? pitchById.get(day.pitchId) ?? null : null,
      }));
      const generationMatchDurationMinutes = resolveGenerationMatchDuration(
        competition.generationMatchDurations,
        generationYear,
        competition.matchDurationMinutes
      );
      const slotDurationMinutes = generationMatchDurationMinutes + 5;
      const existingMatches = await tx.match.findMany({
        where: {
          competitionId: competition.id,
          pitchName: { in: effectivePitchNames },
          status: { not: "CANCELED" },
        },
        select: {
          pitchName: true,
          scheduledAt: true,
          regularTimeMinutes: true,
        },
      });
      const occupiedIntervalsByPitch = new Map<string, Array<{ startAt: number; endAt: number }>>();
      for (const match of existingMatches) {
        if (!match.pitchName) continue;
        const startAt = match.scheduledAt.getTime();
        const endAt = startAt + (match.regularTimeMinutes + 5) * 60 * 1000;
        const intervals = occupiedIntervalsByPitch.get(match.pitchName) ?? [];
        intervals.push({ startAt, endAt });
        occupiedIntervalsByPitch.set(match.pitchName, intervals);
      }

      const scheduledFixtures = buildScheduledFixtures(
        fixtures,
        effectivePitchNames,
        placeholderBaseDate,
        scheduleWithPitch,
        slotDurationMinutes,
        occupiedIntervalsByPitch
      );

      for (const scheduledFixture of scheduledFixtures) {
        const fixture = scheduledFixture.fixture;
        const venueLabel = competition.stadiumName
          ? `${competition.stadiumName} - ${scheduledFixture.pitchName}`
          : `Stadion - ${scheduledFixture.pitchName}`;
        await tx.match.create({
          data: {
            competitionId: competition.id,
            seasonId: competition.seasonId ?? null,
            drawId: draw.id,
            drawGroupId: fixture.drawGroupId,
            stage: "GROUP_STAGE",
            round: `Group ${fixture.groupName}`,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            status: "SCHEDULED",
            scheduledAt: scheduledFixture.scheduledAt,
            regularTimeMinutes: generationMatchDurationMinutes,
            pitchName: scheduledFixture.pitchName,
            venueLabel,
            createdById: actor.id,
            generationYear,
          },
        });
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

export async function swapDrawGroupTeams(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  generationYear: number,
  firstTeamId: string,
  secondTeamId: string
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (firstTeamId === secondTeamId) throw new Error("Odaberi dvije različite ekipe.");

  const draw = await prisma.draw.findUnique({
    where: {
      competitionId_generationYear: {
        competitionId,
        generationYear,
      },
    },
    select: { id: true },
  });
  if (!draw) throw new Error("Izvlačenje za odabranu generaciju ne postoji.");

  const groupEntries = await prisma.drawGroupTeam.findMany({
    where: {
      group: { drawId: draw.id },
      teamId: { in: [firstTeamId, secondTeamId] },
    },
    select: {
      id: true,
      teamId: true,
      groupId: true,
      position: true,
    },
  });

  const firstEntry = groupEntries.find((item) => item.teamId === firstTeamId);
  const secondEntry = groupEntries.find((item) => item.teamId === secondTeamId);
  if (!firstEntry || !secondEntry) {
    throw new Error("Obje ekipe moraju biti u grupama za odabranu generaciju.");
  }
  if (firstEntry.groupId === secondEntry.groupId) {
    throw new Error("Switch radi samo između različitih grupa.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.drawGroupTeam.update({
      where: { id: firstEntry.id },
      data: { teamId: secondTeamId, position: secondEntry.position ?? firstEntry.position ?? null },
    });
    await tx.drawGroupTeam.update({
      where: { id: secondEntry.id },
      data: { teamId: firstTeamId, position: firstEntry.position ?? secondEntry.position ?? null },
    });

    const affectedMatches = await tx.match.findMany({
      where: {
        competitionId,
        drawId: draw.id,
        stage: "GROUP_STAGE",
        generationYear,
        OR: [
          { homeTeamId: firstTeamId },
          { awayTeamId: firstTeamId },
          { homeTeamId: secondTeamId },
          { awayTeamId: secondTeamId },
        ],
      },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });

    for (const match of affectedMatches) {
      const nextHome =
        match.homeTeamId === firstTeamId
          ? secondTeamId
          : match.homeTeamId === secondTeamId
            ? firstTeamId
            : match.homeTeamId;
      const nextAway =
        match.awayTeamId === firstTeamId
          ? secondTeamId
          : match.awayTeamId === secondTeamId
            ? firstTeamId
            : match.awayTeamId;
      if (nextHome === nextAway) continue;
      await tx.match.update({
        where: { id: match.id },
        data: {
          homeTeamId: nextHome,
          awayTeamId: nextAway,
        },
      });
    }

    return { ok: true };
  });
}

