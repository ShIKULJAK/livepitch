import { CompetitionStatus, CompetitionType, MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canEditEntity } from "@/lib/permissions";
import { syncMaterializedKnockoutMatches } from "@/lib/repositories/matches";
import { getEffectiveMatchStatus } from "@/lib/utils/match-status";
import type { CreateCompetitionInput } from "@/lib/validation/competition";

const defaultOrganizationName = "FC Champion";

export async function ensureDefaultOrganization() {
  const existing = await prisma.organization.findFirst({ where: { name: defaultOrganizationName } });
  if (existing) return existing;

  return prisma.organization.create({
    data: {
      name: defaultOrganizationName,
      city: "Belgrade",
      country: "Serbia",
      website: "www.fcchampion.com",
      plan: "Pro",
    },
  });
}

export async function listCompetitions(
  organizationId: string,
  filters: { q?: string; type?: CompetitionType; status?: CompetitionStatus; seasonYear?: string }
) {
  const where: Prisma.CompetitionWhereInput = {
    organizationId,
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { location: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.seasonYear
      ? {
          season: {
            OR: [
              { name: filters.seasonYear },
              { name: { startsWith: `${filters.seasonYear}/` } },
            ],
          },
        }
      : {}),
  };

  const competitions = await prisma.competition.findMany({
    where,
    include: {
      venue: true,
      season: { select: { id: true, name: true } },
      matches: { select: { id: true, status: true } },
      teams: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return competitions.map((competition) => ({
    id: competition.id,
    createdById: competition.createdById,
    name: competition.name,
    type: competition.type,
    status: competition.status,
    location: competition.location ?? "TBD",
    sport: competition.sport,
    format: competition.format,
    startDate: competition.startDate,
    endDate: competition.endDate,
    matchDurationMinutes: competition.matchDurationMinutes,
    generationMatchDurations: normalizeGenerationMatchDurations(competition.generationMatchDurations),
    stadiumName: competition.stadiumName,
    pitchNames: competition.pitchNames,
    scheduleDays: normalizeScheduleDays(competition.scheduleDays),
    seasonId: competition.seasonId,
    seasonLabel: competition.season?.name ?? null,
    teamsCount: competition.teams.length || competition.teamCount || 0,
    matchesCount: competition.matches.length,
    liveMatches: competition.matches.filter((match) => match.status === "LIVE").length,
    createdAt: competition.createdAt,
  }));
}

function inferSeasonWindow(label: string) {
  const range = label.match(/^(\d{4})\/(\d{4})$/);
  if (range) {
    const startYear = Number(range[1]);
    const endYear = Number(range[2]);
    return {
      startDate: new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999)),
    };
  }

  const single = label.match(/^(\d{4})$/);
  if (single) {
    const year = Number(single[1]);
    return {
      startDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }

  return null;
}

function inferSeasonStartYear(label: string) {
  const range = label.match(/^(\d{4})\/\d{4}$/);
  if (range) return range[1];
  const single = label.match(/^(\d{4})$/);
  if (single) return single[1];
  return null;
}

export async function listCompetitionSeasons(organizationId: string) {
  const now = new Date();
  const seasons = await prisma.season.findMany({
    where: {
      organizationId,
      competitions: { some: {} },
    },
    include: {
      _count: { select: { competitions: true } },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  const withWindows = seasons.map((season) => {
    const inferred = inferSeasonWindow(season.name);
    const startDate = season.startDate ?? inferred?.startDate ?? null;
    const endDate = season.endDate ?? inferred?.endDate ?? null;
    const isActive = Boolean(startDate && endDate && startDate <= now && now <= endDate);
    return { season, startDate, endDate, isActive };
  });

  const active = withWindows
    .filter((item) => item.isActive)
    .sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0));

  const fallbackNewest = [...withWindows].sort((a, b) => {
    const aTime = a.startDate?.getTime() ?? 0;
    const bTime = b.startDate?.getTime() ?? 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.season.createdAt.getTime() - a.season.createdAt.getTime();
  });

  const defaultSeason = active[0] ?? fallbackNewest[0] ?? null;

  const yearsMap = new Map<
    string,
    {
      year: string;
      isActive: boolean;
      competitionsCount: number;
      latestStart: number;
      latestEnd: number;
    }
  >();

  for (const item of withWindows) {
    const year = inferSeasonStartYear(item.season.name);
    if (!year) continue;
    const prev = yearsMap.get(year);
    const startTs = item.startDate?.getTime() ?? 0;
    const endTs = item.endDate?.getTime() ?? 0;
    if (!prev) {
      yearsMap.set(year, {
        year,
        isActive: item.isActive,
        competitionsCount: item.season._count.competitions,
        latestStart: startTs,
        latestEnd: endTs,
      });
      continue;
    }
    yearsMap.set(year, {
      year,
      isActive: prev.isActive || item.isActive,
      competitionsCount: prev.competitionsCount + item.season._count.competitions,
      latestStart: Math.max(prev.latestStart, startTs),
      latestEnd: Math.max(prev.latestEnd, endTs),
    });
  }

  const years = Array.from(yearsMap.values()).sort((a, b) => Number(b.year) - Number(a.year));
  const defaultYear = defaultSeason ? inferSeasonStartYear(defaultSeason.season.name) : null;

  return {
    defaultSeasonYear: defaultYear,
    years: years.map((item) => ({
      year: item.year,
      isActive: item.isActive,
      competitionsCount: item.competitionsCount,
    })),
    seasons: withWindows.map((item) => ({
      id: item.season.id,
      label: item.season.name,
      startDate: item.startDate,
      endDate: item.endDate,
      competitionsCount: item.season._count.competitions,
      isActive: item.isActive,
    })),
  };
}

function sanitizeCompetitionInput(input: CreateCompetitionInput) {
  const parseDate = (value?: string | null) => (value ? new Date(value) : null);
  const participantTeamIds = Array.from(new Set(input.participantTeamIds ?? []));
  const normalizedPitchNames = Array.from(new Set((input.pitchNames ?? []).map((name) => name.trim()).filter(Boolean)));
  const normalizedGenerationMatchDurations = Array.from(
    new Map(
      (input.generationMatchDurations ?? [])
        .filter((item) => item.generationLabel?.trim())
        .map((item) => [
          item.generationLabel.trim(),
          {
            generationLabel: item.generationLabel.trim(),
            matchDurationMinutes: item.matchDurationMinutes,
          },
        ])
    ).values()
  );

  return {
    ...input,
    description: input.description ?? null,
    notes: input.notes ?? null,
    location: input.location ?? null,
    startDate: parseDate(input.startDate),
    endDate: parseDate(input.endDate),
    registrationDeadline: parseDate(input.registrationDeadline),
    entryFee: input.entryFee ?? null,
    format:
      input.type === "FRIENDLY_MATCH"
        ? "Single Match"
        : (input.format ?? (input.type === "LEAGUE" ? "Round Robin" : "Knockout + Group Stage")),
    maxTeams: input.type === "FRIENDLY_MATCH" ? 2 : input.maxTeams ?? input.teamCount ?? null,
    teamCount: input.type === "FRIENDLY_MATCH" ? 2 : input.teamCount ?? null,
    teamSize: input.type === "FRIENDLY_MATCH" ? 11 : input.teamSize ?? null,
    substitutions: input.type === "FRIENDLY_MATCH" ? 5 : input.substitutions ?? null,
    matchDurationMinutes: input.matchDurationMinutes ?? 90,
    generationMatchDurations: normalizedGenerationMatchDurations,
    stadiumName: input.type === "TOURNAMENT" ? (input.stadiumName?.trim() ?? null) : null,
    pitchNames: input.type === "TOURNAMENT" ? normalizedPitchNames : [],
    scheduleDays: (input.type === "TOURNAMENT" || input.type === "LEAGUE" ? input.scheduleDays ?? [] : []).map((day) => ({
      dayLabel: day.dayLabel.trim(),
      dayDate: day.dayDate,
      generationLabel: day.generationLabel,
      stageScope:
        day.stageScope === "GROUP_STAGE" || day.stageScope === "KNOCKOUT" || day.stageScope === "ALL"
          ? day.stageScope
          : "ALL",
      pitchId: day.pitchId ?? null,
      startTime: day.startTime,
      endTime: day.endTime,
    })),
    visibility: input.visibility ?? "public",
    participantTeamIds,
    seasonLabel: input.seasonLabel.trim(),
  };
}

type ScheduleDayRaw = {
  dayLabel?: string;
  dayDate?: string;
  generationLabel?: string;
  stageScope?: "ALL" | "GROUP_STAGE" | "KNOCKOUT" | string;
  pitchId?: string | null;
  startTime?: string;
  endTime?: string;
};
type GenerationMatchDurationRaw = { generationLabel?: string; matchDurationMinutes?: number };

function resolveGroupSourceKey(sourceValue: string) {
  const match = sourceValue.trim().match(/^([A-Z]+)\s*[12]$/i);
  return match ? match[1].toUpperCase() : sourceValue.trim().toUpperCase();
}

function computeDrawGroupStandings(input: {
  teams: Array<{ id: string; name: string; profileImageUrl: string | null; position: number | null }>;
  matches: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }>;
}) {
  const table = new Map(
    input.teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        teamName: team.name,
        profileImageUrl: team.profileImageUrl,
        seedPosition: team.position,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        wins: 0,
      },
    ])
  );

  for (const match of input.matches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away) continue;

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.points += 3;
      home.wins += 1;
    } else if (match.homeScore < match.awayScore) {
      away.points += 3;
      away.wins += 1;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const goalDiffA = a.goalsFor - a.goalsAgainst;
    const goalDiffB = b.goalsFor - b.goalsAgainst;
    if (goalDiffB !== goalDiffA) return goalDiffB - goalDiffA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const seedA = a.seedPosition ?? Number.MAX_SAFE_INTEGER;
    const seedB = b.seedPosition ?? Number.MAX_SAFE_INTEGER;
    if (seedA !== seedB) return seedA - seedB;
    return a.teamName.localeCompare(b.teamName);
  });
}

