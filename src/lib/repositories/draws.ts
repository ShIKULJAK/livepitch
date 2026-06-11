import { CompetitionType, DrawRoundType, DrawSourceType, Prisma } from "@prisma/client";
import { canEditEntity } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { syncMaterializedKnockoutMatches } from "@/lib/repositories/matches";
import type { DrawConfigInput } from "@/lib/validation/draw";
import { getGenerationPreset } from "@/lib/constants/generation-presets";

type Participant = { id: string; name: string };
type RoundMatchSeed = {
  homeSourceType: DrawSourceType;
  homeSourceValue: string;
  awaySourceType: DrawSourceType;
  awaySourceValue: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  order: number;
};

type GroupFixtureSeed = {
  drawGroupId: string;
  groupName: string;
  homeTeamId: string;
  awayTeamId: string;
  groupOrder: number;
  seedOrder: number;
  roundLabel?: string;
};

type ScheduleInterval = { startAt: number; endAt: number };
type ScheduleStageScope = "GROUP_STAGE" | "KNOCKOUT" | "ALL";
type ScheduleDayConfig = {
  dayLabel: string;
  dayDate?: string;
  generationLabel?: string;
  pitchId?: string | null;
  pitchName?: string | null;
  startTime: string;
  endTime: string;
  stageScope?: ScheduleStageScope;
};

const ALL_GENERATIONS_LABEL = "Sve generacije";

type GenerationProfile = {
  playerFormat: string;
  fieldLengthMeters: number;
  fieldWidthMeters: number;
  goalWidthMeters?: number;
  goalHeightMeters?: number;
};

function resolveGenerationProfile(generationLabel: string): GenerationProfile | null {
  const year = Number(generationLabel.replace("Generacija ", ""));
  if (Number.isFinite(year)) {
    if (year >= 2018 && year <= 2021) return { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25, goalWidthMeters: 5, goalHeightMeters: 2 };
    if (year >= 2016 && year <= 2017) return { playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40, goalWidthMeters: 5, goalHeightMeters: 2 };
    if (year >= 2014 && year <= 2015) return { playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50, goalWidthMeters: 5, goalHeightMeters: 2 };
    if (year >= 2011 && year <= 2013) return { playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50, goalWidthMeters: 6.4, goalHeightMeters: 2.13 };
  }
  const preset = getGenerationPreset(generationLabel);
  if (!preset) return null;
  return {
    playerFormat: preset.playerFormat,
    fieldLengthMeters: preset.fieldLengthMeters,
    fieldWidthMeters: preset.fieldWidthMeters,
    goalWidthMeters: preset.goalWidthMeters,
    goalHeightMeters: preset.goalHeightMeters,
  };
}

function adjacentGenerationYears(generationYear: number | null | undefined) {
  if (!generationYear) return [];
  return [generationYear - 1, generationYear + 1];
}

function scheduledMatchIntervals(
  matches: Array<{ scheduledAt: Date; regularTimeMinutes: number }>,
  fallbackDurationMinutes: number
): ScheduleInterval[] {
  return matches.map((match) => {
    const startAt = match.scheduledAt.getTime();
    const durationMinutes =
      Number.isFinite(match.regularTimeMinutes) && match.regularTimeMinutes > 0
        ? match.regularTimeMinutes
        : fallbackDurationMinutes;
    return { startAt, endAt: startAt + (durationMinutes + 5) * 60 * 1000 };
  });
}

function scheduledSlotIntervals(
  slots: Array<{ scheduledAt: Date | null }>,
  durationMinutes: number
): ScheduleInterval[] {
  return slots.flatMap((slot) => {
    if (!slot.scheduledAt) return [];
    const startAt = slot.scheduledAt.getTime();
    return [{ startAt, endAt: startAt + durationMinutes * 60 * 1000 }];
  });
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function firstSaturdayOnOrAfter(date: Date) {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = base.getUTCDay();
  const offset = (6 - day + 7) % 7;
  return addUtcDays(base, offset);
}

function buildLeagueRoundScheduleDays(input: {
  baseDate: Date;
  roundIndex: number;
  templates: ScheduleDayConfig[];
  includeWeekdays: boolean;
}) {
  const templates = input.templates.length
    ? input.templates
    : [{ dayLabel: "Dan 1", startTime: "09:00", endTime: "19:00" }];
  const weekStart = input.includeWeekdays
    ? addUtcDays(input.baseDate, input.roundIndex * 7)
    : addUtcDays(firstSaturdayOnOrAfter(input.baseDate), input.roundIndex * 7);
  const dates = input.includeWeekdays
    ? Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index))
    : [weekStart, addUtcDays(weekStart, 1)];

  return dates.flatMap((date, dayIndex) =>
    templates.map((template) => ({
      ...template,
      dayLabel: `Kolo ${input.roundIndex + 1} - ${
        input.includeWeekdays
          ? `Dan ${dayIndex + 1}`
          : dayIndex === 0
            ? "Subota"
            : "Nedjelja"
      }`,
      dayDate: toDateKey(date),
      stageScope: "ALL" as const,
    }))
  );
}

function normalizeStageScope(value?: string | null): ScheduleStageScope {
  if (value === "GROUP_STAGE" || value === "KNOCKOUT" || value === "ALL") return value;
  return "ALL";
}

function scorePitchForGeneration(
  pitch: { generationLabel: string | null; playerFormat: string; fieldLengthMeters: number; fieldWidthMeters: number },
  generationLabel: string
) {
  const preset = resolveGenerationProfile(generationLabel);
  if (!preset) return 0;
  let score = 0;
  if (pitch.generationLabel?.trim() === generationLabel) score += 100;
  if (pitch.playerFormat.trim().toLowerCase() === preset.playerFormat.trim().toLowerCase()) score += 40;
  const lengthDiff = Math.abs(pitch.fieldLengthMeters - preset.fieldLengthMeters);
  const widthDiff = Math.abs(pitch.fieldWidthMeters - preset.fieldWidthMeters);
  const dimPenalty = lengthDiff + widthDiff;
  score += Math.max(0, 30 - dimPenalty);
  return score;
}

type GenerationMatchDuration = {
  generationLabel: string;
  matchDurationMinutes: number;
};

function resolveGenerationMatchDuration(
  generationMatchDurations: unknown,
  generationYear: number | null | undefined,
  fallback: number
) {
  if (!generationYear || !Array.isArray(generationMatchDurations)) return fallback;
  const generationLabel = `Generacija ${generationYear}`;
  const entry = (generationMatchDurations as GenerationMatchDuration[]).find(
    (item) =>
      item &&
      typeof item.generationLabel === "string" &&
      item.generationLabel.trim() === generationLabel &&
      typeof item.matchDurationMinutes === "number" &&
      Number.isFinite(item.matchDurationMinutes)
  );
  if (!entry) return fallback;
  return Math.max(1, Math.min(240, Math.round(entry.matchDurationMinutes)));
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function groupName(index: number) {
  return String.fromCharCode(65 + index);
}

function distributeParticipants(teams: Participant[], groupsCount: number) {
  const shuffled = shuffle(teams);
  const groups: Array<{ name: string; teams: Participant[] }> = [];
  const baseSize = Math.floor(shuffled.length / groupsCount);
  const remainder = shuffled.length % groupsCount;

  let offset = 0;
  for (let index = 0; index < groupsCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    groups.push({
      name: groupName(index),
      teams: shuffled.slice(offset, offset + size),
    });
    offset += size;
  }

  return groups;
}

function isResolvedGroupMatch(match: { homeScore: number | null; awayScore: number | null }) {
  return match.homeScore !== null && match.awayScore !== null;
}

function resolveGroupSourceKey(sourceValue: string) {
  const match = sourceValue.trim().match(/^([A-Z]+)\s*[12]$/i);
  return match ? match[1].toUpperCase() : sourceValue.trim().toUpperCase();
}

function computeGroupStandings(input: {
  teams: Array<{
    id: string;
    name: string;
    profileImageUrl: string | null;
    position: number | null;
  }>;
  matches: Array<{
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
}) {
  const table = new Map(
    input.teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        teamName: team.name,
        profileImageUrl: team.profileImageUrl,
        seedPosition: team.position,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        wins: 0,
      },
    ])
  );

  for (const match of input.matches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away) continue;

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.points += 3;
      home.wins += 1;
    } else if (match.homeScore < match.awayScore) {
      away.points += 3;
      away.wins += 1;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const goalDiffA = a.goalsFor - a.goalsAgainst;
    const goalDiffB = b.goalsFor - b.goalsAgainst;
    if (goalDiffB !== goalDiffA) return goalDiffB - goalDiffA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const seedA = a.seedPosition ?? Number.MAX_SAFE_INTEGER;
    const seedB = b.seedPosition ?? Number.MAX_SAFE_INTEGER;
    if (seedA !== seedB) return seedA - seedB;
    return a.teamName.localeCompare(b.teamName);
  });
}

function createGroupFixtures(groupId: string, groupName: string, teamIds: string[], groupOrder: number) {
  const fixtures: GroupFixtureSeed[] = [];
  let seedOrder = 0;
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      fixtures.push({
        drawGroupId: groupId,
        groupName,
        homeTeamId: teamIds[i],
        awayTeamId: teamIds[j],
        groupOrder,
        seedOrder: seedOrder + 1,
      });
      seedOrder += 1;
    }
  }
  return fixtures;
}

function createLeagueFixtures(teams: Participant[]) {
  const shuffled = shuffle(teams);
  const participants = shuffled.length % 2 === 0 ? shuffled : [...shuffled, null];
  const roundsCount = Math.max(0, participants.length - 1);
  const half = participants.length / 2;
  const rotation = [...participants];
  const fixtures: GroupFixtureSeed[] = [];

  for (let roundIndex = 0; roundIndex < roundsCount; roundIndex += 1) {
    const roundLabel = `Kolo ${roundIndex + 1}`;
    for (let pairIndex = 0; pairIndex < half; pairIndex += 1) {
      const first = rotation[pairIndex];
      const second = rotation[rotation.length - 1 - pairIndex];
      if (!first || !second) continue;
      const shouldFlip = (roundIndex + pairIndex) % 2 === 1;
      const home = shouldFlip ? second : first;
      const away = shouldFlip ? first : second;
      fixtures.push({
        drawGroupId: `league-round-${roundIndex + 1}`,
        groupName: roundLabel,
        homeTeamId: home.id,
        awayTeamId: away.id,
        groupOrder: roundIndex + 1,
        seedOrder: pairIndex + 1,
        roundLabel,
      });
    }

    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rotation.splice(0, rotation.length, fixed, rest[rest.length - 1], ...rest.slice(0, -1));
  }

  return fixtures;
}

