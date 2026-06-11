import { CompetitionStatus, TeamApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canCreateCompetitions, canEditEntity } from "@/lib/permissions";
import type { TeamApplicationInput } from "@/lib/validation/team-application";

export async function listApplicableCompetitions(
  organizationId: string,
  filters: { q?: string; type?: "TOURNAMENT" | "LEAGUE" | "FRIENDLY_MATCH"; sport?: "FOOTBALL" | "BASKETBALL" | "HANDBALL" | "VOLLEYBALL" }
) {
  const now = new Date();
  const competitions = await prisma.competition.findMany({
    where: {
      organizationId,
      AND: [
        {
          OR: [
            { status: { in: [CompetitionStatus.DRAFT, CompetitionStatus.UPCOMING] } },
            { type: "LEAGUE", status: CompetitionStatus.ONGOING },
          ],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ],
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { season: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.sport ? { sport: filters.sport } : {}),
    },
    include: { season: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }],
  });

  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      type: typeof competitions[number]["type"];
      status: typeof competitions[number]["status"];
      sport: typeof competitions[number]["sport"];
      startDate: Date | null;
      endDate: Date | null;
      seasonLabel: string | null;
      seasonOptions: Array<{ competitionId: string; seasonId: string | null; seasonLabel: string | null }>;
    }
  >();

  for (const competition of competitions) {
    const key = `${competition.name}__${competition.type}__${competition.sport}`;
    const option = {
      competitionId: competition.id,
      seasonId: competition.seasonId,
      seasonLabel: competition.season?.name ?? null,
    };
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: competition.id,
        name: competition.name,
        type: competition.type,
        status: competition.status,
        seasonLabel: competition.season?.name ?? null,
        sport: competition.sport,
        startDate: competition.startDate,
        endDate: competition.endDate,
        seasonOptions: [option],
      });
      continue;
    }
    existing.seasonOptions.push(option);
  }

  return Array.from(grouped.values()).map((entry) => ({
    ...entry,
    seasonOptions: entry.seasonOptions.sort((a, b) => (b.seasonLabel ?? "").localeCompare(a.seasonLabel ?? "")),
  }));
}