function buildKnockoutMaterializationKey(drawId: string, stage: string, round: string) {
  return `${drawId}::${stage}::${round}`;
}

function isKnockoutStage(stage: string | null | undefined) {
  return stage === "ROUND_OF_16" || stage === "QUARTERFINAL" || stage === "SEMIFINAL" || stage === "FINAL" || stage === "THIRD_PLACE";
}

function formatCompetitionPhase(input: { stage?: string | null; round?: string | null; knockoutRoundType?: string | null }) {
  if (input.stage === "GROUP_STAGE" && input.round) {
    const match = input.round.match(/^group\s+([a-z0-9]+)/i);
    if (match) return `Grupa ${match[1].toUpperCase()}`;
    return input.round;
  }

  const knockoutType = input.knockoutRoundType ?? input.stage;
  if (knockoutType === "ROUND_OF_16") return "1/8 finale";
  if (knockoutType === "QUARTERFINAL") return "1/4 finale";
  if (knockoutType === "SEMIFINAL") return "1/2 finale";
  if (knockoutType === "FINAL") return "FINALE";
  if (knockoutType === "THIRD_PLACE") return "UTAKMICA ZA 3. MJESTO";

  return input.round ?? "-";
}

function normalizeScheduleDays(value: unknown) {
  const fallback = [{ dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), generationLabel: "Sve generacije", stageScope: "ALL" as const, pitchId: null, startTime: "09:00", endTime: "19:00" }];
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .map((day) => day as ScheduleDayRaw)
    .filter((day) => typeof day.dayLabel === "string" && typeof day.startTime === "string" && typeof day.endTime === "string")
    .map((day) => ({
      dayLabel: day.dayLabel!.trim(),
      dayDate: typeof day.dayDate === "string" && day.dayDate.trim().length > 0 ? day.dayDate : new Date().toISOString().slice(0, 10),
      generationLabel:
        typeof day.generationLabel === "string" && day.generationLabel.trim().length > 0 ? day.generationLabel : "Sve generacije",
      stageScope:
        (day.stageScope === "GROUP_STAGE" || day.stageScope === "KNOCKOUT" || day.stageScope === "ALL" ? day.stageScope : "ALL") as
          | "ALL"
          | "GROUP_STAGE"
          | "KNOCKOUT",
      pitchId: typeof day.pitchId === "string" && day.pitchId.trim().length > 0 ? day.pitchId : null,
      startTime: day.startTime!,
      endTime: day.endTime!,
    }));

  return normalized.length ? normalized : fallback;
}

