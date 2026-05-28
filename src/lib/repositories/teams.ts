import { prisma } from "@/lib/db/prisma";
import { canEditEntity } from "@/lib/permissions";
import type { z } from "zod";
import { teamInputSchema, teamUpdateSchema } from "@/lib/validation/team";

type TeamInput = z.infer<typeof teamInputSchema>;
type TeamUpdate = z.infer<typeof teamUpdateSchema>;

export async function createTeam(organizationId: string, createdById: string, input: TeamInput) {
  return prisma.team.create({
    data: {
      organizationId,
      createdById,
      sport: input.sport,
      name: input.name,
      shortName: input.shortName ?? null,
      place: input.place ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      coach: input.coach ?? null,
      homeVenueId: input.homeVenueId ?? null,
      profileImageUrl: input.profileImageUrl ?? null,
    },
  });
}

export async function updateTeam(
  organizationId: string,
  actor: { id: string; role: string },
  teamId: string,
  input: TeamUpdate
) {
  const existing = await prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true, createdById: true } });
  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");

  return prisma.team.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sport !== undefined ? { sport: input.sport } : {}),
      ...(input.shortName !== undefined ? { shortName: input.shortName } : {}),
      ...(input.place !== undefined ? { place: input.place } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.coach !== undefined ? { coach: input.coach } : {}),
      ...(input.homeVenueId !== undefined ? { homeVenueId: input.homeVenueId } : {}),
      ...(input.profileImageUrl !== undefined ? { profileImageUrl: input.profileImageUrl } : {}),
    },
  });
}

export async function deleteTeam(organizationId: string, actor: { id: string; role: string }, teamId: string) {
  const existing = await prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true, createdById: true } });
  if (!existing) return null;
  if (!canEditEntity(actor, existing)) throw new Error("Forbidden");
  return prisma.team.delete({ where: { id: existing.id } });
}
