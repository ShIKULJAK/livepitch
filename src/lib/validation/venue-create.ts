import { z } from "zod";

export const venueCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  capacity: z.number().int().min(0).optional().nullable(),
  surface: z.string().trim().max(80).optional().nullable(),
  dimensions: z.string().trim().max(80).optional().nullable(),
  lighting: z.boolean().optional(),
  accessibility: z.string().trim().max(160).optional().nullable(),
});
