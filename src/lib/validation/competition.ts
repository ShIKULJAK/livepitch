import { CompetitionStatus, CompetitionType, SportType } from "@prisma/client";
import { z } from "zod";

export const competitionQuerySchema = z.object({
  q: z.string().optional(),
  type: z.nativeEnum(CompetitionType).optional(),
  status: z.nativeEnum(CompetitionStatus).optional(),
  seasonYear: z.string().regex(/^\d{4}$/).optional(),
});

const scheduleDaySchema = z
  .object({
    dayLabel: z.string().trim().min(1).max(40),
    dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    generationLabel: z.string().regex(/^Generacija \d{4}$/),
    pitchId: z.string().optional().nullable(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .superRefine((value, ctx) => {
    const [sh, sm] = value.startTime.split(":").map(Number);
    const [eh, em] = value.endTime.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time.",
      });
    }
  });

const competitionBaseSchema = z.object({
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
  stadiumName: z.string().trim().min(2).max(120),
  pitchNames: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
  scheduleDays: z.array(scheduleDaySchema).min(1).max(30),
  format: z.string().max(120).optional().nullable(),
  visibility: z.string().max(40).optional().nullable(),
  status: z.nativeEnum(CompetitionStatus).default(CompetitionStatus.DRAFT),
  entryFee: z.number().min(0).max(999999).optional().nullable(),
  venueId: z.string().optional().nullable(),
  seasonId: z.string().optional().nullable(),
  seasonLabel: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^(\d{4}(\/\d{4})?)$/, "Season must be in format YYYY or YYYY/YYYY"),
  participantTeamIds: z.array(z.string().min(1)).max(256).default([]),
});

export const createCompetitionSchema = competitionBaseSchema.superRefine((value, ctx) => {
  const normalized = value.pitchNames.map((name) => name.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pitchNames"],
      message: "Pitch names must be unique within the same stadium.",
    });
  }
});

export const updateCompetitionSchema = competitionBaseSchema.partial().superRefine((value, ctx) => {
  if (!value.pitchNames) return;
  const normalized = value.pitchNames.map((name) => name.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pitchNames"],
      message: "Pitch names must be unique within the same stadium.",
    });
  }
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
