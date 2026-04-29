import { z } from "zod";

export const drawConfigSchema = z
  .object({
    groupStageEnabled: z.boolean().default(true),
    groupsCount: z.number().int().min(1).max(32).default(4),
    roundOf16Enabled: z.boolean().default(false),
    quarterfinalsEnabled: z.boolean().default(true),
    thirdPlaceMatchEnabled: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.groupStageEnabled && value.groupsCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Group count must be at least 1.",
        path: ["groupsCount"],
      });
    }

    if (!value.roundOf16Enabled && !value.quarterfinalsEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Knockout must start with Round of 16 or Quarterfinal.",
        path: ["quarterfinalsEnabled"],
      });
    }
  });

export type DrawConfigInput = z.infer<typeof drawConfigSchema>;
