import { MatchStatus } from "@prisma/client";

const NON_AUTO_FINISH_STATUSES = new Set<MatchStatus>([
  MatchStatus.FINISHED,
  MatchStatus.POSTPONED,
  MatchStatus.CANCELED,
]);

export function getEffectiveMatchStatus(input: {
  scheduledAt: Date | string;
  status: MatchStatus;
  regularTimeMinutes?: number | null;
  now?: Date;
}) {
  const scheduledAt = input.scheduledAt instanceof Date ? input.scheduledAt : new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return input.status;
  }

  if (NON_AUTO_FINISH_STATUSES.has(input.status)) {
    return input.status;
  }

  const now = input.now ?? new Date();
  const durationMinutes = Math.max(0, input.regularTimeMinutes ?? 0);
  const endsAt = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

  return now >= endsAt ? MatchStatus.FINISHED : input.status;
}