function interleaveGroupFixtures(fixtures: GroupFixtureSeed[]) {
  const byGroup = new Map<string, GroupFixtureSeed[]>();
  for (const fixture of fixtures) {
    const key = fixture.drawGroupId;
    const list = byGroup.get(key) ?? [];
    list.push(fixture);
    byGroup.set(key, list);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => a.seedOrder - b.seedOrder);
  }

  const groupIds = Array.from(byGroup.keys()).sort((a, b) => {
    const aOrder = byGroup.get(a)?.[0]?.groupOrder ?? 0;
    const bOrder = byGroup.get(b)?.[0]?.groupOrder ?? 0;
    return aOrder - bOrder;
  });
  const result: GroupFixtureSeed[] = [];
  const recentTeams: string[] = [];
  let cursor = 0;

  while (result.length < fixtures.length) {
    let selected: { groupId: string; fixture: GroupFixtureSeed } | null = null;

    for (let scan = 0; scan < groupIds.length; scan += 1) {
      const groupId = groupIds[(cursor + scan) % groupIds.length];
      const queue = byGroup.get(groupId);
      if (!queue?.length) continue;
      const candidate = queue.find(
        (item) =>
          !recentTeams.includes(item.homeTeamId) &&
          !recentTeams.includes(item.awayTeamId)
      );
      if (candidate) {
        selected = { groupId, fixture: candidate };
        cursor = (cursor + scan + 1) % groupIds.length;
        break;
      }
    }

    if (!selected) {
      for (let scan = 0; scan < groupIds.length; scan += 1) {
        const groupId = groupIds[(cursor + scan) % groupIds.length];
        const queue = byGroup.get(groupId);
        if (!queue?.length) continue;
        selected = { groupId, fixture: queue[0] };
        cursor = (cursor + scan + 1) % groupIds.length;
        break;
      }
    }

    if (!selected) break;
    const queue = byGroup.get(selected.groupId)!;
    const index = queue.findIndex(
      (item) =>
        item.drawGroupId === selected?.fixture.drawGroupId &&
        item.homeTeamId === selected?.fixture.homeTeamId &&
        item.awayTeamId === selected?.fixture.awayTeamId &&
        item.seedOrder === selected?.fixture.seedOrder
    );
    queue.splice(index >= 0 ? index : 0, 1);
    result.push(selected.fixture);

    recentTeams.push(selected.fixture.homeTeamId, selected.fixture.awayTeamId);
    while (recentTeams.length > 4) recentTeams.shift();
  }

  return result;
}

function buildScheduledFixtures(
  fixtures: GroupFixtureSeed[],
  pitchNames: string[],
  startAt: Date,
  scheduleDays: ScheduleDayConfig[],
  slotDurationMinutes: number,
  occupiedIntervalsByPitch: Map<string, ScheduleInterval[]> = new Map(),
  options?: { tournamentEndDate?: Date | null; packEarlierDays?: boolean; blockedIntervals?: ScheduleInterval[] }
) {
  const ordered = interleaveGroupFixtures(fixtures);
  const slotMs = slotDurationMinutes * 60 * 1000;
  const normalizedPitches = pitchNames.length ? pitchNames : ["Teren 1"];
  const effectiveDays = scheduleDays.length > 0 ? [...scheduleDays] : [{ dayLabel: "Dan 1", startTime: "09:00", endTime: "19:00" }];
  const addedDays: ScheduleDayConfig[] = [];
  const fallbackWindow = {
    startTime: effectiveDays[effectiveDays.length - 1]?.startTime ?? "09:00",
    endTime: effectiveDays[effectiveDays.length - 1]?.endTime ?? "19:00",
  };
  const templateDate = effectiveDays
    .map((item) => item.dayDate)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))
    .at(-1) ?? new Date(startAt).toISOString().slice(0, 10);
  const tournamentEndDayTs =
    options?.tournamentEndDate != null
      ? new Date(
          options.tournamentEndDate.getFullYear(),
          options.tournamentEndDate.getMonth(),
          options.tournamentEndDate.getDate(),
          23,
          59,
          59,
          999
        ).getTime()
      : null;

  const dayStarts = effectiveDays.map((day, index) => {
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    const base =
      day.dayDate && /^\d{4}-\d{2}-\d{2}$/.test(day.dayDate)
        ? new Date(`${day.dayDate}T00:00:00.000Z`)
        : (() => {
            const fallback = new Date(startAt);
            fallback.setHours(0, 0, 0, 0);
            fallback.setDate(fallback.getDate() + index);
            return fallback;
          })();
    const startTs = new Date(base);
    startTs.setHours(sh, sm, 0, 0);
    const endTs = new Date(base);
    endTs.setHours(eh, em, 0, 0);
    return { startTs: startTs.getTime(), endTs: endTs.getTime(), pitchName: day.pitchName ?? null };
  });
  const dayCapacities = dayStarts.map((day) => {
    const duration = day.endTs - day.startTs;
    if (duration <= 0) return 0;
    return Math.max(0, Math.floor(duration / slotMs));
  });

  const pitchState = dayStarts.flatMap((day, dayIndex) => {
    const scopedPitches =
      day.pitchName && day.pitchName.trim().length > 0
        ? [day.pitchName.trim()]
        : pitchNames;
    return scopedPitches.map((pitchName) => ({
      pitchName,
      dayIndex,
      nextStartAt: day.startTs,
    }));
  });
  const lastPlayedAt = new Map<string, number>();
  const dayMatchCounts = dayStarts.map(() => 0);
  const scheduled: Array<{ fixture: GroupFixtureSeed; pitchName: string; scheduledAt: Date }> = [];
  const pending = [...ordered];
  if (!pitchState.length) {
    throw new Error("Za odabranu generaciju nisu definisani tereni u Dani i satnica.");
  }

  const findOverlap = (pitchName: string, startAt: number, endAt: number) => {
    const intervals = occupiedIntervalsByPitch.get(pitchName) ?? [];
    return intervals.find((interval) => startAt < interval.endAt && endAt > interval.startAt) ?? null;
  };
  const findBlockedOverlap = (startAt: number, endAt: number) =>
    options?.blockedIntervals?.find((interval) => startAt < interval.endAt && endAt > interval.startAt) ?? null;

  const advancePitch = (state: { pitchName: string; dayIndex: number; nextStartAt: number }) => {
    if (state.dayIndex >= dayStarts.length) return;
    const day = dayStarts[state.dayIndex];
    while (state.nextStartAt + slotMs <= day.endTs) {
      const slotStartAt = state.nextStartAt;
      const slotEndAt = state.nextStartAt + slotMs;
      const overlap = findOverlap(state.pitchName, slotStartAt, slotEndAt);
      const blockedOverlap = findBlockedOverlap(slotStartAt, slotEndAt);
      if (!overlap && !blockedOverlap) return;
      state.nextStartAt = Math.max(overlap?.endAt ?? slotStartAt, blockedOverlap?.endAt ?? slotStartAt);
    }
    state.dayIndex = dayStarts.length;
  };

  const pushDay = (day: ScheduleDayConfig) => {
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    const base =
      day.dayDate && /^\d{4}-\d{2}-\d{2}$/.test(day.dayDate)
        ? new Date(`${day.dayDate}T00:00:00.000Z`)
        : new Date(`${templateDate}T00:00:00.000Z`);
    const startTs = new Date(base);
    startTs.setHours(sh, sm, 0, 0);
    const endTs = new Date(base);
    endTs.setHours(eh, em, 0, 0);
    const nextIndex = dayStarts.length;
    dayStarts.push({ startTs: startTs.getTime(), endTs: endTs.getTime(), pitchName: day.pitchName ?? null });
    const duration = endTs.getTime() - startTs.getTime();
    dayCapacities.push(duration > 0 ? Math.max(0, Math.floor(duration / slotMs)) : 0);
    dayMatchCounts.push(0);
    const scopedPitches =
      day.pitchName && day.pitchName.trim().length > 0
        ? [day.pitchName.trim()]
        : pitchNames;
    pitchState.push(
      ...scopedPitches
        .filter((pitchName) => pitchNames.includes(pitchName))
        .map((pitchName) => ({
        pitchName,
        dayIndex: nextIndex,
        nextStartAt: startTs.getTime(),
      }))
    );
  };

  const addAutoDays = () => {
    const datedTemplates = effectiveDays.filter((item) => item.dayDate);
    const baseTemplates = datedTemplates.length ? datedTemplates : effectiveDays;
    const latestDate = baseTemplates
      .map((item) => item.dayDate ?? templateDate)
      .sort((a, b) => a.localeCompare(b))
      .at(-1) ?? templateDate;
    const nextDateObj = new Date(`${latestDate}T00:00:00.000Z`);
    nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);
    const nextDate = nextDateObj.toISOString().slice(0, 10);
    if (tournamentEndDayTs != null) {
      const nextDateTs = new Date(`${nextDate}T23:59:59.999Z`).getTime();
      if (nextDateTs > tournamentEndDayTs) {
        throw new Error("Nema dovoljno termina unutar trajanja turnira. Proširi satnicu/terene u postojećim danima turnira.");
      }
    }
    const dayName = `Dan ${effectiveDays.length + 1}`;
    const seenPitch = new Set<string>();
    const newRows: ScheduleDayConfig[] = [];
    for (const template of baseTemplates) {
      const pitchName = template.pitchName?.trim();
      if (!pitchName || seenPitch.has(pitchName)) continue;
      seenPitch.add(pitchName);
      newRows.push({
        ...template,
        dayLabel: dayName,
        dayDate: nextDate,
      });
    }
    if (!newRows.length) {
      for (const pitchName of normalizedPitches) {
        newRows.push({
          dayLabel: dayName,
          dayDate: nextDate,
          startTime: fallbackWindow.startTime,
          endTime: fallbackWindow.endTime,
          pitchName,
        });
      }
    }
    for (const row of newRows) {
      effectiveDays.push(row);
      addedDays.push(row);
      pushDay(row);
    }
  };

  while (pending.length) {
    for (const state of pitchState) advancePitch(state);
    const available = pitchState.filter((state) => state.dayIndex < dayStarts.length);
    if (!available.length) {
      addAutoDays();
      continue;
    }
    const dayIndexes = Array.from(new Set(available.map((state) => state.dayIndex)));
    const selectedDay = options?.packEarlierDays
      ? dayIndexes.sort((a, b) => a - b)[0]
      : dayIndexes.sort((a, b) => {
          const aCapacity = dayCapacities[a] ?? 0;
          const bCapacity = dayCapacities[b] ?? 0;
          const aCount = dayMatchCounts[a] ?? 0;
          const bCount = dayMatchCounts[b] ?? 0;
          const aUsage = aCapacity > 0 ? aCount / aCapacity : Number.POSITIVE_INFINITY;
          const bUsage = bCapacity > 0 ? bCount / bCapacity : Number.POSITIVE_INFINITY;
          if (aUsage !== bUsage) return aUsage - bUsage;
          if (aCount !== bCount) return aCount - bCount;
          return a - b;
        })[0];
    const dayPitches = available
      .filter((state) => state.dayIndex === selectedDay)
      .sort((a, b) => a.nextStartAt - b.nextStartAt || a.pitchName.localeCompare(b.pitchName));
    const pitch = dayPitches[0] ?? available[0];
    const slotTime = pitch.nextStartAt;

    const candidates = pending
      .map((fixture, index) => ({ fixture, index }))
      .filter(({ fixture }) => {
        const homeLast = lastPlayedAt.get(fixture.homeTeamId);
        const awayLast = lastPlayedAt.get(fixture.awayTeamId);
        const noOverlapHome = homeLast === undefined || slotTime - homeLast >= slotMs;
        const noOverlapAway = awayLast === undefined || slotTime - awayLast >= slotMs;
        return noOverlapHome && noOverlapAway;
      });

    const pool = candidates.length ? candidates : pending.map((fixture, index) => ({ fixture, index }));
    pool.sort((a, b) => {
      const aHomeLast = lastPlayedAt.get(a.fixture.homeTeamId) ?? -Infinity;
      const aAwayLast = lastPlayedAt.get(a.fixture.awayTeamId) ?? -Infinity;
      const bHomeLast = lastPlayedAt.get(b.fixture.homeTeamId) ?? -Infinity;
      const bAwayLast = lastPlayedAt.get(b.fixture.awayTeamId) ?? -Infinity;
      const aRest = Math.min(slotTime - aHomeLast, slotTime - aAwayLast);
      const bRest = Math.min(slotTime - bHomeLast, slotTime - bAwayLast);
      if (bRest !== aRest) return bRest - aRest;
      if (a.fixture.groupOrder !== b.fixture.groupOrder) return a.fixture.groupOrder - b.fixture.groupOrder;
      return a.fixture.seedOrder - b.fixture.seedOrder;
    });

    const chosen = pool[0];
    scheduled.push({
      fixture: chosen.fixture,
      pitchName: pitch.pitchName,
      scheduledAt: new Date(slotTime),
    });
    pending.splice(chosen.index, 1);
    lastPlayedAt.set(chosen.fixture.homeTeamId, slotTime);
    lastPlayedAt.set(chosen.fixture.awayTeamId, slotTime);
    dayMatchCounts[pitch.dayIndex] = (dayMatchCounts[pitch.dayIndex] ?? 0) + 1;
    const intervals = occupiedIntervalsByPitch.get(pitch.pitchName) ?? [];
    intervals.push({ startAt: slotTime, endAt: slotTime + slotMs });
    occupiedIntervalsByPitch.set(pitch.pitchName, intervals);
    pitch.nextStartAt = slotTime + slotMs;
  }

  return { scheduled, addedDays };
}