function normalizeGenerationMatchDurations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as GenerationMatchDurationRaw)
    .filter(
      (item) =>
        typeof item.generationLabel === "string" &&
        /^Generacija \d{4}$/.test(item.generationLabel.trim()) &&
        typeof item.matchDurationMinutes === "number" &&
        Number.isFinite(item.matchDurationMinutes)
    )
    .map((item) => ({
      generationLabel: item.generationLabel!.trim(),
      matchDurationMinutes: Math.max(1, Math.min(240, Math.round(item.matchDurationMinutes!))),
    }));
}

async function resolveOrCreateSeason(
  tx: Prisma.TransactionClient,
  organizationId: string,
  seasonLabel: string,
  startDate?: Date | null,
  endDate?: Date | null
) {
  const existing = await tx.season.findFirst({
    where: { organizationId, name: seasonLabel },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  const defaultStart = startDate ?? new Date(`${seasonLabel.slice(0, 4)}-01-01T00:00:00.000Z`);
  const defaultEnd = endDate ?? new Date(`${seasonLabel.slice(0, 4)}-12-31T23:59:59.999Z`);

  return tx.season.create({
    data: {
      organizationId,
      name: seasonLabel,
      startDate: defaultStart,
      endDate: defaultEnd,
    },
    select: { id: true, name: true },
  });
}

export async function createCompetition(organizationId: string, createdById: string, input: CreateCompetitionInput) {
  const data = sanitizeCompetitionInput(input);
  const { participantTeamIds, seasonLabel, ...competitionData } = data;

  return prisma.$transaction(async (tx) => {
    const season = await resolveOrCreateSeason(
      tx,
      organizationId,
      seasonLabel,
      competitionData.startDate,
      competitionData.endDate
    );
    const duplicate = await tx.competition.findFirst({
      where: {
        organizationId,
        name: competitionData.name,
        sport: competitionData.sport,
        type: competitionData.type,
        seasonId: season.id,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Competition for this season already exists.");
    }

    const validTeams = participantTeamIds.length
      ? await tx.team.findMany({
          where: {
            id: { in: participantTeamIds },
            organizationId,
            sport: competitionData.sport,
          },
          select: { id: true, createdById: true },
        })
      : [];

    const validTeamIds = new Set(validTeams.map((team) => team.id));

    return tx.competition.create({
      data: {
        ...competitionData,
        generationMatchDurations: competitionData.generationMatchDurations as Prisma.InputJsonValue,
        organizationId,
        createdById,
        venueId: competitionData.venueId ?? null,
        seasonId: season.id,
        teams: validTeamIds.size
          ? {
              createMany: {
                data: Array.from(validTeamIds).map((teamId) => ({ teamId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: { teams: true },
    });
  });
}

export async function updateCompetition(id: string, organizationId: string, actor: { id: string; role: string }, input: Partial<CreateCompetitionInput>) {
  const current = await prisma.competition.findFirst({ where: { id, organizationId } });
  if (!current) return null;
  if (!canEditEntity(actor, current)) throw new Error("Forbidden");

  const merged = sanitizeCompetitionInput({
    name: input.name ?? current.name,
    type: input.type ?? current.type,
    sport: input.sport ?? current.sport,
    description: input.description ?? current.description,
    notes: input.notes ?? current.notes,
    location: input.location ?? current.location,
    startDate: input.startDate ?? current.startDate?.toISOString() ?? null,
    endDate: input.endDate ?? current.endDate?.toISOString() ?? null,
    registrationDeadline: input.registrationDeadline ?? current.registrationDeadline?.toISOString() ?? null,
    teamCount: input.teamCount ?? current.teamCount,
    maxTeams: input.maxTeams ?? current.maxTeams,
    teamSize: input.teamSize ?? current.teamSize,
    substitutions: input.substitutions ?? current.substitutions,
    matchDurationMinutes: input.matchDurationMinutes ?? current.matchDurationMinutes,
    generationMatchDurations:
      input.generationMatchDurations ?? normalizeGenerationMatchDurations(current.generationMatchDurations),
    stadiumName: input.stadiumName ?? current.stadiumName ?? null,
    pitchNames: input.pitchNames ?? current.pitchNames,
    scheduleDays: input.scheduleDays ?? normalizeScheduleDays(current.scheduleDays),
    format: input.format ?? current.format,
    visibility: input.visibility ?? current.visibility,
    status: input.status ?? current.status,
    entryFee: input.entryFee ?? (current.entryFee ? Number(current.entryFee) : null),
    venueId: input.venueId ?? current.venueId,
    seasonId: input.seasonId ?? current.seasonId,
    seasonLabel: input.seasonLabel ?? (await prisma.season.findUnique({ where: { id: current.seasonId ?? "" }, select: { name: true } }))?.name ?? "2026",
    participantTeamIds: input.participantTeamIds ?? [],
  });
  const { participantTeamIds = [], seasonLabel, ...competitionData } = merged;

  return prisma.$transaction(async (tx) => {
    const season = await resolveOrCreateSeason(
      tx,
      organizationId,
      seasonLabel,
      competitionData.startDate,
      competitionData.endDate
    );
    const duplicate = await tx.competition.findFirst({
      where: {
        id: { not: id },
        organizationId,
        name: competitionData.name,
        sport: competitionData.sport,
        type: competitionData.type,
        seasonId: season.id,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Competition for this season already exists.");
    }

    const updatedCompetition = await tx.competition.update({
      where: { id },
      data: {
        ...competitionData,
        generationMatchDurations: competitionData.generationMatchDurations as Prisma.InputJsonValue,
        seasonId: season.id,
      },
      include: { teams: true },
    });
    if (competitionData.type !== "TOURNAMENT") {
      await tx.draw.deleteMany({ where: { competitionId: id } });
    }

    if (input.participantTeamIds) {
      const validTeams = await tx.team.findMany({
        where: {
          id: { in: participantTeamIds },
          organizationId,
          sport: competitionData.sport,
        },
        select: { id: true, createdById: true },
      });
      const validTeamIds = new Set(validTeams.map((team) => team.id));

      await tx.competitionTeam.deleteMany({ where: { competitionId: id } });
      if (validTeamIds.size) {
        await tx.competitionTeam.createMany({
          data: Array.from(validTeamIds).map((teamId) => ({ competitionId: id, teamId })),
          skipDuplicates: true,
        });
      }
    }

    await tx.match.updateMany({
      where: { competitionId: id },
      data: { regularTimeMinutes: updatedCompetition.matchDurationMinutes },
    });
    return updatedCompetition;
  });
}

export async function getCompetitionById(organizationId: string, id: string) {
  const competition = await prisma.competition.findFirst({
    where: { organizationId, id },
    include: {
      season: { select: { id: true, name: true } },
      teams: {
        include: {
          team: {
            select: { id: true, name: true, sport: true },
          },
        },
      },
    },
  });
  if (!competition) return null;

  const seasons = await prisma.competition.findMany({
    where: {
      organizationId,
      name: competition.name,
      type: competition.type,
      sport: competition.sport,
    },
    include: { season: { select: { id: true, name: true } } },
    orderBy: [{ season: { name: "desc" } }, { createdAt: "desc" }],
  });

  return {
    ...competition,
    scheduleDays: normalizeScheduleDays(competition.scheduleDays),
    generationMatchDurations: normalizeGenerationMatchDurations(competition.generationMatchDurations),
    seasonOptions: seasons.map((entry) => ({
      competitionId: entry.id,
      seasonId: entry.seasonId,
      seasonLabel: entry.season?.name ?? null,
    })),
  };
}

export async function deleteCompetition(id: string, organizationId: string, actor: { id: string; role: string }) {
  const existing = await prisma.competition.findFirst({
    where: { id, organizationId },
    select: { id: true, createdById: true },
  });

  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");

  return prisma.competition.delete({ where: { id: existing.id } });
}

export async function getDashboardSnapshot(organizationId: string) {
  const [competitions, teamsCount, playersCount, matchesToday, liveMatches] = await Promise.all([
    prisma.competition.count({ where: { organizationId, status: { in: ["ONGOING", "UPCOMING"] } } }),
    prisma.team.count({ where: { organizationId } }),
    prisma.player.count({ where: { team: { organizationId } } }),
    prisma.match.count({
      where: {
        competition: { organizationId },
        scheduledAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.match.count({ where: { competition: { organizationId }, status: "LIVE" } }),
  ]);

  return {
    activeCompetitions: competitions,
    totalTeams: teamsCount,
    matchesToday,
    totalPlayers: playersCount,
    liveMatches,
  };
}

export async function getStatisticsSnapshot(organizationId: string) {
  const [matches, goalEventsCount, teamStatsAgg] = await Promise.all([
    prisma.match.findMany({
      where: {
        competition: { organizationId },
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        id: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.matchGoalEvent.count({
      where: {
        match: { competition: { organizationId } },
      },
    }),
    prisma.matchTeamStats.aggregate({
      where: {
        match: { competition: { organizationId } },
      },
      _sum: {
        yellowCards: true,
        redCards: true,
      },
    }),
  ]);

  const totalGoals = matches.reduce((sum, match) => sum + (match.homeScore ?? 0) + (match.awayScore ?? 0), 0);
  const scoredMatchesCount = matches.length;
  const cleanSheets = matches.reduce((sum, match) => {
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    return sum + (homeScore === 0 || awayScore === 0 ? 1 : 0);
  }, 0);

  const homeWins = matches.filter((match) => (match.homeScore ?? 0) > (match.awayScore ?? 0)).length;
  const draws = matches.filter((match) => (match.homeScore ?? 0) === (match.awayScore ?? 0)).length;
  const awayWins = matches.filter((match) => (match.homeScore ?? 0) < (match.awayScore ?? 0)).length;

  const goalsOverview = matches.slice(-10).map((match, index) => ({
    label: `M${index + 1}`,
    home: match.homeScore ?? 0,
    away: match.awayScore ?? 0,
  }));

  return {
    totalGoals,
    goalsPerMatch: scoredMatchesCount ? totalGoals / scoredMatchesCount : 0,
    goalEvents: goalEventsCount,
    cleanSheets,
    yellowCards: teamStatsAgg._sum.yellowCards ?? 0,
    redCards: teamStatsAgg._sum.redCards ?? 0,
    goalsOverview,
    resultsBreakdown: [
      { name: "Home Wins", value: homeWins },
      { name: "Draws", value: draws },
      { name: "Away Wins", value: awayWins },
    ],
  };
}

export async function listTeams(organizationId: string) {
  const teams = await prisma.team.findMany({
    where: { organizationId },
    include: {
      homeVenue: { select: { id: true, name: true } },
      standings: {
        include: { competition: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return teams.map((team) => {
    const standing = team.standings[0];
    return {
      id: team.id,
      createdById: team.createdById,
      sport: team.sport,
      name: team.name,
      shortName: team.shortName,
      place: team.place,
      city: team.city,
      country: team.country,
      coach: team.coach,
      homeVenueId: team.homeVenueId,
      homeVenueName: team.homeVenue?.name ?? null,
      profileImageUrl: team.profileImageUrl,
      competition: standing?.competition.name ?? null,
      played: standing?.played ?? 0,
      wins: standing?.wins ?? 0,
      draws: standing?.draws ?? 0,
      losses: standing?.losses ?? 0,
      goalsFor: standing?.goalsFor ?? 0,
      goalsAgainst: standing?.goalsAgainst ?? 0,
      points: standing?.points ?? 0,
    };
  });
}

export async function listPlayers(organizationId: string) {
  const players = await prisma.player.findMany({
    where: { team: { organizationId } },
    include: {
      team: true,
      _count: { select: { goalEvents: true } },
      clubHistory: {
        include: {
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ fromYear: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: { fullName: "asc" },
  });

  return players.map((player) => ({
    id: player.id,
    createdById: player.createdById,
    sport: player.sport,
    firstName: player.firstName,
    lastName: player.lastName,
    fullName: player.fullName,
    position: player.position,
    number: player.number,
    nationality: player.nationality,
    nationalities: player.nationalities,
    placeOfBirth: player.placeOfBirth,
    status: player.status,
    dominantFoot: player.dominantFoot,
    heightCm: player.heightCm,
    weightKg: player.weightKg,
    profileImageUrl: player.profileImageUrl,
    bio: player.bio,
    radarDefending: player.radarDefending,
    radarPhysical: player.radarPhysical,
    radarSpeed: player.radarSpeed,
    radarPassing: player.radarPassing,
    radarGameIQ: player.radarGameIQ,
    achievements: player.achievements,
    strengths: player.strengths,
    improvements: player.improvements,
    coachNote: player.coachNote,
    dateOfBirth: player.dateOfBirth,
    teamId: player.teamId,
    team: player.team.name,
    teamProfileImageUrl: player.team.profileImageUrl,
    goals: player._count.goalEvents,
    assists: 0,
    clubHistory: player.clubHistory.map((item) => ({
      id: item.id,
      teamId: item.teamId,
      teamName: item.team.name,
      fromYear: item.fromYear,
      toYear: item.toYear,
    })),
    age: player.dateOfBirth ? Math.max(0, new Date().getFullYear() - player.dateOfBirth.getFullYear()) : null,
  }));
}

export async function listMatches(
  _organizationId: string,
  filters?: {
    status?: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELED";
    competitionId?: string;
  }
) {
  const drawsToMaterialize = await prisma.draw.findMany({
    where: {
      knockoutRounds: { some: { matches: { some: { scheduledAt: { not: null } } } } },
      ...(filters?.competitionId ? { competitionId: filters.competitionId } : {}),
    },
    select: { id: true },
  });

  for (const draw of drawsToMaterialize) {
    await prisma.$transaction(async (tx) => {
      await syncMaterializedKnockoutMatches(tx, draw.id);
    });
  }

  const matches = await prisma.match.findMany({
    where: {
      ...(filters?.competitionId ? { competitionId: filters.competitionId } : {}),
    },
    include: {
      competition: { include: { season: { select: { id: true, name: true } } } },
      homeTeam: true,
      awayTeam: true,
      venue: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  const includeKnockout = !filters?.status || filters.status === "SCHEDULED" || filters.status === "FINISHED";
  const knockoutMatches = includeKnockout
    ? await prisma.drawKnockoutMatch.findMany({
        where: {
          scheduledAt: { not: null },
          round: {
            draw: {
              competition: {
                ...(filters?.competitionId ? { id: filters.competitionId } : {}),
              },
            },
          },
        },
        include: {
          round: {
            include: {
              draw: {
                include: {
                  competition: {
                    include: { season: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
          homeTeam: true,
          awayTeam: true,
        },
        orderBy: [{ scheduledAt: "asc" }],
      })
    : [];

  const drawIds = Array.from(new Set(knockoutMatches.map((match) => match.round.draw.id)));
  const drawsForResolution = drawIds.length
    ? await prisma.draw.findMany({
        where: { id: { in: drawIds } },
        include: {
          groups: {
            include: {
              teams: {
                include: {
                  team: {
                    select: { id: true, name: true, profileImageUrl: true },
                  },
                },
                orderBy: { position: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
          matches: {
            where: { stage: "GROUP_STAGE" },
            select: {
              drawGroupId: true,
              homeTeamId: true,
              awayTeamId: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
      })
    : [];

  const drawGroupResolution = new Map<
    string,
    Map<
      string,
      {
        winner: { id: string; name: string; profileImageUrl: string | null } | null;
        runnerUp: { id: string; name: string; profileImageUrl: string | null } | null;
      }
    >
  >();

  for (const draw of drawsForResolution) {
    if (!draw.groupStageEnabled || !draw.groups.length || !draw.matches.length) continue;
    if (draw.matches.some((match) => match.homeScore === null || match.awayScore === null)) continue;

    const perGroup = new Map<
      string,
      {
        winner: { id: string; name: string; profileImageUrl: string | null } | null;
        runnerUp: { id: string; name: string; profileImageUrl: string | null } | null;
      }
    >();

    for (const group of draw.groups) {
      const standings = computeDrawGroupStandings({
        teams: group.teams.map((entry) => ({
          id: entry.team.id,
          name: entry.team.name,
          profileImageUrl: entry.team.profileImageUrl ?? null,
          position: entry.position,
        })),
        matches: draw.matches.filter((match) => match.drawGroupId === group.id),
      });

      perGroup.set(group.name.toUpperCase(), {
        winner: standings[0]
          ? {
              id: standings[0].teamId,
              name: standings[0].teamName,
              profileImageUrl: standings[0].profileImageUrl,
            }
          : null,
        runnerUp: standings[1]
          ? {
              id: standings[1].teamId,
              name: standings[1].teamName,
              profileImageUrl: standings[1].profileImageUrl,
            }
          : null,
      });
    }

    drawGroupResolution.set(draw.id, perGroup);
  }

  const regularRows = matches.map((match) => ({
    id: match.id,
    createdById: match.createdById,
    competitionId: match.competitionId,
    competition: match.competition.name,
    seasonId: match.competition.seasonId,
    seasonLabel: match.competition.season?.name ?? null,
    competitionType: match.competition.type,
    generationYear: match.generationYear ?? null,
    round: match.round,
    phase: formatCompetitionPhase({ stage: match.stage, round: match.round }),
    scheduledAt: match.scheduledAt,
    status: getEffectiveMatchStatus({
      scheduledAt: match.scheduledAt,
      status: match.status,
      regularTimeMinutes: match.regularTimeMinutes,
    }),
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeam: match.homeTeam.name,
    homeTeamProfileImageUrl: match.homeTeam.profileImageUrl ?? null,
    awayTeam: match.awayTeam.name,
    awayTeamProfileImageUrl: match.awayTeam.profileImageUrl ?? null,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    liveMinute: match.liveMinute,
    regularTimeMinutes: match.regularTimeMinutes,
    venue: match.venueLabel ?? match.venue?.name ?? "TBD",
    venueLabel: match.venueLabel ?? null,
    pitchName: match.pitchName ?? null,
  }));

  const materializedKnockoutKeys = new Set(
    matches
      .filter((match) => match.drawId && isKnockoutStage(match.stage) && match.round)
      .map((match) => buildKnockoutMaterializationKey(match.drawId as string, match.stage as string, match.round as string))
  );

  const knockoutRows = knockoutMatches.flatMap((match) => {
    const competition = match.round.draw.competition;
    const groupResolution = drawGroupResolution.get(match.round.draw.id);
    const resolvedHomeTeam =
      match.homeTeam ??
      (match.homeSourceType === "GROUP_WINNER"
        ? (groupResolution?.get(resolveGroupSourceKey(match.homeSourceValue))?.winner ?? null)
        : match.homeSourceType === "GROUP_RUNNER_UP"
          ? (groupResolution?.get(resolveGroupSourceKey(match.homeSourceValue))?.runnerUp ?? null)
          : null);
    const resolvedAwayTeam =
      match.awayTeam ??
      (match.awaySourceType === "GROUP_WINNER"
        ? (groupResolution?.get(resolveGroupSourceKey(match.awaySourceValue))?.winner ?? null)
        : match.awaySourceType === "GROUP_RUNNER_UP"
          ? (groupResolution?.get(resolveGroupSourceKey(match.awaySourceValue))?.runnerUp ?? null)
          : null);
    const roundTypeLabel =
      match.round.roundType === "ROUND_OF_16"
        ? "1/8 finale"
        : match.round.roundType === "QUARTERFINAL"
          ? "1/4 finale"
          : match.round.roundType === "SEMIFINAL"
            ? "1/2 finale"
            : match.round.roundType === "FINAL"
              ? "FINALE"
              : "UTAKMICA ZA 3. MJESTO";
    const materializationKey = buildKnockoutMaterializationKey(match.round.draw.id, match.round.roundType, `Match ${match.order}`);
    if (materializedKnockoutKeys.has(materializationKey)) return [];

    return [{
      id: `ko-${match.id}`,
      createdById: competition.createdById,
      competitionId: competition.id,
      competition: competition.name,
      seasonId: competition.seasonId,
      seasonLabel: competition.season?.name ?? null,
      competitionType: competition.type,
      generationYear: match.round.draw.generationYear ?? null,
      round: `${roundTypeLabel} - Utakmica ${match.order}`,
      phase: formatCompetitionPhase({ knockoutRoundType: match.round.roundType }),
      scheduledAt: match.scheduledAt as Date,
      status: getEffectiveMatchStatus({
        scheduledAt: match.scheduledAt as Date,
        status: MatchStatus.SCHEDULED,
        regularTimeMinutes: competition.matchDurationMinutes,
      }),
      homeTeamId: resolvedHomeTeam?.id ?? match.homeTeamId ?? `source-${match.id}-home`,
      awayTeamId: resolvedAwayTeam?.id ?? match.awayTeamId ?? `source-${match.id}-away`,
      homeTeam: resolvedHomeTeam?.name ?? match.homeSourceValue,
      awayTeam: resolvedAwayTeam?.name ?? match.awaySourceValue,
      homeTeamProfileImageUrl: resolvedHomeTeam?.profileImageUrl ?? null,
      awayTeamProfileImageUrl: resolvedAwayTeam?.profileImageUrl ?? null,
      homeScore: null,
      awayScore: null,
      liveMinute: null,
      regularTimeMinutes: competition.matchDurationMinutes,
      venue: match.venueLabel ?? match.pitchName ?? "Teren",
      venueLabel: match.venueLabel ?? null,
      pitchName: match.pitchName ?? null,
      isVirtualKnockout: true,
    }];
  });

  return [...regularRows, ...knockoutRows]
    .filter((match) => !filters?.status || match.status === filters.status)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

export async function getSeasonTeamPlayerRegistrations(organizationId: string, competitionId: string) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    include: {
      teams: {
        include: {
          team: {
            include: {
              players: {
                select: { id: true, fullName: true, sport: true, teamId: true },
                orderBy: { fullName: "asc" },
              },
            },
          },
        },
      },
      season: { select: { id: true, name: true } },
    },
  });
  if (!competition) return null;

  const registrations = await prisma.competitionSeasonTeamPlayer.findMany({
    where: { competitionId },
    select: { teamId: true, playerId: true },
  });
  const map = new Map<string, Set<string>>();
  for (const registration of registrations) {
    const set = map.get(registration.teamId) ?? new Set<string>();
    set.add(registration.playerId);
    map.set(registration.teamId, set);
  }

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    seasonLabel: competition.season?.name ?? null,
    teams: competition.teams.map((entry) => ({
      teamId: entry.teamId,
      teamName: entry.team.name,
      players: entry.team.players.map((player) => ({
        id: player.id,
        fullName: player.fullName,
      })),
      registeredPlayerIds: Array.from(map.get(entry.teamId) ?? []),
    })),
  };
}

export async function saveSeasonTeamPlayerRegistrations(
  organizationId: string,
  competitionId: string,
  actor: { id: string; role: string },
  teamId: string,
  playerIds: string[]
) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    select: { id: true, createdById: true },
  });
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");

  const participant = await prisma.competitionTeam.findFirst({
    where: { competitionId, teamId },
    select: { teamId: true },
  });
  if (!participant) throw new Error("Team is not a participant in this season.");

  const validPlayers = await prisma.player.findMany({
    where: { id: { in: playerIds }, teamId },
    select: { id: true },
  });
  const validIds = new Set(validPlayers.map((player) => player.id));

  await prisma.$transaction(async (tx) => {
    await tx.competitionSeasonTeamPlayer.deleteMany({ where: { competitionId, teamId } });
    if (validIds.size) {
      await tx.competitionSeasonTeamPlayer.createMany({
        data: Array.from(validIds).map((playerId) => ({ competitionId, teamId, playerId })),
        skipDuplicates: true,
      });
    }
  });

  return { ok: true };
}

export async function listVenues(organizationId: string) {
  const orphanPitches = await prisma.pitch.findMany({
    where: { organizationId, venueId: null },
    select: { id: true, name: true },
  });
  if (orphanPitches.length) {
    const venuesForMapping = await prisma.venue.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    for (const pitch of orphanPitches) {
      const parts = pitch.name.split(" - ").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const pitchNameCandidate = parts[parts.length - 1];
      const venueNameCandidate = parts.slice(0, parts.length - 1).join(" - ");
      const targetVenue = venuesForMapping.find((venue) => venue.name.toLowerCase() === venueNameCandidate.toLowerCase());
      if (!targetVenue) continue;
      await prisma.pitch.update({
        where: { id: pitch.id },
        data: {
          venueId: targetVenue.id,
          name: pitchNameCandidate,
        },
      });
    }
  }

  const prefixedPitches = await prisma.pitch.findMany({
    where: { organizationId, venueId: { not: null } },
    select: { id: true, name: true, venue: { select: { name: true } } },
  });
  for (const pitch of prefixedPitches) {
    const venueName = pitch.venue?.name?.trim();
    if (!venueName) continue;
    const prefix = `${venueName} - `;
    if (pitch.name.startsWith(prefix)) {
      await prisma.pitch.update({
        where: { id: pitch.id },
        data: { name: pitch.name.slice(prefix.length).trim() || pitch.name },
      });
    }
  }

  return prisma.venue.findMany({
    where: { organizationId },
    include: {
      team: { select: { id: true, name: true } },
      pitches: {
        where: { isActive: true },
        orderBy: [{ venueId: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createVenue(
  organizationId: string,
  input: {
    name: string;
    city?: string | null;
    country?: string | null;
    capacity?: number | null;
    surface?: string | null;
    dimensions?: string | null;
    lighting?: boolean;
    accessibility?: string | null;
    teamId?: string | null;
  }
) {
  return prisma.venue.create({
    data: {
      organizationId,
      name: input.name,
      city: input.city ?? "N/A",
      country: input.country ?? "N/A",
      capacity: input.capacity ?? null,
      surface: input.surface ?? null,
      dimensions: input.dimensions ?? null,
      lighting: input.lighting ?? true,
      accessibility: input.accessibility ?? null,
      teamId: input.teamId ?? null,
      status: "active",
    },
  });
}

export async function updateVenue(
  organizationId: string,
  venueId: string,
  input: {
    name?: string;
    city?: string | null;
    country?: string | null;
    capacity?: number | null;
    surface?: string | null;
    dimensions?: string | null;
    lighting?: boolean;
    accessibility?: string | null;
    teamId?: string | null;
  }
) {
  const existing = await prisma.venue.findFirst({ where: { id: venueId, organizationId }, select: { id: true } });
  if (!existing) return null;
  return prisma.venue.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.city !== undefined ? { city: input.city ?? "N/A" } : {}),
      ...(input.country !== undefined ? { country: input.country ?? "N/A" } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.surface !== undefined ? { surface: input.surface } : {}),
      ...(input.dimensions !== undefined ? { dimensions: input.dimensions } : {}),
      ...(input.lighting !== undefined ? { lighting: input.lighting } : {}),
      ...(input.accessibility !== undefined ? { accessibility: input.accessibility } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
    },
  });
}

export async function deleteVenue(organizationId: string, venueId: string) {
  const existing = await prisma.venue.findFirst({ where: { id: venueId, organizationId }, select: { id: true } });
  if (!existing) return null;
  return prisma.venue.delete({ where: { id: existing.id } });
}

export async function createPitch(
  organizationId: string,
  input: {
    venueId?: string | null;
    name: string;
    surface?: string | null;
    generationLabel?: string | null;
    ageGroupCode?: string | null;
    playerFormat: string;
    fieldLengthMeters: number;
    fieldWidthMeters: number;
    goalWidthMeters?: number | null;
    goalHeightMeters?: number | null;
    isActive?: boolean;
  }
) {
  return prisma.pitch.create({
    data: {
      organizationId,
      venueId: input.venueId ?? null,
      name: input.name,
      surface: input.surface ?? null,
      generationLabel: input.generationLabel ?? null,
      ageGroupCode: input.ageGroupCode ?? null,
      playerFormat: input.playerFormat,
      fieldLengthMeters: input.fieldLengthMeters,
      fieldWidthMeters: input.fieldWidthMeters,
      goalWidthMeters: input.goalWidthMeters ?? null,
      goalHeightMeters: input.goalHeightMeters ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updatePitch(
  organizationId: string,
  pitchId: string,
  input: {
    venueId?: string | null;
    name?: string;
    surface?: string | null;
    generationLabel?: string | null;
    ageGroupCode?: string | null;
    playerFormat?: string;
    fieldLengthMeters?: number;
    fieldWidthMeters?: number;
    goalWidthMeters?: number | null;
    goalHeightMeters?: number | null;
    isActive?: boolean;
  }
) {
  const existing = await prisma.pitch.findFirst({ where: { id: pitchId, organizationId }, select: { id: true } });
  if (!existing) return null;
  return prisma.pitch.update({
    where: { id: existing.id },
    data: {
      ...(input.venueId !== undefined ? { venueId: input.venueId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.surface !== undefined ? { surface: input.surface } : {}),
      ...(input.generationLabel !== undefined ? { generationLabel: input.generationLabel } : {}),
      ...(input.ageGroupCode !== undefined ? { ageGroupCode: input.ageGroupCode } : {}),
      ...(input.playerFormat !== undefined ? { playerFormat: input.playerFormat } : {}),
      ...(input.fieldLengthMeters !== undefined ? { fieldLengthMeters: input.fieldLengthMeters } : {}),
      ...(input.fieldWidthMeters !== undefined ? { fieldWidthMeters: input.fieldWidthMeters } : {}),
      ...(input.goalWidthMeters !== undefined ? { goalWidthMeters: input.goalWidthMeters } : {}),
      ...(input.goalHeightMeters !== undefined ? { goalHeightMeters: input.goalHeightMeters } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deletePitch(organizationId: string, pitchId: string) {
  const existing = await prisma.pitch.findFirst({ where: { id: pitchId, organizationId }, select: { id: true } });
  if (!existing) return null;
  return prisma.pitch.delete({ where: { id: existing.id } });
}

export async function listStandings(organizationId: string, competitionId?: string) {
  const competitions = await prisma.competition.findMany({
    where: {
      organizationId,
      type: { in: [CompetitionType.LEAGUE, CompetitionType.TOURNAMENT] },
      ...(competitionId ? { id: competitionId } : {}),
    },
    include: {
      season: { select: { name: true } },
      teams: {
        include: {
          team: {
            select: { id: true, name: true, profileImageUrl: true },
          },
        },
      },
      teamGenerations: {
        where: { isApproved: true },
        include: {
          team: {
            select: { id: true, name: true, profileImageUrl: true },
          },
        },
      },
      matches: {
        where: {
          homeScore: { not: null },
          awayScore: { not: null },
        },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          scheduledAt: true,
          generationYear: true,
          drawGroupId: true,
          stage: true,
        },
        orderBy: { scheduledAt: "asc" },
      },
      draws: {
        include: {
          groups: {
            include: {
              teams: {
                include: {
                  team: {
                    select: { id: true, name: true, profileImageUrl: true },
                  },
                },
                orderBy: { position: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: [{ generationYear: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  type FormResult = "W" | "D" | "L";
  type TableRow = {
    position: number;
    teamId: string;
    team: string;
    profileImageUrl: string | null;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    form: FormResult[];
  };
  type TeamSeed = { id: string; name: string; profileImageUrl: string | null; seedPosition?: number | null };

  function computeTableRows(input: {
    teams: TeamSeed[];
    matches: Array<{
      homeTeamId: string;
      awayTeamId: string;
      homeScore: number | null;
      awayScore: number | null;
      scheduledAt: Date;
    }>;
  }): TableRow[] {
    const table = new Map<
      string,
      {
        teamId: string;
        team: string;
        profileImageUrl: string | null;
        seedPosition: number | null;
        played: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        points: number;
        form: FormResult[];
      }
    >();

    for (const team of input.teams) {
      table.set(team.id, {
        teamId: team.id,
        team: team.name,
        profileImageUrl: team.profileImageUrl,
        seedPosition: team.seedPosition ?? null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: [],
      });
    }

    for (const match of input.matches) {
      if (match.homeScore === null || match.awayScore === null) continue;
      const home = table.get(match.homeTeamId);
      const away = table.get(match.awayTeamId);
      if (!home || !away) continue;

      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
        home.form.push("W");
        away.form.push("L");
      } else if (match.homeScore < match.awayScore) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
        home.form.push("L");
        away.form.push("W");
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
        home.form.push("D");
        away.form.push("D");
      }
    }

    return Array.from(table.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const goalDiffA = a.goalsFor - a.goalsAgainst;
        const goalDiffB = b.goalsFor - b.goalsAgainst;
        if (goalDiffB !== goalDiffA) return goalDiffB - goalDiffA;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        if (b.wins !== a.wins) return b.wins - a.wins;
        const seedA = a.seedPosition ?? Number.MAX_SAFE_INTEGER;
        const seedB = b.seedPosition ?? Number.MAX_SAFE_INTEGER;
        if (seedA !== seedB) return seedA - seedB;
        return a.team.localeCompare(b.team);
      })
      .map((row, index) => ({
        position: index + 1,
        teamId: row.teamId,
        team: row.team,
        profileImageUrl: row.profileImageUrl,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDiff: row.goalsFor - row.goalsAgainst,
        points: row.points,
        form: row.form.slice(-5),
      }));
  }

  const standingsCompetitions = competitions.map((competition) => {
    if (competition.type === CompetitionType.LEAGUE) {
      const leagueMatches = competition.matches.map((match) => ({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        scheduledAt: match.scheduledAt,
      }));
      const rows = leagueMatches.length
        ? computeTableRows({
        teams: competition.teams.map((entry) => ({
          id: entry.team.id,
          name: entry.team.name,
          profileImageUrl: entry.team.profileImageUrl ?? null,
          seedPosition: entry.seed ?? null,
        })),
        matches: leagueMatches,
      })
        : [];

      return {
        competitionId: competition.id,
        competitionName: competition.name,
        seasonLabel: competition.season?.name ?? null,
        competitionType: competition.type,
        generations: [
          {
            generationYear: null,
            generationLabel: "Tabela",
            groups: [
              {
                groupId: `${competition.id}-overall`,
                groupLabel: "Ukupni poredak",
                rows,
              },
            ],
          },
        ],
      };
    }

    const drawGenerations = competition.draws.map((draw) => {
      const generationTeams =
        draw.generationYear !== null
          ? competition.teamGenerations
              .filter((entry) => entry.generationYear === draw.generationYear)
              .map((entry) => ({
                id: entry.team.id,
                name: entry.team.name,
                profileImageUrl: entry.team.profileImageUrl ?? null,
              }))
          : competition.teams.map((entry) => ({
              id: entry.team.id,
              name: entry.team.name,
              profileImageUrl: entry.team.profileImageUrl ?? null,
            }));

      const groups = draw.groups.length
        ? draw.groups.map((group) => ({
            groupId: group.id,
            groupLabel: `Grupa ${group.name.toUpperCase()}`,
            rows:
              competition.matches.some((match) => match.generationYear === draw.generationYear && match.drawGroupId === group.id)
                ? computeTableRows({
              teams: group.teams.map((entry) => ({
                id: entry.team.id,
                name: entry.team.name,
                profileImageUrl: entry.team.profileImageUrl ?? null,
                seedPosition: entry.position ?? null,
              })),
              matches: competition.matches
                .filter((match) => match.generationYear === draw.generationYear && match.drawGroupId === group.id)
                .map((match) => ({
                  homeTeamId: match.homeTeamId,
                  awayTeamId: match.awayTeamId,
                  homeScore: match.homeScore,
                  awayScore: match.awayScore,
                  scheduledAt: match.scheduledAt,
                })),
            })
                : [],
          }))
        : [
            {
              groupId: `${draw.id}-overall`,
              groupLabel: "Ukupni poredak",
              rows: competition.matches.some((match) => match.generationYear === draw.generationYear && match.stage !== "GROUP_STAGE")
                ? computeTableRows({
                teams: generationTeams,
                matches: competition.matches
                  .filter((match) => match.generationYear === draw.generationYear && match.stage !== "GROUP_STAGE")
                  .map((match) => ({
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    scheduledAt: match.scheduledAt,
                  })),
              })
                : [],
            },
          ];

      return {
        generationYear: draw.generationYear ?? null,
        generationLabel: draw.generationYear ? `Generacija ${draw.generationYear}` : "Bez generacije",
        groups: groups.filter((group) => group.rows.length > 0),
      };
    });

    const uncoveredGenerationYears = Array.from(
      new Set(competition.teamGenerations.map((entry) => entry.generationYear).filter((year) => !competition.draws.some((draw) => draw.generationYear === year)))
    )
      .sort((a, b) => b - a)
      .map((generationYear) => ({
        generationYear,
        generationLabel: `Generacija ${generationYear}`,
        groups: [
          {
            groupId: `${competition.id}-${generationYear}-overall`,
            groupLabel: "Ukupni poredak",
            rows: competition.matches.some((match) => match.generationYear === generationYear)
              ? computeTableRows({
              teams: competition.teamGenerations
                .filter((entry) => entry.generationYear === generationYear)
                .map((entry) => ({
                  id: entry.team.id,
                  name: entry.team.name,
                  profileImageUrl: entry.team.profileImageUrl ?? null,
                })),
              matches: competition.matches
                .filter((match) => match.generationYear === generationYear)
                .map((match) => ({
                  homeTeamId: match.homeTeamId,
                  awayTeamId: match.awayTeamId,
                  homeScore: match.homeScore,
                  awayScore: match.awayScore,
                  scheduledAt: match.scheduledAt,
                })),
            })
              : [],
          },
        ],
      }));

    return {
      competitionId: competition.id,
      competitionName: competition.name,
      seasonLabel: competition.season?.name ?? null,
      competitionType: competition.type,
      generations: [...drawGenerations, ...uncoveredGenerationYears]
        .filter((generation) => generation.groups.some((group) => group.rows.length > 0))
        .sort((a, b) => {
        const aYear = a.generationYear ?? -1;
        const bYear = b.generationYear ?? -1;
        return bYear - aYear;
      }),
    };
  });

  return {
    competitions: standingsCompetitions.filter((competition) =>
      competition.generations.some((generation) => generation.groups.some((group) => group.rows.length > 0))
    ),
  };
}






