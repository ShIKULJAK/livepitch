"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CompetitionStatus, CompetitionType, SportType } from "@prisma/client";
import {
  useApproveTeamApplication,
  useCompetition,
  useCompetitionGenerationParticipants,
  useRejectTeamApplication,
  useSeasonSquads,
  useTeamApplications,
  useTeams,
  useUpdateCompetition,
  useUpdateSeasonSquad,
  useVenues,
} from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { GENERATION_LABELS } from "@/lib/constants/generation-presets";
import { canCreateCompetitions } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toIsoDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;
}

type StadiumBlock = { stadiumName: string; pitchNames: string[] };
const STADIUM_PITCH_SEPARATOR = " - ";
const ALL_GENERATIONS_LABEL = "Sve generacije";

function parsePitchEntry(rawPitch: string, fallbackStadium: string) {
  const value = rawPitch.trim();
  if (!value) return null;

  const segments = value.split(STADIUM_PITCH_SEPARATOR).map((segment) => segment.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];
    if (/^teren\b/i.test(last)) {
      return { stadiumName: secondLast, pitchName: last };
    }
  }

  return { stadiumName: fallbackStadium, pitchName: value };
}

function normalizePitchNameForStorage(rawPitch: string, fallbackPitchName: string) {
  const value = rawPitch.trim();
  if (!value) return fallbackPitchName;
  const segments = value.split(STADIUM_PITCH_SEPARATOR).map((segment) => segment.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    if (/^teren\b/i.test(last)) return last;
  }
  return value;
}

function decodeStadiumBlocks(stadiumName?: string | null, pitchNames?: string[] | null): StadiumBlock[] {
  const blocksMap = new Map<string, string[]>();
  const fallbackStadium = stadiumName || "Stadion 1";
  const rawPitches = pitchNames?.length ? pitchNames : ["Teren 1"];

  for (const rawPitch of rawPitches) {
    const parsed = parsePitchEntry(rawPitch, fallbackStadium);
    if (!parsed) continue;
    if (!blocksMap.has(parsed.stadiumName)) blocksMap.set(parsed.stadiumName, []);
    blocksMap.get(parsed.stadiumName)!.push(parsed.pitchName);
  }

  if (!blocksMap.size) return [{ stadiumName: fallbackStadium, pitchNames: ["Teren 1"] }];
  return Array.from(blocksMap.entries()).map(([name, pitches]) => ({
    stadiumName: name,
    pitchNames: Array.from(new Set(pitches.filter((pitch) => pitch.trim().length > 0))),
  }));
}

function encodeStadiumBlocks(blocks: StadiumBlock[]) {
  const normalizedBlocks = blocks
    .map((block, blockIndex) => ({
      stadiumName: block.stadiumName || `Stadion ${blockIndex + 1}`,
      pitchNames: block.pitchNames.map((pitch, pitchIndex) => normalizePitchNameForStorage(pitch, `Teren ${pitchIndex + 1}`)),
    }))
    .filter((block) => block.pitchNames.length > 0);

  const fallback = normalizedBlocks[0]?.stadiumName ?? "Stadion 1";
  const flattenedPitches = normalizedBlocks.flatMap((block) =>
    block.pitchNames.map((pitch) => `${block.stadiumName}${STADIUM_PITCH_SEPARATOR}${pitch}`)
  );

  return {
    stadiumName: fallback,
    pitchNames: flattenedPitches.length ? flattenedPitches : [`${fallback}${STADIUM_PITCH_SEPARATOR}Teren 1`],
  };
}