function buildKnockoutScheduleSlotPicker(
  pitchNames: string[],
  scheduleDays: ScheduleDayConfig[],
  startAt: Date,
  slotDurationMinutes: number,
  occupiedIntervalsByPitch: Map<string, ScheduleInterval[]>,
  options?: { tournamentEndDate?: Date | null; minStartAt?: Date | null; blockedIntervals?: ScheduleInterval[] }
) {
  const slotMs = slotDurationMinutes * 60 * 1000;
  const knockoutFloorTs = options?.minStartAt ? options.minStartAt.getTime() : null;
  const effectiveDays = [...scheduleDays];
  const addedDays: ScheduleDayConfig[] = [];
  const fallbackWindow = {
    startTime: effectiveDays[effectiveDays.length - 1]?.startTime ?? "09:00",
    endTime: effectiveDays[effectiveDays.length - 1]?.endTime ?? "19:00",
  };
  const templateDate =
    effectiveDays
      .map((item) => item.dayDate)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b))
      .at(-1) ?? new Date(startAt).toISOString().slice(0, 10);
  const tournamentEndDayTs =
    options?.tournamentEndDate != null
      ? new Date(
          options.tournamentEndDate.getFullYear(),
          options.tournamentEndDate.getMonth(),
          options.tournamentEndDate.getDate(),
          23,
          59,
          59,
          999
        ).getTime()
      : null;

  const dayStarts = effectiveDays.map((day, index) => {
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    const base =
      day.dayDate && /^\d{4}-\d{2}-\d{2}$/.test(day.dayDate)
        ? new Date(`${day.dayDate}T00:00:00.000Z`)
        : (() => {
            const fallback = new Date(startAt);
            fallback.setHours(0, 0, 0, 0);
            fallback.setDate(fallback.getDate() + index);
            return fallback;
          })();
    const startTs = new Date(base);
    startTs.setHours(sh, sm, 0, 0);
    const endTs = new Date(base);
    endTs.setHours(eh, em, 0, 0);
    return { startTs: startTs.getTime(), endTs: endTs.getTime(), pitchName: day.pitchName ?? null };
  });

  const dayCapacities = dayStarts.map((day) => {
    const duration = day.endTs - day.startTs;
    if (duration <= 0) return 0;
    return Math.max(0, Math.floor(duration / slotMs));
  });
  const dayMatchCounts = dayStarts.map(() => 0);

  const pitchState = dayStarts.flatMap((day, dayIndex) => {
    const scopedPitches =
      day.pitchName && day.pitchName.trim().length > 0
        ? [day.pitchName.trim()]
        : pitchNames;
    return scopedPitches
      .filter((pitchName) => pitchNames.includes(pitchName))
      .map((pitchName) => ({
        pitchName,
        dayIndex,
        nextStartAt: knockoutFloorTs != null ? Math.max(day.startTs, knockoutFloorTs) : day.startTs,
      }));
  });

  const findOverlap = (pitchName: string, startAtValue: number, endAtValue: number) => {
    const intervals = occupiedIntervalsByPitch.get(pitchName) ?? [];
    return intervals.find((interval) => startAtValue < interval.endAt && endAtValue > interval.startAt) ?? null;
  };
  const findBlockedOverlap = (startAtValue: number, endAtValue: number) =>
    options?.blockedIntervals?.find((interval) => startAtValue < interval.endAt && endAtValue > interval.startAt) ?? null;

  const advancePitch = (state: { pitchName: string; dayIndex: number; nextStartAt: number }) => {
    if (state.dayIndex >= dayStarts.length) return;
    const day = dayStarts[state.dayIndex];
    while (state.nextStartAt + slotMs <= day.endTs) {
      const slotStartAt = state.nextStartAt;
      const slotEndAt = state.nextStartAt + slotMs;
      const overlap = findOverlap(state.pitchName, slotStartAt, slotEndAt);
      const blockedOverlap = findBlockedOverlap(slotStartAt, slotEndAt);
      if (!overlap && !blockedOverlap) return;
      state.nextStartAt = Math.max(overlap?.endAt ?? slotStartAt, blockedOverlap?.endAt ?? slotStartAt);
    }
    state.dayIndex = dayStarts.length;
  };

  const pushDay = (day: ScheduleDayConfig) => {
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    const base =
      day.dayDate && /^\d{4}-\d{2}-\d{2}$/.test(day.dayDate)
        ? new Date(`${day.dayDate}T00:00:00.000Z`)
        : new Date(`${templateDate}T00:00:00.000Z`);
    const startTs = new Date(base);
    startTs.setHours(sh, sm, 0, 0);
    const endTs = new Date(base);
    endTs.setHours(eh, em, 0, 0);
    const nextIndex = dayStarts.length;
    dayStarts.push({ startTs: startTs.getTime(), endTs: endTs.getTime(), pitchName: day.pitchName ?? null });
    const duration = endTs.getTime() - startTs.getTime();
    dayCapacities.push(duration > 0 ? Math.max(0, Math.floor(duration / slotMs)) : 0);
    dayMatchCounts.push(0);
    const scopedPitches =
      day.pitchName && day.pitchName.trim().length > 0
        ? [day.pitchName.trim()]
        : pitchNames;
    pitchState.push(
      ...scopedPitches
        .filter((pitchName) => pitchNames.includes(pitchName))
        .map((pitchName) => ({
          pitchName,
          dayIndex: nextIndex,
          nextStartAt:
            knockoutFloorTs != null ? Math.max(startTs.getTime(), knockoutFloorTs) : startTs.getTime(),
        }))
    );
  };

  const addAutoDays = () => {
    const datedTemplates = effectiveDays.filter((item) => item.dayDate);
    const baseTemplates = datedTemplates.length ? datedTemplates : effectiveDays;
    const latestDate = baseTemplates
      .map((item) => item.dayDate ?? templateDate)
      .sort((a, b) => a.localeCompare(b))
      .at(-1) ?? templateDate;
    const nextDateObj = new Date(`${latestDate}T00:00:00.000Z`);
    nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);
    const nextDate = nextDateObj.toISOString().slice(0, 10);
    if (tournamentEndDayTs != null) {
      const nextDateTs = new Date(`${nextDate}T23:59:59.999Z`).getTime();
      if (nextDateTs > tournamentEndDayTs) {
        throw new Error("Nema dovoljno termina unutar trajanja turnira. Proširi satnicu/terene u postojećim danima turnira.");
      }
    }
    const dayName = `Dan ${effectiveDays.length + 1}`;
    const seenPitch = new Set<string>();
    const newRows: ScheduleDayConfig[] = [];
    for (const template of baseTemplates) {
      const pitchName = template.pitchName?.trim();
      if (!pitchName || seenPitch.has(pitchName)) continue;
      seenPitch.add(pitchName);
      newRows.push({
        ...template,
        dayLabel: dayName,
        dayDate: nextDate,
      });
    }
    if (!newRows.length) {
      for (const pitchName of pitchNames) {
        newRows.push({
          dayLabel: dayName,
          dayDate: nextDate,
          startTime: fallbackWindow.startTime,
          endTime: fallbackWindow.endTime,
          pitchName,
        });
      }
    }
    for (const row of newRows) {
      effectiveDays.push(row);
      addedDays.push(row);
      pushDay(row);
    }
  };

  return () => {
    for (const state of pitchState) advancePitch(state);
    const available = pitchState.filter((state) => state.dayIndex < dayStarts.length);
    if (!available.length) {
      addAutoDays();
      for (const state of pitchState) advancePitch(state);
    }
    const refreshed = pitchState.filter((state) => state.dayIndex < dayStarts.length);
    if (!refreshed.length) {
      throw new Error("Nema dovoljno satnice za knockout utakmice.");
    }
    const dayIndexes = Array.from(new Set(refreshed.map((state) => state.dayIndex)));
    const selectedDay = dayIndexes.sort((a, b) => {
      const aCapacity = dayCapacities[a] ?? 0;
      const bCapacity = dayCapacities[b] ?? 0;
      const aCount = dayMatchCounts[a] ?? 0;
      const bCount = dayMatchCounts[b] ?? 0;
      const aUsage = aCapacity > 0 ? aCount / aCapacity : Number.POSITIVE_INFINITY;
      const bUsage = bCapacity > 0 ? bCount / bCapacity : Number.POSITIVE_INFINITY;
      if (aUsage !== bUsage) return aUsage - bUsage;
      if (aCount !== bCount) return aCount - bCount;
      return a - b;
    })[0];
    const dayPitches = refreshed
      .filter((state) => state.dayIndex === selectedDay)
      .sort((a, b) => a.nextStartAt - b.nextStartAt || a.pitchName.localeCompare(b.pitchName));
    const pitch = dayPitches[0] ?? refreshed[0];
    const slotTime = pitch.nextStartAt;
    dayMatchCounts[pitch.dayIndex] = (dayMatchCounts[pitch.dayIndex] ?? 0) + 1;
    const intervals = occupiedIntervalsByPitch.get(pitch.pitchName) ?? [];
    intervals.push({ startAt: slotTime, endAt: slotTime + slotMs });
    occupiedIntervalsByPitch.set(pitch.pitchName, intervals);
    pitch.nextStartAt = slotTime + slotMs;
    return { scheduledAt: new Date(slotTime), pitchName: pitch.pitchName, addedDays };
  };
}

