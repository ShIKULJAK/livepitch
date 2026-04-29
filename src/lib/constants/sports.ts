import { SportType } from "@prisma/client";

export const SPORT_OPTIONS: Array<{ value: SportType; label: string }> = [
  { value: SportType.FOOTBALL, label: "Football" },
  { value: SportType.BASKETBALL, label: "Basketball" },
  { value: SportType.HANDBALL, label: "Handball" },
  { value: SportType.VOLLEYBALL, label: "Volleyball" },
];

