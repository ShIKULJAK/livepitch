import { MatchStatus } from "@prisma/client";
import { z } from "zod";

export const matchInputSchema = z.object({
  competitionId: z.string().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  venueId: z.string().optional().nullable(),
  venueLabel: z.string().max(180).optional().nullable(),
  pitchName: z.string().max(80).optional().nullable(),
  round: z.string().max(80).optional().nullable(),
  scheduledAt: z.string().datetime(),
  status: z.nativeEnum(MatchStatus).optional(),
  homeScore: z.number().int().min(0).optional().nullable(),
  awayScore: z.number().int().min(0).optional().nullable(),
  liveMinute: z.number().int().min(0).optional().nullable(),
  regularTimeMinutes: z.number().int().min(1).max(300).optional(),
});

export const matchUpdateSchema = matchInputSchema.partial();