function createRoundPairs(
  winners: Array<{ sourceType: DrawSourceType; sourceValue: string }>,
  runners: Array<{ sourceType: DrawSourceType; sourceValue: string }>,
  matchCount: number
) {
  const pairs: Array<{
    homeSourceType: DrawSourceType;
    homeSourceValue: string;
    awaySourceType: DrawSourceType;
    awaySourceValue: string;
  }> = [];

  let index = 0;
  while (pairs.length < matchCount && winners.length > index + 1 && runners.length > index + 1) {
    pairs.push({
      homeSourceType: winners[index].sourceType,
      homeSourceValue: `${winners[index].sourceValue}1`,
      awaySourceType: runners[index + 1].sourceType,
      awaySourceValue: `${runners[index + 1].sourceValue}2`,
    });

    if (pairs.length < matchCount) {
      pairs.push({
        homeSourceType: winners[index + 1].sourceType,
        homeSourceValue: `${winners[index + 1].sourceValue}1`,
        awaySourceType: runners[index].sourceType,
        awaySourceValue: `${runners[index].sourceValue}2`,
      });
    }
    index += 2;
  }

  while (pairs.length < matchCount) {
    pairs.push({
      homeSourceType: DrawSourceType.MATCH_WINNER,
      homeSourceValue: "TBD",
      awaySourceType: DrawSourceType.MATCH_WINNER,
      awaySourceValue: "TBD",
    });
  }

  return pairs.slice(0, matchCount);
}

function createDirectPairs(teams: Participant[], matchCount: number) {
  const shuffled = shuffle(teams);
  const pairs: Array<{
    homeSourceType: DrawSourceType;
    homeSourceValue: string;
    awaySourceType: DrawSourceType;
    awaySourceValue: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
  }> = [];

  for (let i = 0; i < matchCount; i += 1) {
    const home = shuffled[i * 2] ?? null;
    const away = shuffled[i * 2 + 1] ?? null;
    pairs.push({
      homeSourceType: DrawSourceType.DIRECT_TEAM,
      homeSourceValue: home?.name ?? "TBD",
      awaySourceType: DrawSourceType.DIRECT_TEAM,
      awaySourceValue: away?.name ?? "TBD",
      homeTeamId: home?.id ?? null,
      awayTeamId: away?.id ?? null,
    });
  }

  return pairs;
}

async function filterEligibleTeamGenerations(
  competitionId: string,
  teamGenerations: Array<{
    teamId: string;
    generationYear: number;
    team: { id: string; name: string; profileImageUrl: string | null };
  }>
) {
  if (!teamGenerations.length) return teamGenerations;
  const teamIds = Array.from(new Set(teamGenerations.map((item) => item.teamId)));
  const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const teamNameById = new Map(teamGenerations.map((item) => [item.teamId, normalized(item.team.name)]));

  const applications = await prisma.teamApplication.findMany({
    where: {
      competitionId,
    },
    include: {
      generations: true,
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });

  const latestByTeamId = new Map<string, (typeof applications)[number]>();
  const latestByTeamName = new Map<string, (typeof applications)[number]>();
  for (const application of applications) {
    if (application.teamId && !latestByTeamId.has(application.teamId)) {
      latestByTeamId.set(application.teamId, application);
    }
    const key = normalized(application.teamName);
    if (key && !latestByTeamName.has(key)) {
      latestByTeamName.set(key, application);
    }
  }

  return teamGenerations.filter((entry) => {
    const byId = latestByTeamId.get(entry.teamId);
    const byName = latestByTeamName.get(teamNameById.get(entry.teamId) ?? "");
    const latest = byId ?? byName;
    if (!latest) return true;
    if (latest.status !== "APPROVED") return false;
    return latest.generations.some(
      (generation) => generation.generationYear === entry.generationYear && generation.isApproved === true
    );
  });
}

async function ensureCompetition(organizationId: string, competitionId: string) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, organizationId },
    include: {
      season: { select: { id: true, name: true } },
      teams: {
        include: { team: { select: { id: true, name: true, sport: true, profileImageUrl: true } } },
      },
      teamGenerations: {
        where: { isApproved: true },
        select: {
          teamId: true,
          generationYear: true,
          team: { select: { id: true, name: true, profileImageUrl: true } },
        },
      },
      draws: { select: { id: true } },
    },
  });

  if (!competition) return null;
  return competition;
}

