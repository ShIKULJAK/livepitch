import { z } from "zod";

export const pitchInputSchema = z.object({
  venueId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  surface: z.string().trim().max(80).optional().nullable(),
  generationLabel: z.string().regex(/^Generacija \d{4}$/).optional().nullable(),
  ageGroupCode: z.string().trim().min(1).max(20).optional().nullable(),
  playerFormat: z.string().trim().min(1).max(20),
  fieldLengthMeters: z.number().int().positive(),
  fieldWidthMeters: z.number().int().positive(),
  goalWidthMeters: z.number().positive().optional().nullable(),
  goalHeightMeters: z.number().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const pitchUpdateSchema = pitchInputSchema.partial();
