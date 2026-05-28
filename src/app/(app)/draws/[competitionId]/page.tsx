"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompetition, useCompetitionDraw, useGenerateDraw, useResetDraw, useSwapDrawPitches, useSwapDrawTeams, useUpdateCompetition, useVenues } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canCreateDraws } from "@/lib/permissions";
import { GENERATION_LABELS, getGenerationPreset } from "@/lib/constants/generation-presets";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Select } from "@/components/ui/select";

type DrawTeam = { name: string; profileImageUrl?: string | null };
type DrawMatch = {
  id: string;
  homeTeam: DrawTeam | null;
  awayTeam: DrawTeam | null;
  homeSourceValue: string;
  awaySourceValue: string;
};
const ALL_GENERATIONS_LABEL = "Sve generacije";
type ScheduleDayRow = {
  dayLabel: string;
  dayDate: string;
  generationLabel: string;
  stageScope?: "ALL" | "GROUP_STAGE" | "KNOCKOUT";
  pitchId?: string | null;
  startTime: string;
  endTime: string;
};

function resolveGenerationProfile(generationLabel: string) {
  const year = Number(generationLabel.replace("Generacija ", ""));
  if (Number.isFinite(year)) {
    if (year >= 2018 && year <= 2021) return { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25, goalWidthMeters: 5, goalHeightMeters: 2 };
    if (year >= 2016 && year <= 2017) return { playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40, goalWidthMeters: 5, goalHeightMeters: 2 };
    if (year >= 2014 && year <= 2015) return { playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50, goalWidthMeters: 5, goalHeightMeters: 2 };
    if (year >= 2011 && year <= 2013) return { playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50, goalWidthMeters: 6.4, goalHeightMeters: 2.13 };
  }
  const preset = getGenerationPreset(generationLabel);
  if (!preset) return null;
  return preset;
}

function TeamMark({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={name} className="h-4 w-4 rounded-full object-cover" />;
  }
  return <span>🛡️</span>;
}