export async function listDrawCompetitions(organizationId: string, seasonYear?: string) {
  const competitions = await prisma.competition.findMany({
    where: {
      organizationId,
      ...(seasonYear
        ? {
            season: {
              OR: [{ name: seasonYear }, { name: { startsWith: `${seasonYear}/` } }],
            },
          }
        : {}),
    },
    include: {
      season: { select: { id: true, name: true } },
      teams: { include: { team: { select: { id: true, name: true } } } },
      teamGenerations: { where: { isApproved: true }, select: { teamId: true, generationYear: true } },
      draws: { select: { id: true, updatedAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return competitions.map((competition) => ({
    id: competition.id,
    createdById: competition.createdById,
    name: competition.name,
    type: competition.type,
    seasonId: competition.seasonId,
    seasonLabel: competition.season?.name ?? null,
    sport: competition.sport,
    status: competition.status,
    participantsCount: competition.teams.length,
    participants: competition.teams.map((entry) => entry.team),
    generationYears: Array.from(new Set(competition.teamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a),
    hasDraw: Boolean(competition.draws[0]),
    drawUpdatedAt: competition.draws[0]?.updatedAt ?? null,
  }));
}

export async function getDrawByCompetition(organizationId: string, competitionId: string, generationYear?: number) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  const scopedTeamGenerations = await filterEligibleTeamGenerations(competition.id, competition.teamGenerations);
  const availableGenerationYears = Array.from(new Set(scopedTeamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a);
  const selectedGenerationYear =
    generationYear && availableGenerationYears.includes(generationYear)
      ? generationYear
      : availableGenerationYears[0] ?? null;

  const draw =
    selectedGenerationYear == null
      ? null
      : await prisma.draw.findUnique({
          where: {
            competitionId_generationYear: {
              competitionId: competition.id,
              generationYear: selectedGenerationYear,
            },
          },
          include: {
            groups: {
              include: {
                teams: { include: { team: { select: { id: true, name: true, profileImageUrl: true } } }, orderBy: { position: "asc" } },
              },
              orderBy: { order: "asc" },
            },
            knockoutRounds: {
              include: {
                matches: {
                  include: {
                    homeTeam: { select: { id: true, name: true, profileImageUrl: true } },
                    awayTeam: { select: { id: true, name: true, profileImageUrl: true } },
                    winnerTeam: { select: { id: true, name: true, profileImageUrl: true } },
                  },
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
            matches: {
              where: { stage: "GROUP_STAGE" },
              include: {
                homeTeam: { select: { id: true, name: true, profileImageUrl: true } },
                awayTeam: { select: { id: true, name: true, profileImageUrl: true } },
              },
              orderBy: { scheduledAt: "asc" },
            },
          },
        });

  const participantsByGeneration = new Map<number, Array<{ id: string; name: string; profileImageUrl: string | null }>>();
  for (const item of scopedTeamGenerations) {
    const list = participantsByGeneration.get(item.generationYear) ?? [];
    if (!list.some((entry) => entry.id === item.team.id)) {
      list.push(item.team);
    }
    participantsByGeneration.set(item.generationYear, list);
  }

  const resolvedDraw =
    draw && draw.groupStageEnabled && draw.groups.length && draw.matches.length
      ? (() => {
          const allGroupMatchesResolved = draw.matches.every((match) => isResolvedGroupMatch(match));
          if (!allGroupMatchesResolved) return draw;

          const groupResolution = new Map<
            string,
            {
              winner: { id: string; name: string; profileImageUrl: string | null } | null;
              runnerUp: { id: string; name: string; profileImageUrl: string | null } | null;
              orderedTeamIds: string[];
            }
          >();

          const resolvedGroups = draw.groups.map((group) => {
            const standings = computeGroupStandings({
              teams: group.teams.map((entry) => ({
                id: entry.team.id,
                name: entry.team.name,
                profileImageUrl: entry.team.profileImageUrl ?? null,
                position: entry.position,
              })),
              matches: draw.matches.filter((match) => match.drawGroupId === group.id),
            });

            groupResolution.set(group.name, {
              winner: standings[0]
                ? {
                    id: standings[0].teamId,
                    name: standings[0].teamName,
                    profileImageUrl: standings[0].profileImageUrl,
                  }
                : null,
              runnerUp: standings[1]
                ? {
                    id: standings[1].teamId,
                    name: standings[1].teamName,
                    profileImageUrl: standings[1].profileImageUrl,
                  }
                : null,
              orderedTeamIds: standings.map((item) => item.teamId),
            });

            return {
              ...group,
              teams: standings
                .map((row, index) => {
                  const source = group.teams.find((entry) => entry.team.id === row.teamId);
                  return source
                    ? {
                        ...source,
                        position: index + 1,
                      }
                    : null;
                })
                .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
            };
          });

          return {
            ...draw,
            groups: resolvedGroups,
            knockoutRounds: draw.knockoutRounds.map((round) => ({
              ...round,
              matches: round.matches.map((match) => {
                const resolvedHomeTeam =
                  match.homeTeam ??
                  (match.homeSourceType === DrawSourceType.GROUP_WINNER
                    ? (groupResolution.get(resolveGroupSourceKey(match.homeSourceValue))?.winner ?? null)
                    : match.homeSourceType === DrawSourceType.GROUP_RUNNER_UP
                      ? (groupResolution.get(resolveGroupSourceKey(match.homeSourceValue))?.runnerUp ?? null)
                      : null);
                const resolvedAwayTeam =
                  match.awayTeam ??
                  (match.awaySourceType === DrawSourceType.GROUP_WINNER
                    ? (groupResolution.get(resolveGroupSourceKey(match.awaySourceValue))?.winner ?? null)
                    : match.awaySourceType === DrawSourceType.GROUP_RUNNER_UP
                      ? (groupResolution.get(resolveGroupSourceKey(match.awaySourceValue))?.runnerUp ?? null)
                      : null);

                return {
                  ...match,
                  homeTeam: resolvedHomeTeam,
                  awayTeam: resolvedAwayTeam,
                };
              }),
            })),
          };
        })()
      : draw;

  return {
    competition: {
      id: competition.id,
      createdById: competition.createdById,
      name: competition.name,
      type: competition.type,
      sport: competition.sport,
      seasonId: competition.seasonId,
      seasonLabel: competition.season?.name ?? null,
      matchDurationMinutes: competition.matchDurationMinutes,
      participants:
        selectedGenerationYear == null
          ? []
          : (participantsByGeneration.get(selectedGenerationYear) ?? []),
      availableGenerationYears,
      selectedGenerationYear,
    },
    draw: resolvedDraw
      ? {
          ...resolvedDraw,
          groupMatches: resolvedDraw.matches,
        }
      : null,
  };
}

export async function resetDraw(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  generationYear?: number,
  resetScheduleDays = false
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");

  if (competition.type === CompetitionType.LEAGUE) {
    await prisma.match.deleteMany({
      where: {
        competitionId,
        stage: "LEAGUE",
        ...(generationYear == null ? {} : { generationYear }),
      },
    });
    if (resetScheduleDays) {
      const defaultDayDate = (competition.startDate ?? new Date()).toISOString().slice(0, 10);
      await prisma.competition.update({
        where: { id: competitionId },
        data: {
          scheduleDays: [
            {
              dayLabel: "Dan 1",
              dayDate: defaultDayDate,
              generationLabel: ALL_GENERATIONS_LABEL,
              stageScope: "ALL",
              pitchId: null,
              startTime: "09:00",
              endTime: "19:00",
            },
          ] as Prisma.InputJsonValue,
        },
      });
    }
    return { ok: true };
  }

  if (competition.type !== CompetitionType.TOURNAMENT) {
    return { ok: true };
  }

  const drawIds =
    generationYear == null
      ? (
          await prisma.draw.findMany({
            where: { competitionId },
            select: { id: true },
          })
        ).map((item) => item.id)
      : (
          await prisma.draw.findMany({
            where: { competitionId, generationYear },
            select: { id: true },
          })
        ).map((item) => item.id);

  if (drawIds.length) {
    await prisma.match.deleteMany({
      where: {
        competitionId,
        drawId: { in: drawIds },
      },
    });
  }
  await prisma.draw.deleteMany({ where: { competitionId, ...(generationYear == null ? {} : { generationYear }) } });
  if (resetScheduleDays) {
    const defaultDayDate = (competition.startDate ?? new Date()).toISOString().slice(0, 10);
    await prisma.competition.update({
      where: { id: competitionId },
      data: {
        scheduleDays: [
          {
            dayLabel: "Dan 1",
            dayDate: defaultDayDate,
            generationLabel: ALL_GENERATIONS_LABEL,
            stageScope: "ALL",
            pitchId: null,
            startTime: "09:00",
            endTime: "19:00",
          },
        ] as Prisma.InputJsonValue,
      },
    });
  }
  return { ok: true };
}

async function generateLeagueSchedule(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  config: DrawConfigInput
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (competition.type !== CompetitionType.LEAGUE) {
    throw new Error("League schedule generation is available only for league competitions.");
  }

  const scopedTeamGenerations = await filterEligibleTeamGenerations(competition.id, competition.teamGenerations);
  const availableGenerationYears = Array.from(new Set(scopedTeamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a);
  const generationYear = config.generationYear ?? availableGenerationYears[0] ?? null;
  const participants = generationYear
    ? scopedTeamGenerations
        .filter((item) => item.generationYear === generationYear)
        .map((item) => ({ id: item.team.id, name: item.team.name }))
        .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
    : competition.teams
        .map((entry) => ({ id: entry.team.id, name: entry.team.name }))
        .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index);

  if (participants.length < 2) {
    throw new Error("Za kreiranje ligaškog rasporeda potrebne su najmanje dvije ekipe.");
  }

  const existingMatches = await prisma.match.count({
    where: {
      competitionId,
      stage: "LEAGUE",
      ...(generationYear ? { generationYear } : { generationYear: null }),
    },
  });
  if (existingMatches > 0) {
    throw new Error("Ligaški raspored već postoji za ovu generaciju/sezonu. Obriši postojeće utakmice prije ponovnog generisanja.");
  }

  return prisma.$transaction(async (tx) => {
    const generationLabel = generationYear ? `Generacija ${generationYear}` : ALL_GENERATIONS_LABEL;
    const placeholderBaseDate = competition.startDate ?? new Date();
    const rawScheduleDays =
      (competition.scheduleDays as unknown as Array<{ dayLabel: string; dayDate?: string; generationLabel?: string; pitchId?: string | null; startTime: string; endTime: string; stageScope?: ScheduleStageScope }> | null) ?? [];
    const scheduleDays = (
      rawScheduleDays.length
        ? rawScheduleDays
        : [
            {
              dayLabel: "Dan 1",
              dayDate: (competition.startDate ?? new Date()).toISOString().slice(0, 10),
              pitchId: null,
              startTime: "09:00",
              endTime: "19:00",
            },
          ]
    ).filter((day) => day.dayLabel && day.startTime && day.endTime);
    const leagueScheduleDays = scheduleDays.filter(
      (day) => !generationYear || day.generationLabel === generationLabel || day.generationLabel === ALL_GENERATIONS_LABEL || !day.generationLabel
    );
    if (!leagueScheduleDays.length) {
      throw new Error(`Nema definisanih termina za ${generationLabel}.`);
    }

    const slotDurationMinutes = competition.matchDurationMinutes;
    const activePitchLabels = await tx.pitch.findMany({
      where: { organizationId, isActive: true },
      include: { venue: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const fallbackPitchNames = competition.pitchNames?.length
      ? competition.pitchNames
      : activePitchLabels.length
        ? activePitchLabels.map((pitch) => (pitch.venue?.name ? `${pitch.venue.name} - ${pitch.name}` : pitch.name))
        : ["Teren 1"];
    const adjacentYears = adjacentGenerationYears(generationYear);
    const adjacentMatches = adjacentYears.length
      ? await tx.match.findMany({
          where: {
            competitionId,
            generationYear: { in: adjacentYears },
            status: { not: "CANCELED" },
          },
          select: {
            scheduledAt: true,
            regularTimeMinutes: true,
          },
        })
      : [];
    const blockedIntervals = scheduledMatchIntervals(adjacentMatches, competition.matchDurationMinutes);
    const fixtures = createLeagueFixtures(participants);
    const scheduledFixtures: Array<{ fixture: GroupFixtureSeed; pitchName: string; scheduledAt: Date }> = [];
    const occupiedIntervalsByPitch = new Map<string, ScheduleInterval[]>();
    const fixturesByRound = new Map<number, GroupFixtureSeed[]>();
    for (const fixture of fixtures) {
      const roundFixtures = fixturesByRound.get(fixture.groupOrder) ?? [];
      roundFixtures.push(fixture);
      fixturesByRound.set(fixture.groupOrder, roundFixtures);
    }
    const sortedRounds = Array.from(fixturesByRound.entries()).sort(([a], [b]) => a - b);
    for (const [roundOrder, roundFixtures] of sortedRounds) {
      const roundScheduleDays = buildLeagueRoundScheduleDays({
        baseDate: placeholderBaseDate,
        roundIndex: roundOrder - 1,
        templates: leagueScheduleDays.map((day) => ({ ...day, stageScope: "ALL" as const })),
        includeWeekdays: Boolean(config.includeWeekdays),
      });
      const roundEndDate = config.includeWeekdays
        ? null
        : new Date(`${roundScheduleDays[roundScheduleDays.length - 1]?.dayDate ?? toDateKey(placeholderBaseDate)}T23:59:59.999Z`);
      const roundResult = buildScheduledFixtures(
        roundFixtures,
        fallbackPitchNames,
        placeholderBaseDate,
        roundScheduleDays,
        slotDurationMinutes,
        occupiedIntervalsByPitch,
        { tournamentEndDate: roundEndDate, packEarlierDays: true, blockedIntervals }
      );
      scheduledFixtures.push(...roundResult.scheduled);
    }

    const teams = await tx.team.findMany({
      where: { id: { in: participants.map((team) => team.id) }, organizationId },
      include: { homeVenue: { include: { pitches: { where: { isActive: true }, orderBy: { createdAt: "asc" } } } } },
    });
    const teamById = new Map(teams.map((team) => [team.id, team]));

    for (const scheduledFixture of scheduledFixtures) {
      const fixture = scheduledFixture.fixture;
      const homeTeam = teamById.get(fixture.homeTeamId);
      const homeVenue = homeTeam?.homeVenue ?? null;
      const scheduledPitch = scheduledFixture.pitchName ?? fallbackPitchNames[0] ?? homeVenue?.pitches[0]?.name ?? "Teren 1";
      const venueLabel = scheduledPitch.includes(" - ")
        ? scheduledPitch
        : homeVenue?.name
          ? `${homeVenue.name} - ${scheduledPitch}`
          : (competition.location ?? scheduledPitch);

      await tx.match.create({
        data: {
          competitionId: competition.id,
          seasonId: competition.seasonId ?? null,
          stage: "LEAGUE",
          round: fixture.roundLabel ?? `Kolo ${fixture.groupOrder}`,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          venueId: homeVenue?.id ?? competition.venueId ?? null,
          venueLabel,
          pitchName: scheduledPitch,
          status: "SCHEDULED",
          scheduledAt: scheduledFixture.scheduledAt,
          regularTimeMinutes: competition.matchDurationMinutes,
          createdById: actor.id,
          generationYear,
        },
      });
    }

    return {
      competitionId: competition.id,
      generationYear,
      matchesCreated: scheduledFixtures.length,
      roundsCreated: Array.from(new Set(fixtures.map((fixture) => fixture.groupOrder))).length,
    };
  });
}

export async function generateDraw(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  config: DrawConfigInput
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (competition.type === CompetitionType.LEAGUE) {
    return generateLeagueSchedule(organizationId, actor, competitionId, config);
  }
  if (competition.type !== CompetitionType.TOURNAMENT) {
    throw new Error("Draw generation is available only for tournament competitions.");
  }

  const scopedTeamGenerations = await filterEligibleTeamGenerations(competition.id, competition.teamGenerations);
  const availableGenerationYears = Array.from(new Set(scopedTeamGenerations.map((item) => item.generationYear))).sort((a, b) => b - a);
  const generationYear = config.generationYear ?? availableGenerationYears[0];
  if (!generationYear) {
    throw new Error("Nema odobrenih generacija za izvlačenje.");
  }
  const participants = scopedTeamGenerations
    .filter((item) => item.generationYear === generationYear)
    .map((item) => ({ id: item.team.id, name: item.team.name }))
    .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index);
  if (!participants.length) {
    throw new Error("Nema učesnika za odabranu generaciju.");
  }

  if (config.groupStageEnabled && config.groupsCount > participants.length) {
    throw new Error("Groups count cannot exceed participants count.");
  }

  const existingDraw = await prisma.draw.findUnique({
    where: {
      competitionId_generationYear: {
        competitionId,
        generationYear,
      },
    },
  });
  if (existingDraw) {
    throw new Error("Draw already exists for this competition. Reset draw before regenerating.");
  }

  const existingGeneratedGroupMatches = await prisma.match.count({
    where: {
      competitionId,
      stage: "GROUP_STAGE",
      drawId: { not: null },
      generationYear,
    },
  });
  if (existingGeneratedGroupMatches > 0) {
    throw new Error("Group-stage matches already exist. Reset draw before regenerating.");
  }

  return prisma.$transaction(async (tx) => {
    const placeholderBaseDate = competition.startDate ?? new Date();
    const pitchNames = competition.pitchNames && competition.pitchNames.length ? competition.pitchNames : ["Teren 1"];
    const scheduleDays =
      ((competition.scheduleDays as unknown as Array<{ dayLabel: string; dayDate?: string; generationLabel?: string; pitchId?: string | null; startTime: string; endTime: string; stageScope?: ScheduleStageScope }> | null) ?? [
        { dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), pitchId: null, startTime: "09:00", endTime: "19:00" },
      ]).filter((day) => day.dayLabel && day.startTime && day.endTime);
    const generationLabel = `Generacija ${generationYear}`;
      const groupPreferredDays = scheduleDays.filter(
        (day) =>
          (day.generationLabel === generationLabel || day.generationLabel === ALL_GENERATIONS_LABEL) &&
          (normalizeStageScope(day.stageScope) === "GROUP_STAGE" || normalizeStageScope(day.stageScope) === "ALL")
      );
      const groupScheduleDays = groupPreferredDays;
      const knockoutScheduleDays = scheduleDays.filter(
        (day) =>
          (day.generationLabel === generationLabel || day.generationLabel === ALL_GENERATIONS_LABEL) &&
          (normalizeStageScope(day.stageScope) === "KNOCKOUT" || normalizeStageScope(day.stageScope) === "ALL")
      );
    if (!groupScheduleDays.length) {
      throw new Error(`Nema definisanih termina za ${generationLabel}.`);
    }
    const relevantScheduleDays = [...groupScheduleDays, ...knockoutScheduleDays];
    const hasAutoPitchSelection = relevantScheduleDays.some((day) => !day.pitchId);
    const dayPitchIds = Array.from(
      new Set(
        relevantScheduleDays
          .map((day) => day.pitchId)
          .filter((value): value is string => Boolean(value))
      )
    );
    const allActivePitches = await tx.pitch.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        venueId: true,
        venue: { select: { name: true } },
        generationLabel: true,
        playerFormat: true,
        fieldLengthMeters: true,
        fieldWidthMeters: true,
        goalWidthMeters: true,
        goalHeightMeters: true,
      },
    });
    const configuredPitchValues = (competition.pitchNames ?? []).map((value) => value.trim()).filter(Boolean);
    const configuredPitchLeafNames = configuredPitchValues.map((value) => {
      const parts = value.split(" - ").map((part) => part.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : value;
    });
    const configuredSet = new Set(configuredPitchValues);
    const configuredLeafSet = new Set(configuredPitchLeafNames);

    let selectedPitches = dayPitchIds.length && !hasAutoPitchSelection
      ? allActivePitches.filter((pitch) => dayPitchIds.includes(pitch.id))
      : [];

    if (!selectedPitches.length) {
      selectedPitches = allActivePitches.filter((pitch) => {
        const venuePitchLabel = pitch.venue?.name ? `${pitch.venue.name} - ${pitch.name}` : pitch.name;
        return configuredSet.has(venuePitchLabel) || configuredSet.has(pitch.name) || configuredLeafSet.has(pitch.name);
      });
    }

    if (!selectedPitches.length && competition.venueId) {
      selectedPitches = allActivePitches.filter((pitch) => pitch.venueId === competition.venueId);
    }

    const hasCompetitionVenueConfig = configuredPitchValues.length > 0 || Boolean(competition.venueId);
    if (!selectedPitches.length && !hasCompetitionVenueConfig) {
      selectedPitches = allActivePitches;
    }

    const pitchLabelById = new Map(
      selectedPitches.map((pitch) => [
        pitch.id,
        pitch.venue?.name ? `${pitch.venue.name} - ${pitch.name}` : pitch.name,
      ])
    );
    const selectedPitchLabels = selectedPitches
      .map((item) => pitchLabelById.get(item.id) ?? item.name)
      .filter(Boolean);
    const selectedPitchLegacyNames = selectedPitches.map((item) => item.name).filter(Boolean);
    if (!selectedPitchLabels.length) {
      throw new Error(`Nije pronađen nijedan aktivan teren za ${generationLabel}.`);
    }
    // Generacija je preporuka za tip terena, ali organizator može koristiti i druge terene.
    const generationPreset = resolveGenerationProfile(generationLabel);
    const preferredCompatiblePitches = generationPreset
      ? selectedPitches.filter((pitch) => {
          const formatOk = pitch.playerFormat?.trim() === generationPreset.playerFormat;
          const sizeOk =
            pitch.fieldLengthMeters === generationPreset.fieldLengthMeters &&
            pitch.fieldWidthMeters === generationPreset.fieldWidthMeters;
          return formatOk && sizeOk;
        })
      : [];
    if (preferredCompatiblePitches.length) {
      selectedPitches = preferredCompatiblePitches.concat(
        selectedPitches.filter((item) => !preferredCompatiblePitches.some((pick) => pick.id === item.id))
      );
    }
    const strictPitchLabelById = new Map(
      selectedPitches.map((pitch) => [
        pitch.id,
        pitch.venue?.name ? `${pitch.venue.name} - ${pitch.name}` : pitch.name,
      ])
    );
    const strictPitchLabels = selectedPitches
      .map((item) => strictPitchLabelById.get(item.id) ?? item.name)
      .filter(Boolean);
    const strictPitchLegacyNames = selectedPitches.map((item) => item.name).filter(Boolean);
    const pitchById = new Map(selectedPitches.map((pitch) => [pitch.id, strictPitchLabelById.get(pitch.id) ?? pitch.name]));
    const scoredPitches = selectedPitches
      .map((pitch) => ({ pitch, score: scorePitchForGeneration(pitch, generationLabel) }))
      .sort((a, b) => b.score - a.score);
    const recommendedByScore = scoredPitches.filter((item) => item.score > 0).map((item) => item.pitch);
    const autoPitchPool = preferredCompatiblePitches.length
      ? preferredCompatiblePitches
      : recommendedByScore.length
        ? recommendedByScore
        : selectedPitches;
    const autoPitchLabels = autoPitchPool
      .map((pitch) => strictPitchLabelById.get(pitch.id) ?? pitch.name)
      .filter(Boolean);
    const effectiveAutoPitchLabels = autoPitchLabels.length ? autoPitchLabels : strictPitchLabels;

    const applyAutoPitch = (
      rows: Array<{ pitchId?: string | null; generationLabel?: string; stageScope?: ScheduleStageScope }>
    ) =>
      // AUTO mode: keep pitchId null so scheduler can use all selected competition pitches.
      rows.map((row) => row);

    const groupScheduleDaysWithAutoPitch = applyAutoPitch(groupScheduleDays as Array<{ pitchId?: string | null; generationLabel?: string; stageScope?: ScheduleStageScope }>) as typeof groupScheduleDays;
    const knockoutScheduleDaysWithAutoPitch = applyAutoPitch(
      (knockoutScheduleDays.length ? knockoutScheduleDays : groupScheduleDays) as Array<{ pitchId?: string | null; generationLabel?: string; stageScope?: ScheduleStageScope }>
    ) as typeof groupScheduleDays;
    const groupScheduleWithPitch = groupScheduleDaysWithAutoPitch.map((day) => ({
      ...day,
      pitchName: day.pitchId ? pitchById.get(day.pitchId) ?? null : null,
      stageScope: normalizeStageScope(day.stageScope),
    }));
    const knockoutScheduleWithPitch = knockoutScheduleDaysWithAutoPitch.map((day) => ({
      ...day,
      pitchName: day.pitchId ? pitchById.get(day.pitchId) ?? null : null,
      stageScope: normalizeStageScope(day.stageScope),
    }));
    const generationMatchDurationMinutes = resolveGenerationMatchDuration(
      competition.generationMatchDurations,
      generationYear,
      competition.matchDurationMinutes
    );
    const slotDurationMinutes = generationMatchDurationMinutes + 5;
    const existingMatches = await tx.match.findMany({
      where: {
        competition: { organizationId },
        pitchName: { in: Array.from(new Set([...strictPitchLabels, ...strictPitchLegacyNames])) },
        status: { not: "CANCELED" },
      },
      select: {
        pitchName: true,
        scheduledAt: true,
        regularTimeMinutes: true,
      },
    });
    const existingKnockoutSlots = await tx.drawKnockoutMatch.findMany({
      where: {
        scheduledAt: { not: null },
        pitchName: { in: Array.from(new Set([...strictPitchLabels, ...strictPitchLegacyNames])) },
        round: {
          draw: {
            competition: {
              organizationId,
            },
          },
        },
      },
      select: {
        pitchName: true,
        scheduledAt: true,
      },
    });
    const adjacentYears = adjacentGenerationYears(generationYear);
    const adjacentMatches = await tx.match.findMany({
      where: {
        competitionId,
        generationYear: { in: adjacentYears },
        status: { not: "CANCELED" },
      },
      select: {
        scheduledAt: true,
        regularTimeMinutes: true,
      },
    });
    const adjacentKnockoutSlots = await tx.drawKnockoutMatch.findMany({
      where: {
        scheduledAt: { not: null },
        round: {
          draw: {
            competitionId,
            generationYear: { in: adjacentYears },
          },
        },
      },
      select: {
        scheduledAt: true,
      },
    });
    const blockedIntervals = [
      ...scheduledMatchIntervals(adjacentMatches, generationMatchDurationMinutes),
      ...scheduledSlotIntervals(adjacentKnockoutSlots, slotDurationMinutes),
    ];
    const occupiedIntervalsByPitch = new Map<string, ScheduleInterval[]>();
    for (const match of existingMatches) {
      if (!match.pitchName) continue;
      const startAt = match.scheduledAt.getTime();
      const endAt = startAt + (match.regularTimeMinutes + 5) * 60 * 1000;
      const intervals = occupiedIntervalsByPitch.get(match.pitchName) ?? [];
      intervals.push({ startAt, endAt });
      occupiedIntervalsByPitch.set(match.pitchName, intervals);
    }
    for (const slot of existingKnockoutSlots) {
      if (!slot.pitchName || !slot.scheduledAt) continue;
      const startAt = slot.scheduledAt.getTime();
      const endAt = startAt + slotDurationMinutes * 60 * 1000;
      const intervals = occupiedIntervalsByPitch.get(slot.pitchName) ?? [];
      intervals.push({ startAt, endAt });
      occupiedIntervalsByPitch.set(slot.pitchName, intervals);
    }

    const draw = await tx.draw.create({
      data: {
        competitionId,
        generationYear,
        createdById: actor.id,
        groupStageEnabled: config.groupStageEnabled,
        groupsCount: config.groupStageEnabled ? config.groupsCount : 0,
        roundOf16Enabled: config.roundOf16Enabled,
        quarterfinalsEnabled: config.quarterfinalsEnabled,
        thirdPlaceMatchEnabled: config.thirdPlaceMatchEnabled,
      },
    });

    const createdGroups: Array<{ id: string; name: string; teamIds: string[]; order: number }> = [];
    const autoAddedScheduleDays: Array<{
      dayLabel: string;
      dayDate?: string;
      generationLabel?: string;
      pitchId?: string | null;
      startTime: string;
      endTime: string;
      stageScope?: ScheduleStageScope;
    }> = [];
    let groupPhaseEndAt: Date | null = null;

    if (config.groupStageEnabled) {
      const groups = distributeParticipants(participants, config.groupsCount);
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const createdGroup = await tx.drawGroup.create({
          data: { drawId: draw.id, name: group.name, order: index + 1 },
        });
        createdGroups.push({
          id: createdGroup.id,
          name: createdGroup.name,
          teamIds: group.teams.map((team) => team.id),
          order: index + 1,
        });

        if (group.teams.length) {
          await tx.drawGroupTeam.createMany({
            data: group.teams.map((team, teamIndex) => ({
              groupId: createdGroup.id,
              teamId: team.id,
              position: teamIndex + 1,
            })),
          });
        }
      }
    }

    if (config.groupStageEnabled) {
      const fixtures = createdGroups.flatMap((group) =>
        createGroupFixtures(group.id, group.name, group.teamIds, group.order)
      );
      const scheduledFixtureResult = buildScheduledFixtures(
        fixtures,
        effectiveAutoPitchLabels,
        placeholderBaseDate,
        groupScheduleWithPitch,
        slotDurationMinutes,
        occupiedIntervalsByPitch,
        { tournamentEndDate: competition.endDate ?? null, packEarlierDays: true, blockedIntervals }
      );
      autoAddedScheduleDays.push(
        ...scheduledFixtureResult.addedDays.map((day) => ({
          dayLabel: day.dayLabel,
          dayDate: day.dayDate,
          generationLabel,
          pitchId: day.pitchId ?? null,
          startTime: day.startTime,
          endTime: day.endTime,
          stageScope: "GROUP_STAGE" as const,
        }))
      );
      const scheduledFixtures = scheduledFixtureResult.scheduled;
      if (scheduledFixtures.length) {
        const maxGroupEndTs = Math.max(
          ...scheduledFixtures.map((item) => item.scheduledAt.getTime() + slotDurationMinutes * 60 * 1000)
        );
        groupPhaseEndAt = new Date(maxGroupEndTs);
      }

      for (const scheduledFixture of scheduledFixtures) {
        const fixture = scheduledFixture.fixture;
        const venueLabel = scheduledFixture.pitchName;
        await tx.match.create({
          data: {
            competitionId: competition.id,
            seasonId: competition.seasonId ?? null,
            drawId: draw.id,
            drawGroupId: fixture.drawGroupId,
            stage: "GROUP_STAGE",
            round: `Group ${fixture.groupName}`,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            status: "SCHEDULED",
            scheduledAt: scheduledFixture.scheduledAt,
            regularTimeMinutes: generationMatchDurationMinutes,
            pitchName: scheduledFixture.pitchName,
            venueLabel,
            createdById: actor.id,
            generationYear,
          },
        });
      }
    }

    const rounds: Array<{ type: DrawRoundType; order: number; matches: RoundMatchSeed[] }> =
      [];

    if (config.roundOf16Enabled) {
      let matches: RoundMatchSeed[] = [];
      if (config.groupStageEnabled && createdGroups.length >= 2) {
        const winners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_WINNER, sourceValue: group.name }));
        const runners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_RUNNER_UP, sourceValue: group.name }));
        matches = createRoundPairs(winners, runners, 8).map((pair, index) => ({
          ...pair,
          order: index + 1,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        }));
      } else {
        matches = createDirectPairs(participants, 8).map((pair, index) => ({
          ...pair,
          order: index + 1,
          winnerTeamId: null,
        }));
      }

      rounds.push({ type: DrawRoundType.ROUND_OF_16, order: 1, matches });
      rounds.push({
        type: DrawRoundType.QUARTERFINAL,
        order: 2,
        matches: Array.from({ length: 4 }, (_, index) => ({
          order: index + 1,
          homeSourceType: DrawSourceType.MATCH_WINNER,
          homeSourceValue: `R16-${index * 2 + 1}`,
          awaySourceType: DrawSourceType.MATCH_WINNER,
          awaySourceValue: `R16-${index * 2 + 2}`,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        })),
      });
    } else if (config.quarterfinalsEnabled) {
      let matches: RoundMatchSeed[] = [];
      if (config.groupStageEnabled && createdGroups.length >= 2) {
        const winners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_WINNER, sourceValue: group.name }));
        const runners = createdGroups.map((group) => ({ sourceType: DrawSourceType.GROUP_RUNNER_UP, sourceValue: group.name }));
        matches = createRoundPairs(winners, runners, 4).map((pair, index) => ({
          ...pair,
          order: index + 1,
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        }));
      } else {
        matches = createDirectPairs(participants, 4).map((pair, index) => ({
          ...pair,
          order: index + 1,
          winnerTeamId: null,
        }));
      }

      rounds.push({ type: DrawRoundType.QUARTERFINAL, order: 1, matches });
    }

    const hasQuarter = rounds.some((round) => round.type === DrawRoundType.QUARTERFINAL);
    rounds.push({
      type: DrawRoundType.SEMIFINAL,
      order: hasQuarter ? rounds.length + 1 : 1,
      matches: Array.from({ length: 2 }, (_, index) => ({
        order: index + 1,
        homeSourceType: DrawSourceType.MATCH_WINNER,
        homeSourceValue: hasQuarter ? `QF-${index * 2 + 1}` : `Seed-${index * 2 + 1}`,
        awaySourceType: DrawSourceType.MATCH_WINNER,
        awaySourceValue: hasQuarter ? `QF-${index * 2 + 2}` : `Seed-${index * 2 + 2}`,
        homeTeamId: null,
        awayTeamId: null,
        winnerTeamId: null,
      })),
    });

    rounds.push({
      type: DrawRoundType.FINAL,
      order: rounds.length + 1,
      matches: [
        {
          order: 1,
          homeSourceType: DrawSourceType.MATCH_WINNER,
          homeSourceValue: "SF-1",
          awaySourceType: DrawSourceType.MATCH_WINNER,
          awaySourceValue: "SF-2",
          homeTeamId: null,
          awayTeamId: null,
          winnerTeamId: null,
        },
      ],
    });

    if (config.thirdPlaceMatchEnabled) {
      rounds.push({
        type: DrawRoundType.THIRD_PLACE,
        order: rounds.length + 1,
        matches: [
          {
            order: 1,
            homeSourceType: DrawSourceType.MATCH_WINNER,
            homeSourceValue: "SF-1-LOSER",
            awaySourceType: DrawSourceType.MATCH_WINNER,
            awaySourceValue: "SF-2-LOSER",
            homeTeamId: null,
            awayTeamId: null,
            winnerTeamId: null,
          },
        ],
      });
    }

    for (const round of rounds) {
      const createdRound = await tx.drawKnockoutRound.create({
        data: {
          drawId: draw.id,
          roundType: round.type,
          order: round.order,
        },
      });
      const nextKnockoutSlot = buildKnockoutScheduleSlotPicker(
        effectiveAutoPitchLabels,
        knockoutScheduleWithPitch,
        placeholderBaseDate,
        slotDurationMinutes,
        occupiedIntervalsByPitch,
        { tournamentEndDate: competition.endDate ?? null, minStartAt: groupPhaseEndAt, blockedIntervals }
      );
      const appendedKnockoutDayKeys = new Set<string>();
      for (const match of round.matches) {
        const slot = nextKnockoutSlot();
        for (const day of slot.addedDays) {
          const key = `${day.dayDate ?? ""}|${day.pitchId ?? ""}|${day.startTime}|${day.endTime}|KNOCKOUT`;
          if (appendedKnockoutDayKeys.has(key)) continue;
          appendedKnockoutDayKeys.add(key);
          autoAddedScheduleDays.push({
            dayLabel: day.dayLabel,
            dayDate: day.dayDate,
            generationLabel,
            pitchId: day.pitchId ?? null,
            startTime: day.startTime,
            endTime: day.endTime,
            stageScope: "KNOCKOUT",
          });
        }
        const venueLabel = slot.pitchName;
        await tx.drawKnockoutMatch.create({
          data: {
            roundId: createdRound.id,
            ...match,
            scheduledAt: slot.scheduledAt,
            pitchName: slot.pitchName,
            venueLabel,
          },
        });
      }
    }

    if (autoAddedScheduleDays.length) {
      const keyOf = (day: {
        dayLabel: string;
        dayDate?: string;
        generationLabel?: string;
        pitchId?: string | null;
        startTime: string;
        endTime: string;
        stageScope?: ScheduleStageScope;
      }) =>
        [
          day.dayDate ?? "",
          day.generationLabel ?? "",
          day.pitchId ?? "",
          day.startTime,
          day.endTime,
          normalizeStageScope(day.stageScope),
        ].join("|");

      const existingMap = new Map(
        scheduleDays.map((day) => [
          keyOf({
            dayLabel: day.dayLabel,
            dayDate: day.dayDate,
            generationLabel: day.generationLabel,
            pitchId: day.pitchId ?? null,
            startTime: day.startTime,
            endTime: day.endTime,
            stageScope: normalizeStageScope(day.stageScope),
          }),
          {
            dayLabel: day.dayLabel,
            dayDate: day.dayDate,
            generationLabel: day.generationLabel,
            pitchId: day.pitchId ?? null,
            startTime: day.startTime,
            endTime: day.endTime,
            stageScope: normalizeStageScope(day.stageScope),
          },
        ])
      );

      for (const day of autoAddedScheduleDays) {
        existingMap.set(keyOf(day), {
          dayLabel: day.dayLabel,
          dayDate: day.dayDate,
          generationLabel: day.generationLabel,
          pitchId: day.pitchId ?? null,
          startTime: day.startTime,
          endTime: day.endTime,
          stageScope: normalizeStageScope(day.stageScope),
        });
      }

      await tx.competition.update({
        where: { id: competition.id },
        data: {
          scheduleDays: Array.from(existingMap.values()) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    await syncMaterializedKnockoutMatches(tx, draw.id);

    return draw;
  });
}

export async function swapDrawGroupTeams(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  generationYear: number,
  firstTeamId: string,
  secondTeamId: string
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (firstTeamId === secondTeamId) throw new Error("Odaberi dvije različite ekipe.");

  const draw = await prisma.draw.findUnique({
    where: {
      competitionId_generationYear: {
        competitionId,
        generationYear,
      },
    },
    select: { id: true },
  });
  if (!draw) throw new Error("Izvlačenje za odabranu generaciju ne postoji.");

  const groupEntries = await prisma.drawGroupTeam.findMany({
    where: {
      group: { drawId: draw.id },
      teamId: { in: [firstTeamId, secondTeamId] },
    },
    select: {
      id: true,
      teamId: true,
      groupId: true,
      position: true,
    },
  });

  const firstEntry = groupEntries.find((item) => item.teamId === firstTeamId);
  const secondEntry = groupEntries.find((item) => item.teamId === secondTeamId);
  if (!firstEntry || !secondEntry) {
    throw new Error("Obje ekipe moraju biti u grupama za odabranu generaciju.");
  }
  if (firstEntry.groupId === secondEntry.groupId) {
    throw new Error("Switch radi samo između različitih grupa.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.drawGroupTeam.update({
      where: { id: firstEntry.id },
      data: { teamId: secondTeamId, position: secondEntry.position ?? firstEntry.position ?? null },
    });
    await tx.drawGroupTeam.update({
      where: { id: secondEntry.id },
      data: { teamId: firstTeamId, position: firstEntry.position ?? secondEntry.position ?? null },
    });

    const affectedMatches = await tx.match.findMany({
      where: {
        competitionId,
        drawId: draw.id,
        stage: "GROUP_STAGE",
        generationYear,
        OR: [
          { homeTeamId: firstTeamId },
          { awayTeamId: firstTeamId },
          { homeTeamId: secondTeamId },
          { awayTeamId: secondTeamId },
        ],
      },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });

    for (const match of affectedMatches) {
      const nextHome =
        match.homeTeamId === firstTeamId
          ? secondTeamId
          : match.homeTeamId === secondTeamId
            ? firstTeamId
            : match.homeTeamId;
      const nextAway =
        match.awayTeamId === firstTeamId
          ? secondTeamId
          : match.awayTeamId === secondTeamId
            ? firstTeamId
            : match.awayTeamId;
      if (nextHome === nextAway) continue;
      await tx.match.update({
        where: { id: match.id },
        data: {
          homeTeamId: nextHome,
          awayTeamId: nextAway,
        },
      });
    }

    await syncMaterializedKnockoutMatches(tx, draw.id);

    return { ok: true };
  });
}

