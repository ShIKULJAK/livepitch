import { CompetitionStatus, CompetitionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
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
  filters: { q?: string; type?: CompetitionType; status?: CompetitionStatus }
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
  };

  const competitions = await prisma.competition.findMany({
    where,
    include: {
      venue: true,
      matches: { select: { id: true, status: true } },
      teams: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return competitions.map((competition) => ({
    id: competition.id,
    name: competition.name,
    type: competition.type,
    status: competition.status,
    location: competition.location ?? "TBD",
    sport: competition.sport,
    format: competition.format,
    startDate: competition.startDate,
    endDate: competition.endDate,
    matchDurationMinutes: competition.matchDurationMinutes,
    teamsCount: competition.teams.length || competition.teamCount || 0,
    matchesCount: competition.matches.length,
    liveMatches: competition.matches.filter((match) => match.status === "LIVE").length,
    createdAt: competition.createdAt,
  }));
}

function sanitizeCompetitionInput(input: CreateCompetitionInput) {
  const parseDate = (value?: string | null) => (value ? new Date(value) : null);
  const participantTeamIds = Array.from(new Set(input.participantTeamIds ?? []));

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
    visibility: input.visibility ?? "public",
    participantTeamIds,
  };
}

export async function createCompetition(organizationId: string, input: CreateCompetitionInput) {
  const data = sanitizeCompetitionInput(input);
  const { participantTeamIds, ...competitionData } = data;

  return prisma.$transaction(async (tx) => {
    const validTeams = participantTeamIds.length
      ? await tx.team.findMany({
          where: {
            id: { in: participantTeamIds },
            organizationId,
            sport: competitionData.sport,
          },
          select: { id: true },
        })
      : [];

    const validTeamIds = new Set(validTeams.map((team) => team.id));

    return tx.competition.create({
      data: {
        ...competitionData,
        organizationId,
        venueId: competitionData.venueId ?? null,
        seasonId: competitionData.seasonId ?? null,
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

export async function updateCompetition(id: string, organizationId: string, input: Partial<CreateCompetitionInput>) {
  const current = await prisma.competition.findFirst({ where: { id, organizationId } });
  if (!current) return null;

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
    format: input.format ?? current.format,
    visibility: input.visibility ?? current.visibility,
    status: input.status ?? current.status,
    entryFee: input.entryFee ?? (current.entryFee ? Number(current.entryFee) : null),
    venueId: input.venueId ?? current.venueId,
    seasonId: input.seasonId ?? current.seasonId,
    participantTeamIds: input.participantTeamIds ?? [],
  });
  const { participantTeamIds = [], ...competitionData } = merged;

  return prisma.$transaction(async (tx) => {
    const updatedCompetition = await tx.competition.update({ where: { id }, data: competitionData, include: { teams: true } });
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
        select: { id: true },
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
  return prisma.competition.findFirst({
    where: { organizationId, id },
    include: {
      teams: {
        include: {
          team: {
            select: { id: true, name: true, sport: true },
          },
        },
      },
    },
  });
}

export async function deleteCompetition(id: string, organizationId: string) {
  const existing = await prisma.competition.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });

  if (!existing) return null;

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
      sport: team.sport,
      name: team.name,
      shortName: team.shortName,
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
      competition: true,
      homeTeam: true,
      awayTeam: true,
      venue: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  return matches.map((match) => ({
    id: match.id,
    competitionId: match.competitionId,
    competition: match.competition.name,
    competitionType: match.competition.type,
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
    venue: match.venue?.name ?? "TBD",
  }));
}

export async function listVenues(organizationId: string) {
  return prisma.venue.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
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
