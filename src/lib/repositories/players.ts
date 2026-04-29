import { prisma } from "@/lib/db/prisma";
import type { z } from "zod";
import { playerInputSchema, playerUpdateSchema } from "@/lib/validation/player";

type PlayerInput = z.infer<typeof playerInputSchema>;
type PlayerUpdate = z.infer<typeof playerUpdateSchema>;

export async function createPlayer(organizationId: string, input: PlayerInput) {
  const team = await prisma.team.findFirst({
    where: { id: input.teamId, organizationId },
    select: { id: true },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  return prisma.player.create({
    data: {
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
}

export async function updatePlayer(organizationId: string, playerId: string, input: PlayerUpdate) {
  const existing = await prisma.player.findFirst({
    where: { id: playerId, team: { organizationId } },
    select: { id: true, teamId: true },
  });

  if (!existing) return null;

  if (input.teamId) {
    const team = await prisma.team.findFirst({ where: { id: input.teamId, organizationId }, select: { id: true } });
    if (!team) throw new Error("Team not found");
  }

  const firstName = input.firstName ?? null;
  const lastName = input.lastName ?? null;
  const fullName = `${(input.firstName ?? "").trim()} ${(input.lastName ?? "").trim()}`.trim();

  return prisma.player.update({
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
}

export async function deletePlayer(organizationId: string, playerId: string) {
  const existing = await prisma.player.findFirst({
    where: { id: playerId, team: { organizationId } },
    select: { id: true },
  });
  if (!existing) return null;
  return prisma.player.delete({ where: { id: existing.id } });
}
