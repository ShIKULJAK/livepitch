import { DominantFoot, PlayerStatus, SportType } from "@prisma/client";
import { z } from "zod";

export const playerInputSchema = z.object({
  sport: z.nativeEnum(SportType).default(SportType.FOOTBALL),
  teamId: z.string().min(1, "Team is required"),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  position: z.string().min(1).max(40),
  number: z.number().int().min(1).max(99),
  dateOfBirth: z.string().datetime(),
  placeOfBirth: z.string().min(1).max(120),
  nationalities: z.array(z.string().min(2).max(120)).min(1, "At least one nationality is required"),
  heightCm: z.number().int().positive(),
  weightKg: z.number().int().positive(),
  status: z.nativeEnum(PlayerStatus).default(PlayerStatus.ACTIVE),
  dominantFoot: z.nativeEnum(DominantFoot).default(DominantFoot.RIGHT),
  profileImageUrl: z.string().max(512).optional().nullable(),
  bio: z.string().max(1200).optional().nullable(),
  radarDefending: z.number().int().min(0).max(100).optional().nullable(),
  radarPhysical: z.number().int().min(0).max(100).optional().nullable(),
  radarSpeed: z.number().int().min(0).max(100).optional().nullable(),
  radarPassing: z.number().int().min(0).max(100).optional().nullable(),
  radarGameIQ: z.number().int().min(0).max(100).optional().nullable(),
  achievements: z.array(z.string().min(1).max(120)).optional(),
  strengths: z.array(z.string().min(1).max(120)).optional(),
  improvements: z.array(z.string().min(1).max(120)).optional(),
  coachNote: z.string().max(1200).optional().nullable(),
});

export const playerUpdateSchema = playerInputSchema.partial();

export const playerHistoryPatchSchema = z.object({
  clubHistory: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        teamId: z.string().min(1),
        fromYear: z.number().int().min(1900).max(3000),
        toYear: z.number().int().min(1900).max(3000).nullable(),
      })
    )
    .optional(),
});
