import { CompetitionStatus, CompetitionType, SportType } from "@prisma/client";
import { z } from "zod";

export const competitionQuerySchema = z.object({
  q: z.string().optional(),
  type: z.nativeEnum(CompetitionType).optional(),
  status: z.nativeEnum(CompetitionStatus).optional(),
});

export const createCompetitionSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.nativeEnum(CompetitionType),
  sport: z.nativeEnum(SportType).default(SportType.FOOTBALL),
  description: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  registrationDeadline: z.string().datetime().optional().nullable(),
  teamCount: z.number().int().min(2).max(64).optional().nullable(),
  maxTeams: z.number().int().min(2).max(128).optional().nullable(),
  teamSize: z.number().int().min(5).max(15).optional().nullable(),
  substitutions: z.number().int().min(0).max(12).optional().nullable(),
  matchDurationMinutes: z.number().int().min(1).max(240),
  format: z.string().max(120).optional().nullable(),
  visibility: z.string().max(40).optional().nullable(),
  status: z.nativeEnum(CompetitionStatus).default(CompetitionStatus.DRAFT),
  entryFee: z.number().min(0).max(999999).optional().nullable(),
  venueId: z.string().optional().nullable(),
  seasonId: z.string().optional().nullable(),
  participantTeamIds: z.array(z.string().min(1)).max(256).default([]),
});

export const updateCompetitionSchema = createCompetitionSchema.partial();

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