function swapVenuePitchLabel(venueLabel: string | null, fromPitch: string, toPitch: string) {
  if (!venueLabel) return venueLabel;
  const separator = " - ";
  const parts = venueLabel.split(separator).map((item) => item.trim()).filter(Boolean);
  if (parts.length < 2) {
    return venueLabel.trim() === fromPitch ? toPitch : venueLabel;
  }
  const last = parts[parts.length - 1];
  if (last !== fromPitch) return venueLabel;
  parts[parts.length - 1] = toPitch;
  return parts.join(separator);
}

export async function swapDrawPitches(
  organizationId: string,
  actor: { id: string; role: string },
  competitionId: string,
  generationYear: number,
  firstPitchName: string,
  secondPitchName: string
) {
  const competition = await ensureCompetition(organizationId, competitionId);
  if (!competition) return null;
  if (!canEditEntity(actor, competition)) throw new Error("Forbidden");
  if (firstPitchName === secondPitchName) throw new Error("Odaberi dva različita terena.");

  const draw = await prisma.draw.findUnique({
    where: {
      competitionId_generationYear: {
        competitionId,
        generationYear,
      },
    },
    select: { id: true },
  });
  if (!draw) throw new Error("Izvlačenje za odabranu generaciju ne postoji.");

  return prisma.$transaction(async (tx) => {
    const groupMatches = await tx.match.findMany({
      where: {
        competitionId,
        drawId: draw.id,
        generationYear,
        stage: "GROUP_STAGE",
        pitchName: { in: [firstPitchName, secondPitchName] },
      },
      select: { id: true, pitchName: true, venueLabel: true },
    });

    for (const match of groupMatches) {
      const nextPitch = match.pitchName === firstPitchName ? secondPitchName : firstPitchName;
      const nextVenueLabel = swapVenuePitchLabel(match.venueLabel, match.pitchName ?? "", nextPitch);
      await tx.match.update({
        where: { id: match.id },
        data: {
          pitchName: nextPitch,
          venueLabel: nextVenueLabel,
        },
      });
    }

    const roundIds = (
      await tx.drawKnockoutRound.findMany({
        where: { drawId: draw.id },
        select: { id: true },
      })
    ).map((item) => item.id);

    if (roundIds.length) {
      const knockoutMatches = await tx.drawKnockoutMatch.findMany({
        where: {
          roundId: { in: roundIds },
          pitchName: { in: [firstPitchName, secondPitchName] },
        },
        select: { id: true, pitchName: true, venueLabel: true },
      });

      for (const match of knockoutMatches) {
        const nextPitch = match.pitchName === firstPitchName ? secondPitchName : firstPitchName;
        const nextVenueLabel = swapVenuePitchLabel(match.venueLabel, match.pitchName ?? "", nextPitch);
        await tx.drawKnockoutMatch.update({
          where: { id: match.id },
          data: {
            pitchName: nextPitch,
            venueLabel: nextVenueLabel,
          },
        });
      }
    }

    await syncMaterializedKnockoutMatches(tx, draw.id);

    return { ok: true };
  });
}