export default function EditCompetitionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const competitionQuery = useCompetition(params.id);
  const teamsQuery = useTeams();
  const venuesQuery = useVenues();
  const seasonSquadsQuery = useSeasonSquads(params.id);
  const updateSeasonSquad = useUpdateSeasonSquad(params.id);
  const updateCompetition = useUpdateCompetition(params.id);
  const applicationsQuery = useTeamApplications(params.id);
  const approveApplication = useApproveTeamApplication(params.id);
  const rejectApplication = useRejectTeamApplication(params.id);
  const generationParticipantsQuery = useCompetitionGenerationParticipants(params.id);
  const [teamSearch, setTeamSearch] = useState("");
  const [applicationsSeasonCompetitionId, setApplicationsSeasonCompetitionId] = useState<string>(params.id);
  const [approvalDraft, setApprovalDraft] = useState<Record<string, number[]>>({});
  const [selectedSeasonTeamId, setSelectedSeasonTeamId] = useState<string | null>(null);
  const [squadDraft, setSquadDraft] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<{
    name?: string;
    type?: CompetitionType;
    sport?: SportType;
    seasonLabel?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    registrationDeadline?: string;
    matchDurationMinutes?: string;
    generationMatchDurations?: Array<{ generationLabel: string; matchDurationMinutes: number }>;
    teamCount?: string;
    maxTeams?: string;
    teamSize?: string;
    substitutions?: string;
    format?: string;
    visibility?: string;
    status?: CompetitionStatus;
    entryFee?: string;
    description?: string;
    notes?: string;
    participantTeamIds?: string[];
    stadiumName?: string;
    pitchNames?: string[];
    scheduleDays?: Array<{ dayLabel: string; dayDate: string; generationLabel: string; stageScope?: "ALL" | "GROUP_STAGE" | "KNOCKOUT"; pitchId?: string | null; startTime: string; endTime: string }>;
  }>({});
  const generationOptions = GENERATION_LABELS;
  const scheduleGenerationOptions = [ALL_GENERATIONS_LABEL, ...GENERATION_LABELS];

  const canEditByRole = canCreateCompetitions(user?.role);
  const competition = competitionQuery.data;
  const canEdit = canEditByRole && Boolean(competition?.canEdit);
  const participantTeamIds = draft.participantTeamIds ?? competition?.teams.map((entry) => entry.teamId) ?? [];
  const selectedSport = draft.sport ?? competition?.sport ?? SportType.FOOTBALL;
  const pitchNames = draft.pitchNames ?? competition?.pitchNames ?? ["Teren 1"];
  const generationMatchDurations = draft.generationMatchDurations ?? competition?.generationMatchDurations ?? [];
  const stadiumBlocks = decodeStadiumBlocks(draft.stadiumName ?? competition?.stadiumName, pitchNames);
  const scheduleDays = (
    draft.scheduleDays ??
    (competition?.scheduleDays as Array<{ dayLabel: string; dayDate?: string; generationLabel: string; stageScope?: "ALL" | "GROUP_STAGE" | "KNOCKOUT"; pitchId?: string | null; startTime: string; endTime: string }> | null) ??
    [{ dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), generationLabel: ALL_GENERATIONS_LABEL, stageScope: "ALL", pitchId: null, startTime: "09:00", endTime: "19:00" }]
  ).map((day) => ({
    ...day,
    dayDate: day.dayDate ?? new Date().toISOString().slice(0, 10),
    dayLabel: day.dayLabel || day.dayDate || "Dan 1",
    stageScope: day.stageScope ?? "ALL",
  }));
  const pitchOptions = useMemo(
    () =>
      (venuesQuery.data ?? []).flatMap((venue) =>
        venue.pitches.map((pitch) => ({
          id: pitch.id,
          generationLabel: pitch.generationLabel,
          label: `${venue.name} - ${pitch.name} (${pitch.fieldLengthMeters}x${pitch.fieldWidthMeters} m, ${pitch.playerFormat})`,
        }))
      ),
    [venuesQuery.data]
  );

  const availableTeams = useMemo(
    () =>
      (teamsQuery.data ?? []).filter((team) => team.sport === selectedSport && team.name.toLowerCase().includes(teamSearch.toLowerCase())),
    [teamsQuery.data, selectedSport, teamSearch]
  );
  const seasonTeams = seasonSquadsQuery.data?.teams ?? [];
  const seasonApplications = (applicationsQuery.data?.applications ?? []).filter(
    (item) => item.competitionId === applicationsSeasonCompetitionId
  );
  const activeSeasonTeamId = selectedSeasonTeamId ?? seasonTeams[0]?.teamId ?? null;
  const activeSeasonTeam = seasonTeams.find((team) => team.teamId === activeSeasonTeamId) ?? null;
  const activeRegistered = activeSeasonTeam
    ? squadDraft[activeSeasonTeam.teamId] ?? activeSeasonTeam.registeredPlayerIds
    : [];

  function toggleParticipant(teamId: string) {
    const next = participantTeamIds.includes(teamId)
      ? participantTeamIds.filter((id) => id !== teamId)
      : [...participantTeamIds, teamId];
    setDraft((current) => ({ ...current, participantTeamIds: next }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competition) return;

    await updateCompetition.mutateAsync({
      name: draft.name ?? competition.name,
      seasonLabel: draft.seasonLabel ?? competition.season?.name ?? "",
      type: draft.type ?? competition.type,
      sport: selectedSport,
      location: (draft.location ?? competition.location ?? "") || null,
      startDate: toIsoDate(draft.startDate ?? toDateInput(competition.startDate)),
      endDate: toIsoDate(draft.endDate ?? toDateInput(competition.endDate)),
      registrationDeadline: toIsoDate(draft.registrationDeadline ?? toDateInput(competition.registrationDeadline)),
      matchDurationMinutes: Number(draft.matchDurationMinutes ?? String(competition.matchDurationMinutes)),
      generationMatchDurations,
      stadiumName: draft.stadiumName ?? competition.stadiumName ?? "",
      pitchNames: pitchNames.length ? pitchNames : ["Teren 1"],
      scheduleDays: scheduleDays.map((day) => ({
        ...day,
        dayDate: day.dayDate ?? new Date().toISOString().slice(0, 10),
        dayLabel: day.dayLabel || day.dayDate || "Dan 1",
        stageScope: day.stageScope ?? "ALL",
      })),
      teamCount: Number(draft.teamCount ?? (competition.teamCount ? String(competition.teamCount) : "0")) || null,
      maxTeams: Number(draft.maxTeams ?? (competition.maxTeams ? String(competition.maxTeams) : "0")) || null,
      teamSize: Number(draft.teamSize ?? (competition.teamSize ? String(competition.teamSize) : "0")) || null,
      substitutions: Number(draft.substitutions ?? (competition.substitutions ? String(competition.substitutions) : "0")) || null,
      format: (draft.format ?? competition.format ?? "") || null,
      visibility: draft.visibility ?? competition.visibility ?? "public",
      status: draft.status ?? competition.status,
      entryFee: Number(draft.entryFee ?? (competition.entryFee ? String(competition.entryFee) : "0")) || null,
      description: (draft.description ?? competition.description ?? "") || null,
      notes: (draft.notes ?? competition.notes ?? "") || null,
      participantTeamIds,
    });
    router.push("/tournaments");
  }

  if (!canEdit) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You can only edit competitions that you created.
      </Card>
    );
  }

  function toggleApprovalGeneration(applicationId: string, generationYear: number) {
    setApprovalDraft((current) => {
      const selected = current[applicationId] ?? [];
      const next = selected.includes(generationYear)
        ? selected.filter((year) => year !== generationYear)
        : [...selected, generationYear].sort((a, b) => b - a);
      return { ...current, [applicationId]: next };
    });
  }

  async function approveApplicationByGenerations(applicationId: string, fallbackYears: number[]) {
    const years = approvalDraft[applicationId] ?? fallbackYears;
    if (!years.length) return;
    await approveApplication.mutateAsync({ applicationId, approvedGenerationYears: years });
  }

  function setStadiumBlocks(next: StadiumBlock[]) {
    const encoded = encodeStadiumBlocks(next);
    setDraft((current) => ({ ...current, stadiumName: encoded.stadiumName, pitchNames: encoded.pitchNames }));
  }

  function toggleSeasonPlayer(playerId: string) {
    if (!activeSeasonTeam) return;
    const current = squadDraft[activeSeasonTeam.teamId] ?? activeSeasonTeam.registeredPlayerIds;
    const next = current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];
    setSquadDraft((state) => ({ ...state, [activeSeasonTeam.teamId]: next }));
  }

  async function saveSeasonSquad() {
    if (!activeSeasonTeam) return;
    const playerIds = squadDraft[activeSeasonTeam.teamId] ?? activeSeasonTeam.registeredPlayerIds;
    await updateSeasonSquad.mutateAsync({ teamId: activeSeasonTeam.teamId, playerIds });
  }

  if (competitionQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (!competition) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Competition not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Edit ${competition.name}`} description="Update competition settings, participants, and duration." />
      <Card className="p-6">
        {competition.seasonOptions?.length ? (
          <FormField label="Season Edition" tooltip="Switch to another season edition of the same competition.">
            <Select
              value={competition.id}
              onChange={(event) => {
                const targetCompetitionId = event.currentTarget.value;
                router.push(`/tournaments/${targetCompetitionId}/edit`);
              }}
            >
              {competition.seasonOptions.map((option) => (
                <option key={option.competitionId} value={option.competitionId}>
                  {option.seasonLabel ?? "No season"}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Competition Name" tooltip="Official competition title." required>
            <Input
              value={draft.name ?? competition.name}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, name: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Competition Type" tooltip="Tournament, league, or friendly." required>
            <Select
              value={draft.type ?? competition.type}
              onChange={(event) => {
                const value = event.target.value as CompetitionType;
                setDraft((current) => ({ ...current, type: value }));
              }}
            >
              <option value={CompetitionType.TOURNAMENT}>Tournament</option>
              <option value={CompetitionType.LEAGUE}>League</option>
              <option value={CompetitionType.FRIENDLY_MATCH}>Friendly Match</option>
            </Select>
          </FormField>
          <FormField label="Sport" tooltip="Sport category of this competition.">
            <Select
              value={selectedSport}
              onChange={(event) => {
                const value = event.target.value as SportType;
                setDraft((current) => ({ ...current, sport: value }));
              }}
            >
              {SPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Season" tooltip="Defines the season/edition of this competition, for example 2025/2026." required>
            <Input
              value={draft.seasonLabel ?? competition.season?.name ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({ ...current, seasonLabel: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Match Duration" tooltip="Regular match time in minutes." required>
            <Input
              type="number"
              min={1}
              max={240}
              value={draft.matchDurationMinutes ?? String(competition.matchDurationMinutes)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, matchDurationMinutes: value }));
              }}
              required
            />
          </FormField>
          <div className="space-y-2 md:col-span-2">
            <FormField label="Trajanje po generacijama (opciono)" tooltip="Ako nije definisano, koristi se globalni Match Duration.">
              <div className="space-y-2">
                {generationMatchDurations.map((item, index) => (
                  <div key={`${item.generationLabel}-${index}`} className="grid gap-2 md:grid-cols-[220px_160px_auto]">
                    <Select
                      value={item.generationLabel}
                      onChange={(event) => {
                        const next = [...generationMatchDurations];
                        next[index] = { ...next[index], generationLabel: event.currentTarget.value };
                        setDraft((current) => ({ ...current, generationMatchDurations: next }));
                      }}
                    >
                      {generationOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={240}
                      value={item.matchDurationMinutes}
                      onChange={(event) => {
                        const next = [...generationMatchDurations];
                        next[index] = { ...next[index], matchDurationMinutes: Number(event.currentTarget.value || 0) };
                        setDraft((current) => ({ ...current, generationMatchDurations: next }));
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        const next = generationMatchDurations.filter((_, rowIndex) => rowIndex !== index);
                        setDraft((current) => ({ ...current, generationMatchDurations: next }));
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => {
                    const used = new Set(generationMatchDurations.map((item) => item.generationLabel));
                    const nextGeneration = generationOptions.find((option) => !used.has(option)) ?? generationOptions[0];
                    setDraft((current) => ({
                      ...current,
                      generationMatchDurations: [
                        ...generationMatchDurations,
                        {
                          generationLabel: nextGeneration,
                          matchDurationMinutes: Number(draft.matchDurationMinutes ?? String(competition.matchDurationMinutes)),
                        },
                      ],
                    }));
                  }}
                >
                  Dodaj generaciju
                </Button>
              </div>
            </FormField>
          </div>
          <div className="space-y-2" style={{ display: "none" }}>
            <FormField label="Stadioni i tereni" tooltip="Dodaj jedan ili više stadiona i njihove terene.">
              <div className="space-y-2">
                {stadiumBlocks.map((stadium, stadiumIndex) => (
                  <div key={`stadium-${stadiumIndex}`} className="space-y-2 rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={`Stadion ${stadiumIndex + 1}`}
                        value={stadium.stadiumName}
                        onChange={(event) => {
                          const next = [...stadiumBlocks];
                          next[stadiumIndex] = { ...next[stadiumIndex], stadiumName: event.target.value };
                          setStadiumBlocks(next);
                        }}
                      />
                      {stadiumBlocks.length > 1 ? (
                        <Button
                          type="button"
                          onClick={() => {
                            const next = stadiumBlocks.filter((_, index) => index !== stadiumIndex);
                            setStadiumBlocks(next.length ? next : [{ stadiumName: "Stadion 1", pitchNames: ["Teren 1"] }]);
                          }}
                        >
                          -
                        </Button>
                      ) : null}
                    </div>
                    {stadium.pitchNames.map((pitch, pitchIndex) => (
                      <div key={`stadium-${stadiumIndex}-pitch-${pitchIndex}`} className="flex items-center gap-2 pl-2">
                        <Input
                          placeholder={`Teren ${pitchIndex + 1}`}
                          value={pitch}
                          onChange={(event) => {
                            const next = [...stadiumBlocks];
                            const nextPitches = [...next[stadiumIndex].pitchNames];
                            nextPitches[pitchIndex] = event.target.value;
                            next[stadiumIndex] = { ...next[stadiumIndex], pitchNames: nextPitches };
                            setStadiumBlocks(next);
                          }}
                        />
                        {stadium.pitchNames.length > 1 ? (
                          <Button
                            type="button"
                            onClick={() => {
                              const next = [...stadiumBlocks];
                              const nextPitches = next[stadiumIndex].pitchNames.filter((_, index) => index !== pitchIndex);
                              next[stadiumIndex] = { ...next[stadiumIndex], pitchNames: nextPitches.length ? nextPitches : ["Teren 1"] };
                              setStadiumBlocks(next);
                            }}
                          >
                            -
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      type="button"
                      onClick={() => {
                        const next = [...stadiumBlocks];
                        next[stadiumIndex] = {
                          ...next[stadiumIndex],
                          pitchNames: [...next[stadiumIndex].pitchNames, `Teren ${next[stadiumIndex].pitchNames.length + 1}`],
                        };
                        setStadiumBlocks(next);
                      }}
                    >
                      Dodaj teren
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => setStadiumBlocks([...stadiumBlocks, { stadiumName: `Stadion ${stadiumBlocks.length + 1}`, pitchNames: ["Teren 1"] }])}
                >
                  Dodaj stadion
                </Button>
              </div>
            </FormField>
          </div>
          <div className="space-y-2 md:col-span-2">
            <FormField label="Dani i satnica" tooltip="Dodaj dane turnira i vremenski opseg (od-do) za planiranje utakmica.">
              <div className="space-y-2">
                {scheduleDays.map((day, index) => (
                    <div key={`${index}-${day.dayDate ?? day.dayLabel}-${day.generationLabel}-${day.stageScope ?? "ALL"}`} className="grid gap-2 md:grid-cols-[1fr_220px_160px_1fr_130px_130px_auto]">
                    <Input
                      type="date"
                      value={day.dayDate ?? ""}
                      onChange={(event) => {
                        const next = [...scheduleDays];
                        next[index] = { ...next[index], dayDate: event.target.value, dayLabel: event.target.value };
                        setDraft((current) => ({ ...current, scheduleDays: next }));
                      }}
                    />
                      <Select
                        value={day.generationLabel}
                        onChange={(event) => {
                          const next = [...scheduleDays];
                          const generationLabel = event.currentTarget.value;
                          const compatiblePitch = pitchOptions.find((pitch) => pitch.generationLabel === generationLabel);
                          const isAuto = generationLabel === ALL_GENERATIONS_LABEL && (next[index].stageScope ?? "ALL") === "ALL";
                          next[index] = {
                            ...next[index],
                            generationLabel,
                            pitchId: isAuto ? null : compatiblePitch?.id ?? next[index].pitchId ?? null,
                          };
                          setDraft((current) => ({ ...current, scheduleDays: next }));
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
                        const next = [...scheduleDays];
                        const stageScope = event.currentTarget.value as "ALL" | "GROUP_STAGE" | "KNOCKOUT";
                        const isAuto = next[index].generationLabel === ALL_GENERATIONS_LABEL && stageScope === "ALL";
                        next[index] = {
                          ...next[index],
                          stageScope,
                          pitchId: isAuto ? null : next[index].pitchId ?? null,
                        };
                        setDraft((current) => ({ ...current, scheduleDays: next }));
                      }}
                    >
                      <option value="ALL">Sve faze</option>
                      <option value="GROUP_STAGE">Grupna faza</option>
                      <option value="KNOCKOUT">Knockout</option>
                    </Select>
                    <Select
                      value={day.pitchId ?? ""}
                        disabled={day.generationLabel === ALL_GENERATIONS_LABEL && (day.stageScope ?? "ALL") === "ALL"}
                        onChange={(event) => {
                          const next = [...scheduleDays];
                          next[index] = { ...next[index], pitchId: event.currentTarget.value || null };
                          setDraft((current) => ({ ...current, scheduleDays: next }));
                        }}
                      >
                      <option value="">
                        {day.generationLabel === ALL_GENERATIONS_LABEL && (day.stageScope ?? "ALL") === "ALL"
                          ? "Automatski (FIFA pravilo)"
                          : "Izaberi teren"}
                      </option>
                      {pitchOptions
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
                          const next = [...scheduleDays];
                          next[index] = { ...next[index], startTime: event.currentTarget.value };
                          setDraft((current) => ({ ...current, scheduleDays: next }));
                        }}
                      />
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(event) => {
                          const next = [...scheduleDays];
                          next[index] = { ...next[index], endTime: event.currentTarget.value };
                          setDraft((current) => ({ ...current, scheduleDays: next }));
                        }}
                      />
                    {scheduleDays.length > 1 ? (
                      <Button
                        type="button"
                        onClick={() => {
                          const next = scheduleDays.filter((_, itemIndex) => itemIndex !== index);
                          setDraft((current) => ({ ...current, scheduleDays: next.length ? next : [{ dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), generationLabel: ALL_GENERATIONS_LABEL, stageScope: "ALL", pitchId: null, startTime: "09:00", endTime: "19:00" }] }));
                        }}
                      >
                        -
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      scheduleDays: [...scheduleDays, { dayLabel: `Dan ${scheduleDays.length + 1}`, dayDate: new Date().toISOString().slice(0, 10), generationLabel: ALL_GENERATIONS_LABEL, stageScope: "ALL", pitchId: null, startTime: "09:00", endTime: "19:00" }],
                    }))
                  }
                >
                  Dodaj dan
                </Button>
              </div>
            </FormField>
          </div>
          <FormField label="Location" tooltip="Competition location or city.">
            <Input
              value={draft.location ?? competition.location ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, location: value }));
              }}
            />
          </FormField>
          <FormField label="Format" tooltip="Round robin, knockout, or custom format.">
            <Input
              value={draft.format ?? competition.format ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, format: value }));
              }}
            />
          </FormField>
          <FormField label="Start Date" tooltip="Competition start date.">
            <Input
              type="date"
              value={draft.startDate ?? toDateInput(competition.startDate)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, startDate: value }));
              }}
            />
          </FormField>
          <FormField label="End Date" tooltip="Competition end date.">
            <Input
              type="date"
              value={draft.endDate ?? toDateInput(competition.endDate)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, endDate: value }));
              }}
            />
          </FormField>
          <FormField label="Registration Deadline" tooltip="Last date for team registrations.">
            <Input
              type="date"
              value={draft.registrationDeadline ?? toDateInput(competition.registrationDeadline)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, registrationDeadline: value }));
              }}
            />
          </FormField>
          <FormField label="Status" tooltip="Current competition lifecycle status.">
            <Select
              value={draft.status ?? competition.status}
              onChange={(event) => {
                const value = event.target.value as CompetitionStatus;
                setDraft((current) => ({ ...current, status: value }));
              }}
            >
              <option value={CompetitionStatus.DRAFT}>Draft</option>
              <option value={CompetitionStatus.UPCOMING}>Upcoming</option>
              <option value={CompetitionStatus.ONGOING}>Ongoing</option>
              <option value={CompetitionStatus.COMPLETED}>Completed</option>
              <option value={CompetitionStatus.ARCHIVED}>Archived</option>
            </Select>
          </FormField>
          <FormField label="Planned Teams" tooltip="Expected participating teams.">
            <Input
              type="number"
              min={2}
              value={draft.teamCount ?? (competition.teamCount ? String(competition.teamCount) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, teamCount: value }));
              }}
            />
          </FormField>
          <FormField label="Max Teams" tooltip="Maximum allowed teams.">
            <Input
              type="number"
              min={2}
              value={draft.maxTeams ?? (competition.maxTeams ? String(competition.maxTeams) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, maxTeams: value }));
              }}
            />
          </FormField>
          <FormField label="Team Size" tooltip="Squad size for competition.">
            <Input
              type="number"
              min={5}
              value={draft.teamSize ?? (competition.teamSize ? String(competition.teamSize) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, teamSize: value }));
              }}
            />
          </FormField>
          <FormField label="Substitutions" tooltip="Allowed substitutions per match.">
            <Input
              type="number"
              min={0}
              value={draft.substitutions ?? (competition.substitutions ? String(competition.substitutions) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, substitutions: value }));
              }}
            />
          </FormField>
          <FormField label="Entry Fee" tooltip="Optional fee for participation.">
            <Input
              type="number"
              min={0}
              value={draft.entryFee ?? (competition.entryFee ? String(competition.entryFee) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, entryFee: value }));
              }}
            />
          </FormField>
          <FormField label="Visibility" tooltip="Public or private competition listing.">
            <Select
              value={draft.visibility ?? competition.visibility ?? "public"}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, visibility: value }));
              }}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </Select>
          </FormField>
          <FormField label="Description" tooltip="Short competition description." className="md:col-span-2">
            <Textarea
              value={draft.description ?? competition.description ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, description: value }));
              }}
            />
          </FormField>
          <FormField label="Notes" tooltip="Internal organizer notes." className="md:col-span-2">
            <Textarea
              value={draft.notes ?? competition.notes ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, notes: value }));
              }}
            />
          </FormField>
          <div className="space-y-2 md:col-span-2">
            <FormField label="Participants" tooltip="Select teams by selected sport for this competition.">
              <Input placeholder="Search teams..." value={teamSearch} onChange={(event) => setTeamSearch(event.currentTarget.value)} />
            </FormField>
            <div className="max-h-44 space-y-1 overflow-auto rounded-xl border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              {availableTeams.map((team) => (
                <label key={team.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <span>{team.name}</span>
                  <input type="checkbox" checked={participantTeamIds.includes(team.id)} onChange={() => toggleParticipant(team.id)} />
                </label>
              ))}
              {!availableTeams.length ? (
                <p className="px-2 py-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  No teams available for selected sport.
                </p>
              ) : null}
            </div>
          </div>
          {updateCompetition.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {(updateCompetition.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button type="button" onClick={() => router.push("/tournaments")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateCompetition.isPending}>
              {updateCompetition.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>
      <Card className="space-y-3 p-6">
        <h3 className="text-lg font-semibold">Season Team Player Registrations</h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Register players manually for this season edition. Only registered players are considered active in this competition season.
        </p>
        <div className="grid gap-3 md:grid-cols-[240px_1fr]">
          <div className="space-y-2 rounded-xl border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            {seasonTeams.map((team) => (
              <button
                key={team.teamId}
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm"
                style={
                  team.teamId === activeSeasonTeamId
                    ? { backgroundColor: "color-mix(in srgb,var(--primary) 16%, transparent)", color: "var(--text-primary)" }
                    : { color: "var(--text-secondary)" }
                }
                onClick={() => setSelectedSeasonTeamId(team.teamId)}
              >
                {team.teamName}
              </button>
            ))}
          </div>
          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            {activeSeasonTeam ? (
              <>
                <p className="text-sm font-medium">{activeSeasonTeam.teamName}</p>
                <div className="max-h-72 space-y-1 overflow-auto">
                  {activeSeasonTeam.players.map((player) => (
                    <label key={player.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                      <span>{player.fullName}</span>
                      <input
                        type="checkbox"
                        checked={activeRegistered.includes(player.id)}
                        onChange={() => toggleSeasonPlayer(player.id)}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void saveSeasonSquad()} disabled={updateSeasonSquad.isPending}>
                    {updateSeasonSquad.isPending ? "Saving..." : "Save Squad"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No season participants available.
              </p>
            )}
          </div>
        </div>
      </Card>
      <Card className="space-y-3 p-6">
        <h3 className="text-lg font-semibold">Prijavljene ekipe</h3>
        <div className="max-w-sm">
          <FormField label="Season select">
            <Select
              value={applicationsSeasonCompetitionId}
              onChange={(event) => setApplicationsSeasonCompetitionId(event.currentTarget.value)}
            >
              {(applicationsQuery.data?.seasonOptions ?? []).map((item) => (
                <option key={item.competitionId} value={item.competitionId}>
                  {item.seasonLabel ?? "No season"}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="space-y-2">
          {seasonApplications.map((application) => {
            const selectedYears = approvalDraft[application.id] ?? application.generations.filter((item) => item.isApproved ?? item.isRequested).map((item) => item.generationYear);
            return (
              <div key={application.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{application.teamName}</p>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{application.status}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {application.seasonLabel ?? "N/A"} • {new Date(application.submittedAt).toLocaleDateString("sr-Latn-RS")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {application.generations.map((generation) => (
                    <button
                      key={`${application.id}-${generation.generationYear}`}
                      type="button"
                      className="rounded-lg border px-2 py-1 text-xs"
                      style={
                        selectedYears.includes(generation.generationYear)
                          ? { borderColor: "var(--primary)", color: "var(--primary)" }
                          : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                      }
                      onClick={() => toggleApprovalGeneration(application.id, generation.generationYear)}
                    >
                      {generation.generationYear}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={approveApplication.isPending}
                      onClick={() => void approveApplicationByGenerations(application.id, application.generations.map((item) => item.generationYear))}
                    >
                      Odobri učešće
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={rejectApplication.isPending}
                      onClick={() => void rejectApplication.mutateAsync({ applicationId: application.id })}
                    >
                      Odbij ekipu
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {seasonApplications.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Nema prijava za izabranu sezonu.
            </p>
          ) : null}
        </div>
      </Card>
      <Card className="space-y-3 p-6">
        <h3 className="text-lg font-semibold">Učesnici po generacijama</h3>
        <div className="space-y-2">
          {(generationParticipantsQuery.data?.participants ?? []).map((participant) => (
            <div key={participant.teamId} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              <p className="font-medium">{participant.teamName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {participant.generationYears.map((year) => (
                  <span key={`${participant.teamId}-${year}`} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>
                    Generacija {year}
                  </span>
                ))}
                {!participant.generationYears.length ? <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Bez generacija</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
