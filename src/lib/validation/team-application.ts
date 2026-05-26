import { CompetitionType, SportType } from "@prisma/client";
import { z } from "zod";

const currentYear = new Date().getFullYear();
const minAllowedYear = currentYear - 18;
const maxAllowedYear = currentYear - 5;

export const teamApplicationQuerySchema = z.object({
  competitionId: z.string().optional(),
  q: z.string().optional(),
  type: z.nativeEnum(CompetitionType).optional(),
  sport: z.nativeEnum(SportType).optional(),
});

export const teamApplicationInputSchema = z.object({
  competitionId: z.string().min(1),
  teamId: z.string().optional().nullable(),
  teamName: z.string().trim().min(2).max(120),
  generationYears: z.array(z.number().int().min(minAllowedYear).max(maxAllowedYear)).min(1).max(32),
  players: z
    .array(
      z.object({
        generationYear: z.number().int().min(minAllowedYear).max(maxAllowedYear),
        birthYear: z.number().int().min(minAllowedYear).max(maxAllowedYear),
        jerseyNumber: z.number().int().min(0).max(99),
        fullName: z.string().trim().min(2).max(120),
      })
    )
    .max(64)
    .default([]),
  coaches: z
    .array(
      z.object({
        fullName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        email: z.string().trim().email().optional().or(z.literal("")),
      })
    )
    .min(1)
    .max(8),
  place: z.string().trim().min(2).max(120),
  submittedDate: z.string().date(),
}).superRefine((value, ctx) => {
  const allowedYears = new Set(value.generationYears);
  const playersByYear = new Map<number, number>();

  for (const player of value.players) {
    if (!allowedYears.has(player.generationYear)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["players"],
        message: "Player generation must be one of selected generations.",
      });
      continue;
    }
    playersByYear.set(player.generationYear, (playersByYear.get(player.generationYear) ?? 0) + 1);
  }

});

export const approveTeamApplicationSchema = z.object({
  applicationId: z.string().min(1),
  approvedGenerationYears: z.array(z.number().int().min(minAllowedYear).max(maxAllowedYear)).min(1).max(32),
});

export type TeamApplicationInput = z.infer<typeof teamApplicationInputSchema>;