export default function CompetitionDrawPage() {
  const params = useParams<{ competitionId: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManageByRole = canCreateDraws(user?.role);
  const [selectedGenerationYear, setSelectedGenerationYear] = useState<number | null>(null);
  const [isGenerationSwitching, setIsGenerationSwitching] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);
  const drawQuery = useCompetitionDraw(params.competitionId, selectedGenerationYear);
  const competitionDetailsQuery = useCompetition(params.competitionId);
  const venuesQuery = useVenues();
  const updateCompetition = useUpdateCompetition(params.competitionId);
  const generateDraw = useGenerateDraw(params.competitionId);
  const resetDraw = useResetDraw(params.competitionId);
  const swapDrawTeams = useSwapDrawTeams(params.competitionId);
  const swapDrawPitches = useSwapDrawPitches(params.competitionId);

  const [draftConfig, setDraftConfig] = useState<{
    groupStageEnabled?: boolean;
    groupsCount?: number;
    roundOf16Enabled?: boolean;
    quarterfinalsEnabled?: boolean;
    thirdPlaceMatchEnabled?: boolean;
  }>({});
  const [swapFirstTeamId, setSwapFirstTeamId] = useState("");
  const [swapSecondTeamId, setSwapSecondTeamId] = useState("");
  const [swapFirstPitchName, setSwapFirstPitchName] = useState("");
  const [swapSecondPitchName, setSwapSecondPitchName] = useState("");
  const [scheduleDaysDraft, setScheduleDaysDraft] = useState<ScheduleDayRow[]>([]);
  const [scheduleSaved, setScheduleSaved] = useState<string | null>(null);
  const [scheduleSavedVisible, setScheduleSavedVisible] = useState(false);
  const [generateErrorVisible, setGenerateErrorVisible] = useState(false);
  const [swapSuccessVisible, setSwapSuccessVisible] = useState(false);
  const [hideDiagnosticsAfterReset, setHideDiagnosticsAfterReset] = useState(false);
  const generationYears = drawQuery.data?.competition.availableGenerationYears ?? [];
  const activeGeneration = drawQuery.data?.competition.selectedGenerationYear ?? generationYears[0] ?? null;
  const scheduleGenerationOptions = [ALL_GENERATIONS_LABEL, ...GENERATION_LABELS];
  const defaultTournamentDay = competitionDetailsQuery.data?.startDate
    ? new Date(competitionDetailsQuery.data.startDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const scheduleDays = scheduleDaysDraft.length
    ? scheduleDaysDraft
    : ((competitionDetailsQuery.data?.scheduleDays as ScheduleDayRow[] | null) ?? [
        {
          dayLabel: "Dan 1",
          dayDate: defaultTournamentDay,
          generationLabel: ALL_GENERATIONS_LABEL,
          stageScope: "ALL",
          pitchId: null,
          startTime: "09:00",
          endTime: "19:00",
        },
      ]).map((day) => ({
        ...day,
        dayDate: day.dayDate ?? defaultTournamentDay,
        dayLabel: day.dayLabel || day.dayDate || "Dan 1",
        generationLabel: day.generationLabel || ALL_GENERATIONS_LABEL,
        stageScope: day.stageScope ?? "ALL",
      }));
  const allPitchOptions = useMemo(
    () =>
      (venuesQuery.data ?? []).flatMap((venue) =>
        venue.pitches.map((pitch) => ({
          id: pitch.id,
          venueName: venue.name,
          pitchName: pitch.name,
          generationLabel: pitch.generationLabel,
          playerFormat: pitch.playerFormat,
          fieldLengthMeters: pitch.fieldLengthMeters,
          fieldWidthMeters: pitch.fieldWidthMeters,
          goalWidthMeters: pitch.goalWidthMeters,
          goalHeightMeters: pitch.goalHeightMeters,
          label: `${venue.name} - ${pitch.name} (${pitch.fieldLengthMeters}x${pitch.fieldWidthMeters} m, ${pitch.playerFormat})`,
        }))
      ),
    [venuesQuery.data]
  );
  const configuredPitchValues = useMemo(
    () => (competitionDetailsQuery.data?.pitchNames ?? []).map((value) => value.trim()).filter(Boolean),
    [competitionDetailsQuery.data?.pitchNames]
  );
  const configuredPitchLeafSet = useMemo(
    () =>
      new Set(
        configuredPitchValues.map((value) => {
          const parts = value.split(" - ").map((part) => part.trim()).filter(Boolean);
          return parts.length ? parts[parts.length - 1] : value;
        })
      ),
    [configuredPitchValues]
  );
  const configuredPitchSet = useMemo(() => new Set(configuredPitchValues), [configuredPitchValues]);
  const eligiblePitchOptions = useMemo(() => {
    if (!allPitchOptions.length) return [];
    if (!configuredPitchValues.length) return allPitchOptions;
    return allPitchOptions.filter((item) => {
      const venuePitch = `${item.venueName} - ${item.pitchName}`;
      return configuredPitchSet.has(venuePitch) || configuredPitchSet.has(item.pitchName) || configuredPitchLeafSet.has(item.pitchName);
    });
  }, [allPitchOptions, configuredPitchLeafSet, configuredPitchSet, configuredPitchValues.length]);
  const displayedScheduleDays = useMemo(() => {
    const baseDate =
      scheduleDays.find((day) => day.dayDate)?.dayDate ??
      (competitionDetailsQuery.data?.startDate ? new Date(competitionDetailsQuery.data.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    return scheduleDays.map((row) => ({
      ...row,
      dayDate: row.dayDate ?? baseDate,
      stageScope: row.stageScope ?? "ALL",
    }));
  }, [competitionDetailsQuery.data?.startDate, eligiblePitchOptions, scheduleDays]);
  const autoDrawDiagnostics = useMemo(() => {
    const pitchNameById = new Map(
      allPitchOptions.map((item) => [item.id, item.label])
    );
    const configuredGenerationLabels = Array.from(
      new Set(
        displayedScheduleDays
          .map((day) => day.generationLabel)
          .filter((label): label is string => Boolean(label && label !== ALL_GENERATIONS_LABEL))
      )
    ).sort((a, b) => {
      const ay = Number(a.replace("Generacija ", ""));
      const by = Number(b.replace("Generacija ", ""));
      if (Number.isFinite(ay) && Number.isFinite(by)) return by - ay;
      return a.localeCompare(b);
    });

    return configuredGenerationLabels
      .map((label) => {
        const year = Number(label.replace("Generacija ", ""));
        const applicableDays = displayedScheduleDays.filter((day) => day.generationLabel === label || day.generationLabel === ALL_GENERATIONS_LABEL);
        const groupDays = applicableDays.filter(
          (day) => (day.stageScope ?? "ALL") === "ALL" || (day.stageScope ?? "ALL") === "GROUP_STAGE"
        );
        const knockoutDays = applicableDays.filter(
          (day) => (day.stageScope ?? "ALL") === "ALL" || (day.stageScope ?? "ALL") === "KNOCKOUT"
        );
        const resolvedPitchLabels = new Set<string>();
        for (const day of applicableDays) {
          if (day.pitchId && pitchNameById.has(day.pitchId)) {
            resolvedPitchLabels.add(pitchNameById.get(day.pitchId)!);
          } else {
            resolvedPitchLabels.add("AUTO (FIFA kompatibilan teren iz stadiona turnira)");
          }
        }
        const nearestMismatches = (() => {
          const preset = resolveGenerationProfile(label);
          if (!preset) return [];
          const candidates = eligiblePitchOptions
            .map((pitch) => {
              const problems: string[] = [];
              if ((pitch.playerFormat ?? "").trim() !== preset.playerFormat) {
                problems.push(`format ${pitch.playerFormat ?? "N/A"} != ${preset.playerFormat}`);
              }
              if (pitch.fieldLengthMeters !== preset.fieldLengthMeters || pitch.fieldWidthMeters !== preset.fieldWidthMeters) {
                problems.push(
                  `teren ${pitch.fieldLengthMeters}x${pitch.fieldWidthMeters} != ${preset.fieldLengthMeters}x${preset.fieldWidthMeters}`
                );
              }
              if (pitch.goalWidthMeters != null && pitch.goalHeightMeters != null && (
                pitch.goalWidthMeters !== preset.goalWidthMeters ||
                pitch.goalHeightMeters !== preset.goalHeightMeters
              )) {
                problems.push(
                  `gol ${pitch.goalWidthMeters ?? "?"}x${pitch.goalHeightMeters ?? "?"} != ${preset.goalWidthMeters}x${preset.goalHeightMeters}`
                );
              }
              return {
                label: pitch.label,
                problems,
              };
            })
            .filter((item) => item.problems.length > 0)
            .sort((a, b) => a.problems.length - b.problems.length || a.label.localeCompare(b.label))
            .slice(0, 3)
            .map((item) => `${item.label} [${item.problems.join("; ")}]`);
          return candidates;
        })();
        return {
          year,
          label,
          groupSlots: groupDays.length,
          knockoutSlots: knockoutDays.length,
          pitchLabels: Array.from(resolvedPitchLabels),
          missingReason:
            !resolvedPitchLabels.size
              ? (() => {
                  const preset = resolveGenerationProfile(label);
                  if (!preset) return "Nema definisanog FIFA preset pravila za ovu generaciju.";
                  const goalRule = `, gol ${preset.goalWidthMeters}x${preset.goalHeightMeters}m`;
                  return `Nema kompatibilnog terena (${preset.playerFormat}, ${preset.fieldLengthMeters}x${preset.fieldWidthMeters}m${goalRule}) u izabranim stadionima turnira.`;
                })()
              : null,
          nearestMismatches,
        };
      });
  }, [allPitchOptions, displayedScheduleDays, eligiblePitchOptions]);

  useEffect(() => {
    if (selectedGenerationYear == null && activeGeneration != null) {
      setSelectedGenerationYear(activeGeneration);
    }
  }, [selectedGenerationYear, activeGeneration]);

  useEffect(() => {
    if (selectedGenerationYear == null) return;
    setIsGenerationSwitching(true);
    const timeout = window.setTimeout(() => setIsGenerationSwitching(false), 220);
    return () => window.clearTimeout(timeout);
  }, [selectedGenerationYear]);
  useEffect(() => {
    if (!competitionDetailsQuery.data?.scheduleDays) return;
    const mapped = (competitionDetailsQuery.data.scheduleDays as ScheduleDayRow[]).map((day) => ({
      ...day,
      dayDate: day.dayDate ?? defaultTournamentDay,
      dayLabel: day.dayLabel || day.dayDate || "Dan 1",
      generationLabel: day.generationLabel || ALL_GENERATIONS_LABEL,
      stageScope: day.stageScope ?? "ALL",
    }));
    setScheduleDaysDraft(mapped);
    setHideDiagnosticsAfterReset(false);
  }, [competitionDetailsQuery.data?.scheduleDays, defaultTournamentDay]);
  useEffect(() => {
    if (!scheduleSaved) return;
    setScheduleSavedVisible(true);
    const fade = window.setTimeout(() => setScheduleSavedVisible(false), 2200);
    const clear = window.setTimeout(() => setScheduleSaved(null), 2600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(clear);
    };
  }, [scheduleSaved]);
  useEffect(() => {
    if (!generateError) return;
    setGenerateErrorVisible(true);
    const fade = window.setTimeout(() => setGenerateErrorVisible(false), 2200);
    const clear = window.setTimeout(() => setGenerateError(null), 2600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(clear);
    };
  }, [generateError]);
  useEffect(() => {
    if (!swapSuccess) return;
    setSwapSuccessVisible(true);
    const fade = window.setTimeout(() => setSwapSuccessVisible(false), 2200);
    const clear = window.setTimeout(() => setSwapSuccess(null), 2600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(clear);
    };
  }, [swapSuccess]);

  if (drawQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }
  if (!drawQuery.data) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Competition not found.</Card>;
  }

  const { competition, draw } = drawQuery.data;
  const hasEndedByDate = competitionDetailsQuery.data?.endDate ? new Date(competitionDetailsQuery.data.endDate).getTime() < Date.now() : false;
  const hasEndedByStatus =
    competitionDetailsQuery.data?.status === "COMPLETED" || competitionDetailsQuery.data?.status === "ARCHIVED";
  const isDrawLocked = hasEndedByDate || hasEndedByStatus;
  const canManage = canManageByRole && Boolean(drawQuery.data.canManage) && !isDrawLocked;
  const isTournament = competition.type === "TOURNAMENT";

  const currentConfig = {
    groupStageEnabled: draftConfig.groupStageEnabled ?? draw?.groupStageEnabled ?? true,
    groupsCount: draftConfig.groupsCount ?? draw?.groupsCount ?? 4,
    roundOf16Enabled: draftConfig.roundOf16Enabled ?? draw?.roundOf16Enabled ?? false,
    quarterfinalsEnabled: draftConfig.quarterfinalsEnabled ?? draw?.quarterfinalsEnabled ?? true,
    thirdPlaceMatchEnabled: draftConfig.thirdPlaceMatchEnabled ?? draw?.thirdPlaceMatchEnabled ?? false,
  };

  async function onGenerate() {
    setGenerateError(null);
    setSwapSuccess(null);
    setScheduleSaved(null);
    try {
      await generateDraw.mutateAsync({ ...currentConfig });
      setScheduleDaysDraft([]);
      await competitionDetailsQuery.refetch();
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Greška pri kreiranju izvlačenja.");
    }
  }

  async function onGenerateSelectedGeneration() {
    setGenerateError(null);
    setSwapSuccess(null);
    setScheduleSaved(null);
    if (!selectedGenerationYear) {
      setGenerateError("Nije odabrana generacija.");
      return;
    }
    try {
      await generateDraw.mutateAsync({ ...currentConfig, generationYear: selectedGenerationYear });
      setScheduleDaysDraft([]);
      await competitionDetailsQuery.refetch();
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Greška pri kreiranju izvlačenja.");
    }
  }

  async function onResetSelectedGeneration() {
    setGenerateError(null);
    setSwapSuccess(null);
    setScheduleSaved(null);
    if (!selectedGenerationYear) {
      setGenerateError("Nije odabrana generacija.");
      return;
    }
    try {
      await resetDraw.mutateAsync({ generationYear: selectedGenerationYear });
      setScheduleDaysDraft([]);
      await Promise.all([drawQuery.refetch(), competitionDetailsQuery.refetch()]);
      setSwapSuccess(`Resetovan žrijeb za generaciju ${selectedGenerationYear}.`);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Greška pri resetu izvlačenja.");
    }
  }
  async function onResetAllDraw() {
    setGenerateError(null);
    setSwapSuccess(null);
    setScheduleSaved(null);
    setHideDiagnosticsAfterReset(true);
    try {
      await resetDraw.mutateAsync({});
      setScheduleDaysDraft([]);
      setSelectedGenerationYear(null);
      await Promise.all([drawQuery.refetch(), competitionDetailsQuery.refetch()]);
      setSwapSuccess("Resetovan kompletan žrijeb.");
    } catch (error) {
      setHideDiagnosticsAfterReset(false);
      setGenerateError(error instanceof Error ? error.message : "Greška pri resetu izvlačenja.");
    }
  }

  async function onResetAllDrawAndSchedule() {
    setGenerateError(null);
    setSwapSuccess(null);
    setScheduleSaved(null);
    setHideDiagnosticsAfterReset(true);
    try {
      await resetDraw.mutateAsync({ resetSchedule: true });
      setScheduleDaysDraft([]);
      setSelectedGenerationYear(null);
      await Promise.all([drawQuery.refetch(), competitionDetailsQuery.refetch()]);
      setSwapSuccess("Resetovan kompletan žrijeb i dani/satnica.");
    } catch (error) {
      setHideDiagnosticsAfterReset(false);
      setGenerateError(error instanceof Error ? error.message : "Greška pri resetu izvlačenja.");
    }
  }

  async function onSwapTeams() {
    setGenerateError(null);
    setSwapSuccess(null);
    if (!selectedGenerationYear) {
      setGenerateError("Nije odabrana generacija.");
      return;
    }
    if (!swapFirstTeamId || !swapSecondTeamId) {
      setGenerateError("Odaberi obje ekipe za switch.");
      return;
    }
    if (swapFirstTeamId === swapSecondTeamId) {
      setGenerateError("Odaberi dvije različite ekipe.");
      return;
    }
    try {
      await swapDrawTeams.mutateAsync({
        generationYear: selectedGenerationYear,
        firstTeamId: swapFirstTeamId,
        secondTeamId: swapSecondTeamId,
      });
      setSwapSuccess("Zamjena ekipa je sačuvana i raspored je ažuriran.");
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Greška pri zamjeni ekipa.");
    }
  }

  async function onSwapPitches() {
    setGenerateError(null);
    setSwapSuccess(null);
    if (!selectedGenerationYear) {
      setGenerateError("Nije odabrana generacija.");
      return;
    }
    if (!swapFirstPitchName || !swapSecondPitchName) {
      setGenerateError("Odaberi oba terena za switch.");
      return;
    }
    if (swapFirstPitchName === swapSecondPitchName) {
      setGenerateError("Odaberi dva različita terena.");
      return;
    }
    try {
      await swapDrawPitches.mutateAsync({
        generationYear: selectedGenerationYear,
        firstPitchName: swapFirstPitchName,
        secondPitchName: swapSecondPitchName,
      });
      setSwapSuccess("Zamjena terena je sačuvana i raspored je ažuriran.");
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Greška pri zamjeni terena.");
    }
  }
  async function onSaveScheduleDays() {
    setGenerateError(null);
    setSwapSuccess(null);
    setScheduleSaved(null);
    try {
      const sourceDays =
        scheduleDaysDraft.length > 0
          ? scheduleDaysDraft
          : ((competitionDetailsQuery.data?.scheduleDays as ScheduleDayRow[] | null) ?? displayedScheduleDays);
      await updateCompetition.mutateAsync({
        scheduleDays: sourceDays.map((day) => ({
          dayLabel: day.dayLabel || day.dayDate || "Dan 1",
          dayDate: day.dayDate,
          generationLabel: day.generationLabel,
          stageScope: day.stageScope ?? "ALL",
          pitchId: day.pitchId ?? null,
          startTime: day.startTime,
          endTime: day.endTime,
        })),
      });
      setScheduleSaved("Dani i satnica su sačuvani.");
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Greška pri čuvanju dana i satnice.");
    }
  }

  const rounds = draw?.knockoutRounds ? [...draw.knockoutRounds].sort((a, b) => a.order - b.order) : [];
  const roundOf16 = rounds.find((round) => round.roundType === "ROUND_OF_16");
  const quarterfinals = rounds.find((round) => round.roundType === "QUARTERFINAL");
  const semifinals = rounds.find((round) => round.roundType === "SEMIFINAL");
  const finalRound = rounds.find((round) => round.roundType === "FINAL");
  const thirdPlaceRound = rounds.find((round) => round.roundType === "THIRD_PLACE");

  const groupsLeft = draw?.groups ? draw.groups.filter((_, index) => index % 2 === 0) : [];
  const groupsRight = draw?.groups ? draw.groups.filter((_, index) => index % 2 === 1) : [];
  const groupTeamOptions = (draw?.groups ?? []).flatMap((group) =>
    group.teams.map((entry) => ({
      teamId: entry.team.id,
      label: `Grupa ${group.name} - ${entry.team.name}`,
    }))
  );
  const pitchOptions = Array.from(
    new Set(
      [
        ...(draw?.groupMatches ?? []).map((match) => match.pitchName ?? "").filter(Boolean),
        ...rounds.flatMap((round) => round.matches.map((match) => match.pitchName ?? "").filter(Boolean)),
      ].map((value) => value.trim())
    )
  ).sort((a, b) => a.localeCompare(b));

  const r16Left = roundOf16?.matches?.slice(0, Math.ceil((roundOf16.matches.length ?? 0) / 2)) ?? [];
  const r16Right = roundOf16?.matches?.slice(Math.ceil((roundOf16.matches.length ?? 0) / 2)) ?? [];
  const qfLeft = quarterfinals?.matches?.slice(0, Math.ceil((quarterfinals.matches.length ?? 0) / 2)) ?? [];
  const qfRight = quarterfinals?.matches?.slice(Math.ceil((quarterfinals.matches.length ?? 0) / 2)) ?? [];
  const sfLeft = semifinals?.matches?.slice(0, 1) ?? [];
  const sfRight = semifinals?.matches?.slice(1) ?? [];
  const hasR16 = r16Left.length > 0 || r16Right.length > 0;
  const hasQF = qfLeft.length > 0 || qfRight.length > 0;
  const hasSF = sfLeft.length > 0 || sfRight.length > 0;
  const hasFinal = Boolean(finalRound?.matches?.length);

  const formatKickoff = (value: string) =>
    new Date(value).toLocaleString("sr-Latn-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const formatVenueDisplay = (venueLabel?: string | null, pitchName?: string | null) => {
    const separator = " - ";
    const normalizePitch = (value?: string | null) => {
      if (!value) return null;
      const parts = value.split(separator).map((part) => part.trim()).filter(Boolean);
      if (!parts.length) return null;
      const last = parts[parts.length - 1];
      if (/^teren\b/i.test(last)) return last;
      return value.trim();
    };

    if (venueLabel) {
      const parts = venueLabel.split(separator).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        if (/^teren\b/i.test(last)) return `${secondLast}${separator}${last}`;
      }
      return venueLabel.trim();
    }

    const normalizedPitch = normalizePitch(pitchName);
    return normalizedPitch ?? "Teren";
  };

  const sourceTeamNameMap = new Map<string, string>();
  for (const round of rounds) {
    const code =
      round.roundType === "ROUND_OF_16"
        ? "R16"
        : round.roundType === "QUARTERFINAL"
          ? "QF"
          : round.roundType === "SEMIFINAL"
            ? "SF"
            : round.roundType === "FINAL"
              ? "F"
              : round.roundType === "THIRD_PLACE"
                ? "TP"
                : null;
    if (!code) continue;
    for (const match of round.matches) {
      if (match.winnerTeam?.name) sourceTeamNameMap.set(`${code}-${match.order}`, match.winnerTeam.name);
      if (match.winnerTeam?.name && match.homeTeam?.name && match.awayTeam?.name) {
        const loserName = match.homeTeam.name === match.winnerTeam.name ? match.awayTeam.name : match.homeTeam.name;
        sourceTeamNameMap.set(`${code}-${match.order}-LOSER`, loserName);
      }
    }
  }

  const teamLabel = (match: DrawMatch) => ({
    home: {
      name: match.homeTeam?.name ?? sourceTeamNameMap.get(match.homeSourceValue) ?? match.homeSourceValue,
      imageUrl: match.homeTeam?.profileImageUrl ?? null,
    },
    away: {
      name: match.awayTeam?.name ?? sourceTeamNameMap.get(match.awaySourceValue) ?? match.awaySourceValue,
      imageUrl: match.awayTeam?.profileImageUrl ?? null,
    },
  });

  const renderMatchBox = (
    id: string,
    home: { name: string; imageUrl?: string | null },
    away: { name: string; imageUrl?: string | null }
  ) => (
    <div key={id} className="mx-auto w-full min-w-[118px] max-w-[142px] rounded-lg border px-1.5 py-1.5 text-[10px] shadow-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
      <p className="flex items-center gap-1 truncate"><TeamMark name={home.name} imageUrl={home.imageUrl} /><span>{home.name}</span></p>
      <p className="flex items-center gap-1 truncate"><TeamMark name={away.name} imageUrl={away.imageUrl} /><span>{away.name}</span></p>
    </div>
  );

  const renderGroupTable = (group: { id: string; name: string; teams: Array<{ team: DrawTeam }> }) => (
    <div key={group.id} className="rounded-xl border p-2 text-[11px]" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
      <p className="mb-1 text-sm font-semibold" style={{ color: "#9BEA3C" }}>GRUPA {group.name}</p>
      <div className="mb-1 grid grid-cols-[24px_1fr_20px_20px] gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
        <span>Poz</span><span>Tim</span><span>U</span><span>P</span>
      </div>
      <div className="space-y-1">
        {group.teams.map((entry, index) => (
          <div key={`${group.id}-${entry.team.name}`} className="grid grid-cols-[24px_1fr_20px_20px] gap-1">
            <span>{index + 1}</span>
            <span className="flex items-center gap-1 truncate"><TeamMark name={entry.team.name} imageUrl={entry.team.profileImageUrl} /><span className="truncate">{entry.team.name}</span></span>
            <span>0</span><span>0</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRoundList = (title: string, matches: DrawMatch[]) => (
    <details className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
      <summary className="cursor-pointer text-sm font-semibold" style={{ color: "#9BEA3C" }}>{title} ({matches.length})</summary>
      <div className="mt-3 space-y-2">
        {matches.map((match, index) => {
          const labels = teamLabel(match);
          return (
            <div key={match.id} className="rounded-md border p-2 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <p className="mb-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>Utakmica {index + 1}</p>
              <p className="flex items-center gap-1 truncate"><TeamMark name={labels.home.name} imageUrl={labels.home.imageUrl} />{labels.home.name}</p>
              <p className="flex items-center gap-1 truncate"><TeamMark name={labels.away.name} imageUrl={labels.away.imageUrl} />{labels.away.name}</p>
            </div>
          );
        })}
      </div>
    </details>
  );

  const renderColumn = (matches: DrawMatch[], title: string, gapClass: string) => (
    <div className="w-[144px] shrink-0">
      <p className="mb-2 text-xs font-semibold md:text-sm" style={{ color: "#9BEA3C" }}>{title}</p>
      <div className={gapClass}>
        {matches.map((match) => {
          const labels = teamLabel(match);
          return <div key={match.id} className="flex items-center justify-center gap-2">{renderMatchBox(match.id, labels.home, labels.away)}</div>;
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title={`Izvlacenje - ${competition.name}`} description={`Season: ${competition.seasonLabel ?? "N/A"} - Participants: ${competition.participants.length} - Match duration: ${competition.matchDurationMinutes} min`} />
      {competitionDetailsQuery.data?.seasonOptions?.length ? (
        <Card className="p-3">
          <div className="max-w-xs">
            <FormField label="Sezona">
              <Select value={competitionDetailsQuery.data.id} onChange={(event) => router.push(`/draws/${event.currentTarget.value}`)}>
                {competitionDetailsQuery.data.seasonOptions.map((option) => (
                  <option key={option.competitionId} value={option.competitionId}>
                    {option.seasonLabel ?? "No season"}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>
      ) : null}
      {isDrawLocked ? (
        <Card className="p-3 text-sm" style={{ color: "var(--warning)" }}>
          Turnir je završen. Podešavanja žrijeba su zaključana za ovu sezonu.
        </Card>
      ) : null}

      <Card className="space-y-3 p-5">
        <h3 className="text-lg font-semibold">Participants</h3>
        <div className="max-w-xs">
          <FormField label="Generacija">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!generationYears.length || selectedGenerationYear == null || generationYears.indexOf(selectedGenerationYear) <= 0}
                  onClick={() => {
                    if (selectedGenerationYear == null) return;
                    const idx = generationYears.indexOf(selectedGenerationYear);
                    if (idx > 0) setSelectedGenerationYear(generationYears[idx - 1]);
                  }}
                >
                  {"<"}
                </Button>
                <Select
                  value={selectedGenerationYear ? String(selectedGenerationYear) : ""}
                  onChange={(event) => setSelectedGenerationYear(Number(event.currentTarget.value))}
                >
                  {generationYears.map((year) => (
                    <option key={year} value={year}>
                      Generacija {year}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!generationYears.length || selectedGenerationYear == null || generationYears.indexOf(selectedGenerationYear) >= generationYears.length - 1}
                  onClick={() => {
                    if (selectedGenerationYear == null) return;
                    const idx = generationYears.indexOf(selectedGenerationYear);
                    if (idx >= 0 && idx < generationYears.length - 1) setSelectedGenerationYear(generationYears[idx + 1]);
                  }}
                >
                  {">"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {generationYears.map((year) => {
                  const active = selectedGenerationYear === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setSelectedGenerationYear(year)}
                      className="rounded-full border px-2.5 py-1 text-xs"
                      style={{
                        borderColor: active ? "#9BEA3C" : "var(--border)",
                        color: active ? "#9BEA3C" : "var(--text-secondary)",
                        backgroundColor: active ? "color-mix(in srgb, #9BEA3C 15%, var(--surface-2))" : "transparent",
                      }}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          {competition.participants.map((team) => (
            <span key={team.id} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
              <span className="mr-1 inline-flex align-middle"><TeamMark name={team.name} imageUrl={team.profileImageUrl} /></span>{team.name}
            </span>
          ))}
        </div>
      </Card>

      {!isTournament ? <Card className="p-5 text-sm" style={{ color: "var(--text-secondary)" }}>League competitions do not use draw, groups, or knockout phases. Ranking is determined by league standings and points.</Card> : null}

      {isTournament ? (
        <div
          style={{
            opacity: isGenerationSwitching ? 0.35 : 1,
            transform: isGenerationSwitching ? "translateX(8px)" : "translateX(0)",
            pointerEvents: canManage ? "auto" : "none",
            transition: "opacity 220ms ease, transform 220ms ease",
          }}
        >
          <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold">Draw Configuration</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Group Stage" tooltip="Enable random group-stage draw before knockout.">
                <Select value={currentConfig.groupStageEnabled ? "yes" : "no"} onChange={(event) => setDraftConfig((current) => ({ ...current, groupStageEnabled: event.target.value === "yes" }))} disabled={!canManage}>
                  <option value="yes">Enabled</option><option value="no">Disabled</option>
                </Select>
              </FormField>
              <FormField label="Groups Count" tooltip="Number of groups when group stage is enabled." readOnly={!currentConfig.groupStageEnabled || !canManage}>
                <Input type="number" min={1} max={32} value={currentConfig.groupsCount} onChange={(event) => setDraftConfig((current) => ({ ...current, groupsCount: Number(event.target.value) }))} readOnly={!currentConfig.groupStageEnabled || !canManage} />
              </FormField>
              <FormField label="Knockout Starts" tooltip="Choose if knockout starts from Round of 16 or Quarterfinals.">
                <Select value={currentConfig.roundOf16Enabled ? "r16" : "qf"} onChange={(event) => setDraftConfig((current) => ({ ...current, roundOf16Enabled: event.target.value === "r16", quarterfinalsEnabled: true }))} disabled={!canManage}>
                  <option value="r16">Round of 16</option><option value="qf">Quarterfinal</option>
                </Select>
              </FormField>
              <FormField label="Third Place Match" tooltip="Enable optional match for 3rd place." readOnly={!canManage}>
                <Select value={currentConfig.thirdPlaceMatchEnabled ? "yes" : "no"} onChange={(event) => setDraftConfig((current) => ({ ...current, thirdPlaceMatchEnabled: event.target.value === "yes" }))} disabled={!canManage}>
                  <option value="yes">Enabled</option><option value="no">Disabled</option>
                </Select>
              </FormField>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {canManage ? (
                <>
                  <Button
                    variant="danger"
                    onClick={() => void onResetSelectedGeneration()}
                    disabled={resetDraw.isPending || !selectedGenerationYear}
                  >
                    {resetDraw.isPending ? "Resetting..." : `Reset draw (${selectedGenerationYear ?? "-"})`}
                  </Button>
                  <Button variant="danger" onClick={() => void onResetAllDraw()} disabled={resetDraw.isPending}>{resetDraw.isPending ? "Resetting..." : "Reset Draw (sve)"}</Button>
                  <Button variant="danger" onClick={() => void onResetAllDrawAndSchedule()} disabled={resetDraw.isPending}>
                    {resetDraw.isPending ? "Resetting..." : "Reset Draw + satnica"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void onGenerateSelectedGeneration()}
                    disabled={generateDraw.isPending || !selectedGenerationYear}
                  >
                    {generateDraw.isPending
                      ? "Generating..."
                      : `Kreiraj zrijeb (${selectedGenerationYear ?? "-"})`}
                  </Button>
                  <Button variant="primary" onClick={() => void onGenerate()} disabled={generateDraw.isPending || generationYears.length === 0}>{generateDraw.isPending ? "Generating..." : "Kreiraj zrijeb (sve generacije)"}</Button>
                </>
              ) : <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Read-only access.</p>}
            </div>
            {generateError ? (
              <div
                className="rounded-lg border p-3 text-sm transition-opacity duration-300"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", opacity: generateErrorVisible ? 1 : 0 }}
              >
                {generateError}
              </div>
            ) : null}
            {!generateError && generationYears.length && !hideDiagnosticsAfterReset ? (
              <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <p className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Dijagnostika prije kreiranja zrijeba
                </p>
                <div className="space-y-1">
                  {autoDrawDiagnostics.map((item) => (
                    <p key={`diag-${item.year}`}>
                      {item.label}: grupni slotovi {item.groupSlots}, knockout slotovi {item.knockoutSlots}, tereni:{" "}
                      {item.pitchLabels.join(" | ")}
                      {item.missingReason ? ` | razlog: ${item.missingReason}` : ""}
                      {item.missingReason && item.nearestMismatches.length
                        ? ` | najbliži tereni: ${item.nearestMismatches.join(" | ")}`
                        : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {swapSuccess ? (
              <div
                className="rounded-lg border p-3 text-sm transition-opacity duration-300"
                style={{ borderColor: "var(--primary)", color: "var(--primary)", opacity: swapSuccessVisible ? 1 : 0 }}
              >
                {swapSuccess}
              </div>
            ) : null}
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">Dani i satnica</h3>
            <div className="space-y-2">
              {displayedScheduleDays.map((day, index) => (
                <div key={`${index}-${day.dayDate}-${day.generationLabel}-${day.stageScope ?? "ALL"}`} className="grid gap-2 md:grid-cols-[1fr_220px_160px_1fr_130px_130px_auto]">
                  <Input
                    type="date"
                    value={day.dayDate}
                    onChange={(event) => {
                      const next = [...displayedScheduleDays];
                      next[index] = { ...next[index], dayDate: event.currentTarget.value, dayLabel: event.currentTarget.value };
                      setScheduleDaysDraft(next);
                    }}
                  />
                    <Select
                      value={day.generationLabel}
                      onChange={(event) => {
                        const generationLabel = event.currentTarget.value;
                        const next = [...displayedScheduleDays];
                        if (generationLabel === ALL_GENERATIONS_LABEL) {
                          const row = next[index];
                          const expanded = GENERATION_LABELS.map((label) => {
                            const compatiblePitch =
                              eligiblePitchOptions.find((pitch) => pitch.generationLabel === label) ?? eligiblePitchOptions[0];
                            return {
                              ...row,
                              generationLabel: label,
                              pitchId: compatiblePitch?.id ?? row.pitchId ?? null,
                            };
                          });
                          next.splice(index, 1, ...expanded);
                          setScheduleDaysDraft(next);
                          return;
                        }
                        const compatiblePitch =
                          eligiblePitchOptions.find((pitch) => pitch.generationLabel === generationLabel) ?? eligiblePitchOptions[0];
                        next[index] = { ...next[index], generationLabel, pitchId: compatiblePitch?.id ?? next[index].pitchId ?? null };
                        setScheduleDaysDraft(next);
                      }}
                    >
                    {scheduleGenerationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={day.stageScope ?? "ALL"}
                    onChange={(event) => {
                      const next = [...displayedScheduleDays];
                      next[index] = {
                        ...next[index],
                        stageScope: event.currentTarget.value as "ALL" | "GROUP_STAGE" | "KNOCKOUT",
                      };
                      setScheduleDaysDraft(next);
                    }}
                  >
                    <option value="ALL">Sve faze</option>
                    <option value="GROUP_STAGE">Grupna faza</option>
                    <option value="KNOCKOUT">Knockout</option>
                  </Select>
                  <Select
                    value={day.pitchId ?? ""}
                    onChange={(event) => {
                      const next = [...displayedScheduleDays];
                      next[index] = { ...next[index], pitchId: event.currentTarget.value || null };
                      setScheduleDaysDraft(next);
                    }}
                  >
                    <option value="">
                      Automatski (svi selektovani tereni turnira)
                    </option>
                      {eligiblePitchOptions
                      .slice()
                      .sort((a, b) => {
                        const aMatch = a.generationLabel === day.generationLabel ? 0 : 1;
                        const bMatch = b.generationLabel === day.generationLabel ? 0 : 1;
                        if (aMatch !== bMatch) return aMatch - bMatch;
                        return a.label.localeCompare(b.label);
                      })
                      .map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>
                          {pitch.label}
                        </option>
                      ))}
                  </Select>
                  {day.generationLabel === ALL_GENERATIONS_LABEL && (day.stageScope ?? "ALL") === "ALL" ? (
                    <span
                      className="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                    >
                      AUTO
                    </span>
                  ) : null}
                  <Input
                    type="time"
                    value={day.startTime}
                    onChange={(event) => {
                      const next = [...displayedScheduleDays];
                      next[index] = { ...next[index], startTime: event.currentTarget.value };
                      setScheduleDaysDraft(next);
                    }}
                  />
                  <Input
                    type="time"
                    value={day.endTime}
                    onChange={(event) => {
                      const next = [...displayedScheduleDays];
                      next[index] = { ...next[index], endTime: event.currentTarget.value };
                      setScheduleDaysDraft(next);
                    }}
                  />
                  {displayedScheduleDays.length > 1 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const next = displayedScheduleDays.filter((_, itemIndex) => itemIndex !== index);
                        setScheduleDaysDraft(
                          next.length
                            ? next
                            : [
                                {
                                  dayLabel: "Dan 1",
                                  dayDate: defaultTournamentDay,
                                  generationLabel: ALL_GENERATIONS_LABEL,
                                  stageScope: "ALL",
                                  pitchId: null,
                                  startTime: "09:00",
                                  endTime: "19:00",
                                },
                              ]
                        );
                      }}
                    >
                      -
                    </Button>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    setScheduleDaysDraft([
                      ...displayedScheduleDays,
                      {
                        dayLabel: `Dan ${displayedScheduleDays.length + 1}`,
                        dayDate: defaultTournamentDay,
                        generationLabel: ALL_GENERATIONS_LABEL,
                        stageScope: "ALL",
                        pitchId: null,
                        startTime: "09:00",
                        endTime: "19:00",
                      },
                    ])
                  }
                >
                  Dodaj dan
                </Button>
                <Button type="button" variant="primary" onClick={() => void onSaveScheduleDays()} disabled={updateCompetition.isPending}>
                  {updateCompetition.isPending ? "Čuvanje..." : "Sačuvaj dane i satnicu"}
                </Button>
              </div>
            </div>
            {scheduleSaved ? (
              <div
                className="rounded-lg border p-3 text-sm transition-opacity duration-300"
                style={{ borderColor: "var(--primary)", color: "var(--primary)", opacity: scheduleSavedVisible ? 1 : 0 }}
              >
                {scheduleSaved}
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">Groups</h3>
            {canManage && draw?.groups.length ? (
              <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Select value={swapFirstTeamId} onChange={(event) => setSwapFirstTeamId(event.currentTarget.value)}>
                    <option value="">Odaberi prvu ekipu</option>
                    {groupTeamOptions.map((item) => (
                      <option key={`first-${item.teamId}`} value={item.teamId}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                  <Select value={swapSecondTeamId} onChange={(event) => setSwapSecondTeamId(event.currentTarget.value)}>
                    <option value="">Odaberi drugu ekipu</option>
                    {groupTeamOptions
                      .filter((item) => item.teamId !== swapFirstTeamId)
                      .map((item) => (
                        <option key={`second-${item.teamId}`} value={item.teamId}>
                          {item.label}
                        </option>
                      ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onSwapTeams()}
                    disabled={swapDrawTeams.isPending || !swapFirstTeamId || !swapSecondTeamId}
                  >
                    {swapDrawTeams.isPending ? "Switch..." : "Switch ekipa"}
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Select value={swapFirstPitchName} onChange={(event) => setSwapFirstPitchName(event.currentTarget.value)}>
                    <option value="">Odaberi prvi teren</option>
                    {pitchOptions.map((pitch) => (
                      <option key={`pitch-first-${pitch}`} value={pitch}>
                        {pitch}
                      </option>
                    ))}
                  </Select>
                  <Select value={swapSecondPitchName} onChange={(event) => setSwapSecondPitchName(event.currentTarget.value)}>
                    <option value="">Odaberi drugi teren</option>
                    {pitchOptions
                      .filter((pitch) => pitch !== swapFirstPitchName)
                      .map((pitch) => (
                        <option key={`pitch-second-${pitch}`} value={pitch}>
                          {pitch}
                        </option>
                      ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onSwapPitches()}
                    disabled={swapDrawPitches.isPending || !swapFirstPitchName || !swapSecondPitchName}
                  >
                    {swapDrawPitches.isPending ? "Switch..." : "Switch terena"}
                  </Button>
                </div>
              </div>
            ) : null}
            {draw?.groups.length ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid min-w-[280px] flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {draw.groups.map((group) => (
                    <div key={group.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                      <p className="mb-2 font-semibold">Group {group.name}</p>
                      <div className="space-y-1 text-sm">
                        {group.teams.map((entry) => (
                          <p key={entry.id} className="flex items-center gap-1">{entry.position ? `${entry.position}. ` : ""}<TeamMark name={entry.team.name} imageUrl={entry.team.profileImageUrl} /><span>{entry.team.name}</span></p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="w-full min-w-[280px] max-w-[380px] rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  <p className="mb-2 font-semibold">Parovi i raspored</p>
                  <div className="max-h-[360px] space-y-2 overflow-auto text-xs">
                    {(draw.groupMatches ?? []).map((match, index) => (
                      <div key={match.id} className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                        <p style={{ color: "var(--text-secondary)" }}>#{index + 1} · {match.round ?? "Group Stage"}</p>
                        <p className="flex items-center gap-1 truncate"><TeamMark name={match.homeTeam.name} imageUrl={match.homeTeam.profileImageUrl} />{match.homeTeam.name}</p>
                        <p className="flex items-center gap-1 truncate"><TeamMark name={match.awayTeam.name} imageUrl={match.awayTeam.profileImageUrl} />{match.awayTeam.name}</p>
                        <p style={{ color: "var(--text-secondary)" }}>{formatKickoff(match.scheduledAt)}</p>
                        <p style={{ color: "var(--text-secondary)" }}>{formatVenueDisplay(match.venueLabel, match.pitchName)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="mb-2 font-semibold">Knockout faza</p>
                    <div className="max-h-[300px] space-y-2 overflow-auto text-xs">
                      {rounds.map((round) => (
                        <div key={round.id} className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                          <p className="mb-1 text-[11px] font-semibold" style={{ color: "#9BEA3C" }}>
                            {round.roundType === "ROUND_OF_16"
                              ? "1/8 FINALA"
                              : round.roundType === "QUARTERFINAL"
                                ? "1/4 FINALA"
                                : round.roundType === "SEMIFINAL"
                                  ? "1/2 FINALA"
                                  : round.roundType === "FINAL"
                                    ? "FINALE"
                                    : "UTAKMICA ZA 3. MJESTO"}
                          </p>
                          <div className="space-y-1">
                            {round.matches.map((match, idx) => {
                              const labels = teamLabel(match);
                              return (
                                <div key={match.id} className="rounded-md border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                                  <p style={{ color: "var(--text-secondary)" }}>Utakmica {idx + 1}</p>
                                  <p className="flex items-center gap-1 truncate"><TeamMark name={labels.home.name} imageUrl={labels.home.imageUrl} />{labels.home.name}</p>
                                  <p className="flex items-center gap-1 truncate"><TeamMark name={labels.away.name} imageUrl={labels.away.imageUrl} />{labels.away.name}</p>
                                  {match.scheduledAt ? <p style={{ color: "var(--text-secondary)" }}>{formatKickoff(match.scheduledAt)}</p> : null}
                                  <p style={{ color: "var(--text-secondary)" }}>{formatVenueDisplay(match.venueLabel, match.pitchName)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {!rounds.length ? (
                        <p style={{ color: "var(--text-secondary)" }}>Knockout faza jos nije kreirana.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No groups generated yet.</p>}
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">Knockout Bracket</h3>
            {draw?.knockoutRounds.length ? (
              <>
                <div className="space-y-3 lg:hidden">
                  <details className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                    <summary className="cursor-pointer text-sm font-semibold" style={{ color: "#9BEA3C" }}>Grupna faza ({draw?.groups.length ?? 0} grupa)</summary>
                    <div className="mt-3 grid gap-2">{draw?.groups.map((group) => <div key={group.id} className="rounded-md border p-2 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}><p className="mb-1 font-semibold" style={{ color: "#9BEA3C" }}>GRUPA {group.name}</p><div className="space-y-1">{group.teams.map((entry, idx) => <p key={entry.id} className="truncate">{idx + 1}. {entry.team.name}</p>)}</div></div>)}</div>
                  </details>
                  {hasR16 ? renderRoundList("1/8 FINALA", [...r16Left, ...r16Right]) : null}
                  {hasQF ? renderRoundList("1/4 FINALA", [...qfLeft, ...qfRight]) : null}
                  {hasSF ? renderRoundList("1/2 FINALA", [...sfLeft, ...sfRight]) : null}
                  {hasFinal && finalRound?.matches?.[0] ? renderRoundList("FINALE", [finalRound.matches[0]]) : null}
                  {thirdPlaceRound?.matches?.[0] ? renderRoundList("UTAKMICA ZA 3. MJESTO", [thirdPlaceRound.matches[0]]) : null}
                </div>

                <div className="hidden w-full overflow-hidden lg:block">
                  <div className="mx-auto w-full max-w-full rounded-2xl border p-3 md:p-4" style={{ borderColor: "var(--border)", background: "radial-gradient(circle at 50% 30%, color-mix(in srgb,var(--surface-2) 60%, #021018) 0%, #050d17 52%, #030913 100%)" }}>
                    <div className="mb-4 text-center">
                      <p className="text-2xl md:text-3xl">⚽</p>
                      <p className="text-2xl font-extrabold tracking-wide text-white md:text-3xl">LIVE <span style={{ color: "#9BEA3C" }}>PITCH</span></p>
                      <p className="text-xs tracking-[0.22em]" style={{ color: "var(--text-secondary)" }}>TOURNAMENT BRACKET</p>
                    </div>
                    <div className="flex w-full min-w-[860px] items-start justify-between gap-1.5 overflow-x-auto pb-2">
                      <div className="w-[165px] shrink-0 space-y-2.5">{groupsLeft.map(renderGroupTable)}</div>
                      {hasR16 ? renderColumn(r16Left, "1/8 FINALA", "space-y-4") : null}
                      {hasQF ? renderColumn(qfLeft, "1/4 FINALA", "space-y-12 pt-8") : null}
                      {hasSF ? renderColumn(sfLeft, "1/2 FINALA", "space-y-24 pt-20") : null}
                      <div className="w-[165px] shrink-0 space-y-5 pt-8 text-center">
                        {hasFinal ? <div><p className="mb-2 text-3xl">🏆</p><p className="mb-2 text-xl font-semibold" style={{ color: "#9BEA3C" }}>FINALE</p>{renderMatchBox(finalRound!.matches[0].id, teamLabel(finalRound!.matches[0]).home, teamLabel(finalRound!.matches[0]).away)}</div> : null}
                        {thirdPlaceRound?.matches?.[0] ? <div className="pt-8 text-left"><p className="mb-2 text-sm font-semibold" style={{ color: "#9BEA3C" }}>UTAKMICA ZA 3. MJESTO</p>{renderMatchBox(thirdPlaceRound.matches[0].id, teamLabel(thirdPlaceRound.matches[0]).home, teamLabel(thirdPlaceRound.matches[0]).away)}<p className="mt-2 text-center text-2xl">🥉</p></div> : null}
                      </div>
                      {hasSF ? renderColumn(sfRight, "1/2 FINALA", "space-y-24 pt-20") : null}
                      {hasQF ? renderColumn(qfRight, "1/4 FINALA", "space-y-12 pt-8") : null}
                      {hasR16 ? renderColumn(r16Right, "1/8 FINALA", "space-y-4") : null}
                      <div className="w-[165px] shrink-0 space-y-2.5">{groupsRight.map(renderGroupTable)}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No knockout structure generated yet.</p>}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
