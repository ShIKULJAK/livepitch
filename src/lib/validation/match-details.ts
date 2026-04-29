import { GoalType } from "@prisma/client";
import { z } from "zod";

const goalEventSchema = z
  .object({
    id: z.string().optional(),
    teamId: z.string().min(1),
    playerId: z.string().optional().nullable(),
    scorerName: z.string().max(160).optional().nullable(),
    minuteBase: z.number().int().min(1).max(300),
    minuteExtra: z.number().int().min(0).max(20).optional().nullable(),
    goalType: z.nativeEnum(GoalType),
  })
  .superRefine((event, ctx) => {
    if (!event.playerId && !event.scorerName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide scorer name or player",
        path: ["scorerName"],
      });
    }
  });

const teamStatsSchema = z
  .object({
    teamId: z.string().min(1),
    possessionSeconds: z.number().int().min(0),
    totalShots: z.number().int().min(0),
    shotsOnTarget: z.number().int().min(0),
    shotsOffTarget: z.number().int().min(0),
    totalPasses: z.number().int().min(0),
    accuratePasses: z.number().int().min(0),
    inaccuratePasses: z.number().int().min(0),
    corners: z.number().int().min(0),
    fouls: z.number().int().min(0),
    yellowCards: z.number().int().min(0),
    redCards: z.number().int().min(0),
  })
  .superRefine((stats, ctx) => {
    if (stats.shotsOnTarget + stats.shotsOffTarget > stats.totalShots) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "shotsOnTarget + shotsOffTarget must be <= totalShots",
        path: ["shotsOnTarget"],
      });
    }

    if (stats.accuratePasses + stats.inaccuratePasses !== stats.totalPasses) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "accuratePasses + inaccuratePasses must equal totalPasses",
        path: ["accuratePasses"],
      });
    }
  });

export const matchDetailsUpdateSchema = z
  .object({
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0),
    goalEvents: z.array(goalEventSchema).default([]),
    teamStats: z.array(teamStatsSchema).length(2),
  });
