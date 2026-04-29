import { SportType } from "@prisma/client";
import { z } from "zod";

export const teamInputSchema = z.object({
  sport: z.nativeEnum(SportType).default(SportType.FOOTBALL),
  name: z.string().min(2).max(120),
  shortName: z.string().max(20).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  coach: z.string().max(120).optional().nullable(),
  profileImageUrl: z.string().max(512).optional().nullable(),
});

export const teamUpdateSchema = teamInputSchema.partial();