export async function submitTeamApplication(
  organizationId: string,
  submittedByUserId: string | null,
  input: TeamApplicationInput
) {
  const competition = await prisma.competition.findFirst({
    where: { id: input.competitionId, organizationId },
    select: { id: true, seasonId: true, sport: true, status: true, type: true, endDate: true },
  });
  if (!competition) throw new Error("Competition not found.");
  const canAcceptApplication =
    competition.status === CompetitionStatus.DRAFT ||
    competition.status === CompetitionStatus.UPCOMING ||
    (competition.type === "LEAGUE" &&
      competition.status === CompetitionStatus.ONGOING &&
      (!competition.endDate || competition.endDate >= new Date()));
  if (!canAcceptApplication) {
    throw new Error("Prijava je dozvoljena samo za aktivna takmičenja koja još primaju prijave.");
  }

  const uniqueYears = Array.from(new Set(input.generationYears)).sort((a, b) => b - a);
  const orderByGeneration = new Map<number, number>();
  const uniquePlayers = input.players.map((item) => {
    const currentOrder = (orderByGeneration.get(item.generationYear) ?? 0) + 1;
    orderByGeneration.set(item.generationYear, currentOrder);
    return {
      generationYear: item.generationYear,
      birthYear: item.birthYear,
      jerseyNumber: item.jerseyNumber,
      fullName: item.fullName.trim(),
      order: currentOrder,
    };
  });
  const uniqueCoaches = input.coaches.map((item, index) => ({
    fullName: item.fullName.trim(),
    phone: item.phone?.trim() ?? "",
    email: item.email?.trim() ? item.email.trim() : null,
    order: index + 1,
  }));

  const normalizedTeamName = input.teamName.trim();
  const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedTeamNameKey = normalizeName(normalizedTeamName);
  const now = new Date();
  const submittedDate = new Date(`${input.submittedDate}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    const existingApplications = await tx.teamApplication.findMany({
      where: {
        competitionId: competition.id,
        ...(input.teamId ? { OR: [{ teamId: input.teamId }, { teamName: { contains: normalizedTeamName } }] } : {}),
      },
      select: { id: true, teamName: true, submittedAt: true },
    });
    const nameMatched = existingApplications.filter((item) => normalizeName(item.teamName) === normalizedTeamNameKey);
    const fallbackByName = nameMatched.length
      ? nameMatched
      : await tx.teamApplication.findMany({
          where: { competitionId: competition.id },
          select: { id: true, teamName: true, submittedAt: true },
        }).then((items) => items.filter((item) => normalizeName(item.teamName) === normalizedTeamNameKey));

    const dedupedCandidates = [...nameMatched, ...fallbackByName].filter(
      (item, index, array) => array.findIndex((entry) => entry.id === item.id) === index
    );
    const existingApplication = dedupedCandidates
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];

    if (dedupedCandidates.length > 1) {
      const duplicateIds = dedupedCandidates.filter((item) => item.id !== existingApplication.id).map((item) => item.id);
      if (duplicateIds.length) {
        await tx.teamApplication.deleteMany({
          where: {
            id: { in: duplicateIds },
          },
        });
      }
    }

    if (!existingApplication) {
      return tx.teamApplication.create({
        data: {
          competitionId: competition.id,
          teamId: input.teamId ?? null,
          teamName: normalizedTeamName,
          place: input.place.trim(),
          submittedDate,
          submittedByUserId,
          submittedAt: now,
          generations: {
            createMany: {
              data: uniqueYears.map((generationYear) => ({
                generationYear,
                isRequested: true,
              })),
            },
          },
          players: {
            createMany: {
              data: uniquePlayers,
            },
          },
          coaches: {
            createMany: {
              data: uniqueCoaches,
            },
          },
        },
        include: {
          generations: true,
          players: true,
          coaches: true,
        },
      });
    }

    await tx.teamApplicationGeneration.deleteMany({ where: { applicationId: existingApplication.id } });
    await tx.applicationPlayer.deleteMany({ where: { applicationId: existingApplication.id } });
    await tx.applicationCoach.deleteMany({ where: { applicationId: existingApplication.id } });

    const updated = await tx.teamApplication.update({
      where: { id: existingApplication.id },
      data: {
        teamId: input.teamId ?? null,
        teamName: normalizedTeamName,
        place: input.place.trim(),
        submittedDate,
        submittedByUserId,
        submittedAt: now,
        status: TeamApplicationStatus.PENDING,
        approvedAt: null,
        approvedByUserId: null,
      },
    });

    if (uniqueYears.length) {
      await tx.teamApplicationGeneration.createMany({
        data: uniqueYears.map((generationYear) => ({
          applicationId: existingApplication.id,
          generationYear,
          isRequested: true,
        })),
      });
    }

    if (uniquePlayers.length) {
      await tx.applicationPlayer.createMany({
        data: uniquePlayers.map((player) => ({
          applicationId: existingApplication.id,
          generationYear: player.generationYear,
          birthYear: player.birthYear,
          jerseyNumber: player.jerseyNumber,
          fullName: player.fullName,
          order: player.order,
        })),
      });
    }

    if (uniqueCoaches.length) {
      await tx.applicationCoach.createMany({
        data: uniqueCoaches.map((coach) => ({
          applicationId: existingApplication.id,
          fullName: coach.fullName,
          phone: coach.phone,
          email: coach.email,
          order: coach.order,
        })),
      });
    }

    return tx.teamApplication.findUniqueOrThrow({
      where: { id: updated.id },
      include: { generations: true, players: true, coaches: true },
    });
  });
}

export async function listTeamApplicationsForCompetition(organizationId: string, competitionId: string) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    include: { season: { select: { id: true, name: true } } },
  });
  if (!competition) return null;

  const sameSeriesCompetitions = await prisma.competition.findMany({
    where: {
      organizationId,
      name: competition.name,
      type: competition.type,
      sport: competition.sport,
    },
    include: { season: { select: { id: true, name: true } } },
    orderBy: [{ season: { name: "desc" } }, { createdAt: "desc" }],
  });

  const applications = await prisma.teamApplication.findMany({
    where: {
      competitionId: { in: sameSeriesCompetitions.map((item) => item.id) },
    },
    include: {
      competition: { include: { season: { select: { id: true, name: true } } } },
      generations: { orderBy: { generationYear: "desc" } },
    },
    orderBy: [{ submittedAt: "desc" }],
  });

  return {
    competitionId: competition.id,
    seasonOptions: sameSeriesCompetitions.map((item) => ({
      competitionId: item.id,
      seasonId: item.seasonId,
      seasonLabel: item.season?.name ?? null,
    })),
    defaultSeasonCompetitionId: competition.id,
    applications: applications.map((application) => ({
      id: application.id,
      competitionId: application.competitionId,
      competitionName: application.competition.name,
      seasonLabel: application.competition.season?.name ?? null,
      teamName: application.teamName,
      place: application.place,
      submittedAt: application.submittedAt,
      submittedDate: application.submittedDate,
      status: application.status,
      generations: application.generations.map((generation) => ({
        generationYear: generation.generationYear,
        isRequested: generation.isRequested,
        isApproved: generation.isApproved,
      })),
    })),
  };
}

export async function approveTeamApplicationGenerations(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  input: { applicationId: string; approvedGenerationYears: number[] }
) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    select: { id: true, createdById: true, sport: true },
  });
  if (!competition) return null;
  if (!canCreateCompetitions(actor.role) || !canEditEntity(actor, competition)) throw new Error("Forbidden");

  const application = await prisma.teamApplication.findFirst({
    where: { id: input.applicationId, competitionId },
    include: { generations: true },
  });
  if (!application) throw new Error("Application not found.");

  const approvedYears = new Set(input.approvedGenerationYears);
  const team =
    application.teamId
      ? await prisma.team.findFirst({ where: { id: application.teamId, organizationId }, select: { id: true, name: true } })
      : null;

  const ensuredTeam =
    team ??
    (await prisma.team.create({
      data: {
        organizationId,
        name: application.teamName,
        shortName: application.teamName.slice(0, 20),
        place: application.place,
        city: application.place,
        country: "N/A",
        coach: "N/A",
        sport: competition.sport,
        createdById: actor.id,
      },
      select: { id: true, name: true },
    }));

  await prisma.$transaction(async (tx) => {
    await tx.teamApplication.update({
      where: { id: application.id },
      data: {
        status: TeamApplicationStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: actor.id,
        teamId: ensuredTeam.id,
      },
    });

    await tx.competitionTeam.upsert({
      where: { competitionId_teamId: { competitionId, teamId: ensuredTeam.id } },
      update: {},
      create: { competitionId, teamId: ensuredTeam.id },
    });

    for (const generation of application.generations) {
      await tx.teamApplicationGeneration.update({
        where: { id: generation.id },
        data: { isApproved: approvedYears.has(generation.generationYear) },
      });
    }

    for (const generationYear of approvedYears) {
      await tx.competitionTeamGeneration.upsert({
        where: {
          competitionId_teamId_generationYear: {
            competitionId,
            teamId: ensuredTeam.id,
            generationYear,
          },
        },
        update: {
          isApproved: true,
          approvedAt: new Date(),
          approvedById: actor.id,
          ageGroupLabel: `U${Math.max(0, new Date().getFullYear() - generationYear)}`,
        },
        create: {
          competitionId,
          teamId: ensuredTeam.id,
          generationYear,
          isApproved: true,
          approvedAt: new Date(),
          approvedById: actor.id,
          ageGroupLabel: `U${Math.max(0, new Date().getFullYear() - generationYear)}`,
        },
      });
    }
  });

  return { ok: true };
}

export async function rejectTeamApplication(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  input: { applicationId: string }
) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    select: { id: true, createdById: true },
  });
  if (!competition) return null;
  if (!canCreateCompetitions(actor.role) || !canEditEntity(actor, competition)) throw new Error("Forbidden");

  const application = await prisma.teamApplication.findFirst({
    where: { id: input.applicationId, competitionId },
    select: { id: true, teamId: true, generations: { select: { generationYear: true } } },
  });
  if (!application) throw new Error("Application not found.");

  await prisma.$transaction(async (tx) => {
    await tx.teamApplication.update({
      where: { id: application.id },
      data: {
        status: TeamApplicationStatus.REJECTED,
        approvedAt: null,
        approvedByUserId: null,
      },
    });
    await tx.teamApplicationGeneration.updateMany({
      where: { applicationId: application.id },
      data: { isApproved: false },
    });

    if (application.teamId) {
      const affectedGenerationYears = application.generations.map((item) => item.generationYear);
      if (affectedGenerationYears.length) {
        await tx.competitionTeamGeneration.updateMany({
          where: {
            competitionId,
            teamId: application.teamId,
            generationYear: { in: affectedGenerationYears },
          },
          data: {
            isApproved: false,
            approvedAt: null,
            approvedById: null,
          },
        });
      }

      const hasAnyApprovedGeneration = await tx.competitionTeamGeneration.count({
        where: {
          competitionId,
          teamId: application.teamId,
          isApproved: true,
        },
      });

      if (hasAnyApprovedGeneration === 0) {
        await tx.competitionTeam.deleteMany({
          where: {
            competitionId,
            teamId: application.teamId,
          },
        });
      }
    }
  });

  return { ok: true };
}

export async function listCompetitionTeamGenerationParticipants(organizationId: string, competitionId: string) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    include: {
      teams: { include: { team: { select: { id: true, name: true } } } },
      teamGenerations: { where: { isApproved: true } },
    },
  });
  if (!competition) return null;

  const byTeam = new Map<string, number[]>();
  for (const item of competition.teamGenerations) {
    const list = byTeam.get(item.teamId) ?? [];
    list.push(item.generationYear);
    byTeam.set(item.teamId, list);
  }

  return {
    competitionId: competition.id,
    participants: competition.teams.map((entry) => ({
      teamId: entry.teamId,
      teamName: entry.team.name,
      generationYears: (byTeam.get(entry.teamId) ?? []).sort((a, b) => b - a),
    })),
  };
}
