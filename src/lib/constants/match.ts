import { GoalType } from "@prisma/client";

export const GOAL_TYPE_OPTIONS: Array<{ value: GoalType; label: string }> = [
  { value: GoalType.OPEN_PLAY, label: "Open Play" },
  { value: GoalType.PENALTY, label: "Penalty" },
  { value: GoalType.OWN_GOAL, label: "Own Goal" },
  { value: GoalType.FREE_KICK, label: "Free Kick" },
  { value: GoalType.CORNER, label: "Corner" },
  { value: GoalType.REBOUND, label: "Rebound" },
  { value: GoalType.HEADER, label: "Header" },
  { value: GoalType.OTHER, label: "Other" },
];

export const TEAM_STAT_FIELDS = [
  { key: "totalShots", label: "Total Shots" },
  { key: "shotsOnTarget", label: "Shots on Target" },
  { key: "shotsOffTarget", label: "Shots off Target" },
  { key: "totalPasses", label: "Total Passes" },
  { key: "accuratePasses", label: "Accurate Passes" },
  { key: "inaccuratePasses", label: "Inaccurate Passes" },
  { key: "corners", label: "Corners" },
  { key: "fouls", label: "Fouls / Prekrsaji" },
  { key: "yellowCards", label: "Yellow Cards" },
  { key: "redCards", label: "Red Cards" },
] as const;

export function formatGoalMinute(minuteBase: number, minuteExtra?: number | null, regularTimeMinutes = 90) {
  if (minuteExtra && minuteExtra > 0) {
    return `${minuteBase}+${minuteExtra}`;
  }

  if (minuteBase > regularTimeMinutes) {
    return `${regularTimeMinutes}+${minuteBase - regularTimeMinutes}`;
  }

  return `${minuteBase}`;
}

export function calculatePossessionPercentages(homeSeconds: number, awaySeconds: number) {
  const safeHome = Math.max(0, homeSeconds);
  const safeAway = Math.max(0, awaySeconds);
  const total = safeHome + safeAway;

  if (total <= 0) {
    return { home: 50, away: 50 };
  }

  const home = Math.round((safeHome / total) * 100);
  return { home, away: 100 - home };
}
