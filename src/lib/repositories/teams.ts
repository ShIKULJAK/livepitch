import { prisma } from "@/lib/db/prisma";
import type { z } from "zod";
import { teamInputSchema, teamUpdateSchema } from "@/lib/validation/team";

type TeamInput = z.infer<typeof teamInputSchema>;
type TeamUpdate = z.infer<typeof teamUpdateSchema>;

export async function createTeam(organizationId: string, input: TeamInput) {
  return prisma.team.create({
    data: {
      organizationId,
      sport: input.sport,
      name: input.name,
      shortName: input.shortName ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      coach: input.coach ?? null,
      profileImageUrl: input.profileImageUrl ?? null,
    },
  });
}

export async function updateTeam(organizationId: string, teamId: string, input: TeamUpdate) {
  const existing = await prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true } });
  if (!existing) return null;

  return prisma.team.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sport !== undefined ? { sport: input.sport } : {}),
      ...(input.shortName !== undefined ? { shortName: input.shortName } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.coach !== undefined ? { coach: input.coach } : {}),
      ...(input.profileImageUrl !== undefined ? { profileImageUrl: input.profileImageUrl } : {}),
    },
  });
}

export async function deleteTeam(organizationId: string, teamId: string) {
  const existing = await prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true } });
  if (!existing) return null;
  return prisma.team.delete({ where: { id: existing.id } });
}

