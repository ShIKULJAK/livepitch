import { CompetitionStatus, CompetitionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canEditEntity } from "@/lib/permissions";
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
  const normalizedPitchNames = Array.from(
    new Set((input.pitchNames ?? ["Teren 1"]).map((name) => name.trim()).filter(Boolean))
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
    stadiumName: input.stadiumName.trim(),
    pitchNames: normalizedPitchNames.length ? normalizedPitchNames : ["Teren 1"],
    scheduleDays: (input.scheduleDays ?? []).map((day) => ({
      dayLabel: day.dayLabel.trim(),
      dayDate: day.dayDate,
      generationLabel: day.generationLabel,
      pitchId: day.pitchId ?? null,
      startTime: day.startTime,
      endTime: day.endTime,
    })),
    visibility: input.visibility ?? "public",
    participantTeamIds,
    seasonLabel: input.seasonLabel.trim(),
  };
}

type ScheduleDayRaw = { dayLabel?: string; dayDate?: string; generationLabel?: string; pitchId?: string | null; startTime?: string; endTime?: string };

function normalizeScheduleDays(value: unknown) {
  const fallback = [{ dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), generationLabel: "Generacija 2018", pitchId: null, startTime: "09:00", endTime: "19:00" }];
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .map((day) => day as ScheduleDayRaw)
    .filter((day) => typeof day.dayLabel === "string" && typeof day.startTime === "string" && typeof day.endTime === "string")
    .map((day) => ({
      dayLabel: day.dayLabel!.trim(),
      dayDate: typeof day.dayDate === "string" && day.dayDate.trim().length > 0 ? day.dayDate : new Date().toISOString().slice(0, 10),
      generationLabel:
        typeof day.generationLabel === "string" && day.generationLabel.trim().length > 0 ? day.generationLabel : "Generacija 2018",
      pitchId: typeof day.pitchId === "string" && day.pitchId.trim().length > 0 ? day.pitchId : null,
      startTime: day.startTime!,
      endTime: day.endTime!,
    }));

  return normalized.length ? normalized : fallback;
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
    stadiumName: input.stadiumName ?? current.stadiumName ?? "Stadion",
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
      data: { ...competitionData, seasonId: season.id },
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

export async function listTeams(organizationId: string) {
  const teams = await prisma.team.findMany({
    where: { organizationId },
    include: {
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
    include: { team: true },
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
    dateOfBirth: player.dateOfBirth,
    teamId: player.teamId,
    team: player.team.name,
    teamProfileImageUrl: player.team.profileImageUrl,
    age: player.dateOfBirth ? Math.max(0, new Date().getFullYear() - player.dateOfBirth.getFullYear()) : null,
  }));
}

export async function listMatches(
  organizationId: string,
  filters?: {
    status?: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELED";
    competitionId?: string;
  }
) {
  const matches = await prisma.match.findMany({
    where: {
      competition: { organizationId },
      ...(filters?.status ? { status: filters.status } : {}),
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

  return matches.map((match) => ({
    id: match.id,
    createdById: match.createdById,
    competitionId: match.competitionId,
    competition: match.competition.name,
    seasonId: match.competition.seasonId,
    seasonLabel: match.competition.season?.name ?? null,
    competitionType: match.competition.type,
    generationYear: match.generationYear ?? null,
    round: match.round,
    scheduledAt: match.scheduledAt,
    status: match.status,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    liveMinute: match.liveMinute,
    regularTimeMinutes: match.regularTimeMinutes,
    venue: match.venueLabel ?? match.venue?.name ?? "TBD",
    venueLabel: match.venueLabel ?? null,
    pitchName: match.pitchName ?? null,
  }));
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
  const competition =
    competitionId
      ? await prisma.competition.findFirst({ where: { id: competitionId, organizationId } })
      : await prisma.competition.findFirst({
          where: { organizationId, type: { in: [CompetitionType.LEAGUE, CompetitionType.TOURNAMENT] } },
          orderBy: { createdAt: "desc" },
        });

  if (!competition) {
    return { competitionId: null, competitionName: null, competitionType: null, rows: [] };
  }

  if (competition.type === "LEAGUE") {
    const [participants, finishedMatches] = await Promise.all([
      prisma.competitionTeam.findMany({
        where: { competitionId: competition.id },
        include: { team: true },
      }),
      prisma.match.findMany({
        where: {
          competitionId: competition.id,
          status: "FINISHED",
          homeScore: { not: null },
          awayScore: { not: null },
        },
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      }),
    ]);

    const table = new Map<string, {
      teamId: string;
      team: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      points: number;
      form: string;
    }>();

    for (const participant of participants) {
      table.set(participant.teamId, {
        teamId: participant.teamId,
        team: participant.team.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: "",
      });
    }

    for (const match of finishedMatches) {
      const home = table.get(match.homeTeamId) ?? {
        teamId: match.homeTeamId,
        team: match.homeTeam.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: "",
      };
      const away = table.get(match.awayTeamId) ?? {
        teamId: match.awayTeamId,
        team: match.awayTeam.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: "",
      };

      const homeScore = match.homeScore ?? 0;
      const awayScore = match.awayScore ?? 0;

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (homeScore < awayScore) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }

      table.set(home.teamId, home);
      table.set(away.teamId, away);
    }

    const sorted = Array.from(table.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGoalDiff = a.goalsFor - a.goalsAgainst;
      const bGoalDiff = b.goalsFor - b.goalsAgainst;
      if (bGoalDiff !== aGoalDiff) return bGoalDiff - aGoalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    });

    return {
      competitionId: competition.id,
      competitionName: competition.name,
      competitionType: competition.type,
      rows: sorted.map((row, index) => ({
        position: index + 1,
        team: row.team,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDiff: row.goalsFor - row.goalsAgainst,
        points: row.points,
        form: row.form,
      })),
    };
  }

  const rows = await prisma.standing.findMany({
    where: { competitionId: competition.id },
    include: { team: true },
  });

  const sortedRows = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aGoalDiff = a.goalsFor - a.goalsAgainst;
    const bGoalDiff = b.goalsFor - b.goalsAgainst;
    if (bGoalDiff !== aGoalDiff) return bGoalDiff - aGoalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  });

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    competitionType: competition.type,
    rows: sortedRows.map((row, index) => ({
      position: index + 1,
      team: row.team.name,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDiff: row.goalsFor - row.goalsAgainst,
      points: row.points,
      form: row.form,
    })),
  };
}






