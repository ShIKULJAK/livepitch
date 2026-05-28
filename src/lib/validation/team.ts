import { SportType } from "@prisma/client";
import { z } from "zod";

export const teamInputSchema = z.object({
  sport: z.nativeEnum(SportType).default(SportType.FOOTBALL),
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(1).max(20),
  place: z.string().max(120).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  coach: z.string().trim().min(1).max(120),
  homeVenueId: z.string().trim().min(1).optional().nullable(),
  profileImageUrl: z.string().max(512).optional().nullable(),
});

export const teamUpdateSchema = teamInputSchema.partial();
