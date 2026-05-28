import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canEditEntity } from "@/lib/permissions";
import type { z } from "zod";
import { playerInputSchema, playerUpdateSchema } from "@/lib/validation/player";

type PlayerInput = z.infer<typeof playerInputSchema>;
type PlayerUpdate = z.infer<typeof playerUpdateSchema>;
type PlayerHistoryPatchInput = Array<{ id?: string; teamId: string; fromYear: number; toYear: number | null }>;

export async function createPlayer(organizationId: string, createdById: string, input: PlayerInput) {
  const team = await prisma.team.findFirst({
    where: { id: input.teamId, organizationId },
    select: { id: true },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  const currentYear = new Date().getFullYear();

  return prisma.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: {
        createdById,
        sport: input.sport,
        teamId: input.teamId,
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
        position: input.position,
        number: input.number,
        nationality: input.nationalities[0] ?? null,
        nationalities: input.nationalities,
        placeOfBirth: input.placeOfBirth,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        status: input.status,
        dominantFoot: input.dominantFoot,
        profileImageUrl: input.profileImageUrl ?? null,
        dateOfBirth: new Date(input.dateOfBirth),
      },
    });

    await tx.playerClubHistory.create({
      data: {
        playerId: player.id,
        teamId: input.teamId,
        fromYear: currentYear,
        toYear: null,
      },
    });

    return player;
  });
}

export async function updatePlayer(
  organizationId: string,
  actor: { id: string; role: string },
  playerId: string,
  input: PlayerUpdate
) {
  const existing = await prisma.player.findFirst({
    where: { id: playerId, team: { organizationId } },
    select: { id: true, teamId: true, createdById: true },
  });

  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");

  if (input.teamId) {
    const team = await prisma.team.findFirst({ where: { id: input.teamId, organizationId }, select: { id: true } });
    if (!team) throw new Error("Team not found");
  }

  const firstName = input.firstName ?? null;
  const lastName = input.lastName ?? null;
  const fullName = `${(input.firstName ?? "").trim()} ${(input.lastName ?? "").trim()}`.trim();

  const currentYear = new Date().getFullYear();
  const teamChanged = input.teamId !== undefined && input.teamId !== existing.teamId;

  return prisma.$transaction(async (tx) => {
    if (teamChanged && input.teamId) {
      await tx.playerClubHistory.updateMany({
        where: {
          playerId: existing.id,
          toYear: null,
        },
        data: {
          toYear: currentYear,
        },
      });

      const openEntryForNewTeam = await tx.playerClubHistory.findFirst({
        where: {
          playerId: existing.id,
          teamId: input.teamId,
          toYear: null,
        },
        select: { id: true },
      });

      if (!openEntryForNewTeam) {
        await tx.playerClubHistory.create({
          data: {
            playerId: existing.id,
            teamId: input.teamId,
            fromYear: currentYear,
            toYear: null,
          },
        });
      }
    }

    return tx.player.update({
      where: { id: existing.id },
      data: {
        ...(input.sport !== undefined ? { sport: input.sport } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.firstName !== undefined ? { firstName } : {}),
        ...(input.lastName !== undefined ? { lastName } : {}),
        ...(input.firstName !== undefined || input.lastName !== undefined
          ? { fullName: fullName || undefined }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.number !== undefined ? { number: input.number } : {}),
        ...(input.nationalities !== undefined
          ? {
              nationalities: input.nationalities,
              nationality: input.nationalities[0] ?? null,
            }
          : {}),
        ...(input.placeOfBirth !== undefined ? { placeOfBirth: input.placeOfBirth } : {}),
        ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
        ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.dominantFoot !== undefined ? { dominantFoot: input.dominantFoot } : {}),
        ...(input.profileImageUrl !== undefined ? { profileImageUrl: input.profileImageUrl } : {}),
        ...(input.dateOfBirth !== undefined ? { dateOfBirth: new Date(input.dateOfBirth) } : {}),
      },
    });
  });
}

export async function deletePlayer(organizationId: string, actor: { id: string; role: string }, playerId: string) {
  const existing = await prisma.player.findFirst({
    where: { id: playerId, team: { organizationId } },
    select: { id: true, createdById: true },
  });
  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");
  return prisma.player.delete({ where: { id: existing.id } });
}

export async function updatePlayerClubHistory(
  organizationId: string,
  actor: { id: string; role: string },
  playerId: string,
  history: PlayerHistoryPatchInput
) {
  const existing = await prisma.player.findFirst({
    where: { id: playerId, team: { organizationId } },
    select: { id: true, createdById: true },
  });

  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");

  const existingRows = history.filter((item) => item.id);
  const allowedIds = await prisma.playerClubHistory.findMany({
    where: {
      playerId,
      player: { team: { organizationId } },
      id: { in: existingRows.map((item) => item.id as string) },
    },
    select: { id: true },
  });
  const allowedSet = new Set(allowedIds.map((item) => item.id));

  const allowedTeams = await prisma.team.findMany({
    where: {
      organizationId,
      id: { in: history.map((item) => item.teamId) },
    },
    select: { id: true },
  });
  const allowedTeamIds = new Set(allowedTeams.map((item) => item.id));

  const ops = history
    .filter((item) => allowedTeamIds.has(item.teamId))
    .map((item) => {
      if (item.id && allowedSet.has(item.id)) {
        return prisma.playerClubHistory.update({
          where: { id: item.id },
          data: { teamId: item.teamId, fromYear: item.fromYear, toYear: item.toYear },
        });
      }
      if (!item.id) {
        return prisma.playerClubHistory.create({
          data: {
            playerId,
            teamId: item.teamId,
            fromYear: item.fromYear,
            toYear: item.toYear,
          },
        });
      }
      return null;
    })
    .filter(Boolean) as Prisma.PrismaPromise<unknown>[];

  if (ops.length) {
    await prisma.$transaction(ops);
  }

  return { ok: true };
}
