"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CompetitionStatus, CompetitionType, SportType } from "@prisma/client";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCompetitions, useCreateCompetition, useTeams, useVenues } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createCompetitionSchema } from "@/lib/validation/competition";
import { useI18n } from "@/lib/i18n";
import { canManageTournaments } from "@/lib/permissions";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { GENERATION_LABELS } from "@/lib/constants/generation-presets";

const steps = ["createCompetition.step.basic", "createCompetition.step.format", "createCompetition.step.details", "createCompetition.step.review"];
const ALL_GENERATIONS_LABEL = "Sve generacije";

type CompetitionFormValues = z.input<typeof createCompetitionSchema> & {
  startDateInput?: string;
  endDateInput?: string;
  registrationDeadlineInput?: string;
};

const defaults: CompetitionFormValues = {
  name: "",
  type: CompetitionType.TOURNAMENT,
  sport: SportType.FOOTBALL,
  description: "",
  notes: "",
  location: "",
  startDateInput: "",
  endDateInput: "",
  registrationDeadlineInput: "",
  teamCount: 8,
  maxTeams: 16,
  teamSize: 11,
  substitutions: 5,
  matchDurationMinutes: 90,
  generationMatchDurations: [],
  stadiumName: "Stadion",
  pitchNames: ["Teren 1"],
  scheduleDays: [{ dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), generationLabel: ALL_GENERATIONS_LABEL, stageScope: "ALL", startTime: "09:00", endTime: "19:00" }],
  seasonLabel: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
  participantTeamIds: [],
  format: "Knockout + Group Stage",
  visibility: "public",
  status: CompetitionStatus.DRAFT,
  entryFee: 0,
};

function toIsoDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

type StadiumBlock = { stadiumName: string; pitchNames: string[] };
const STADIUM_PITCH_SEPARATOR = " - ";

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

function decodeStadiumBlocks(stadiumName?: string | null, pitchNames?: string[]): StadiumBlock[] {
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

export default function CreateTournamentPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const createCompetition = useCreateCompetition();
  const templatesQuery = useCompetitions({});
  const teamsQuery = useTeams();
  const venuesQuery = useVenues();
  const generationOptions = GENERATION_LABELS;
  const scheduleGenerationOptions = [ALL_GENERATIONS_LABEL, ...GENERATION_LABELS];
  const [stadiumBlocks, setStadiumBlocks] = useState<StadiumBlock[]>(() => decodeStadiumBlocks(defaults.stadiumName, defaults.pitchNames));
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedPrimaryPitchName, setSelectedPrimaryPitchName] = useState<string>("");
  const [selectedTemplateCompetitionId, setSelectedTemplateCompetitionId] = useState<string>("");

  const form = useForm<CompetitionFormValues>({
    resolver: zodResolver(createCompetitionSchema.extend({
      startDateInput: z.string().optional(),
      endDateInput: z.string().optional(),
      registrationDeadlineInput: z.string().optional(),
    })),
    defaultValues: defaults,
    mode: "onBlur",
  });

  const competitionType = useWatch({ control: form.control, name: "type" });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedLocation = useWatch({ control: form.control, name: "location" });
  const watchedStartDate = useWatch({ control: form.control, name: "startDateInput" });
  const watchedEndDate = useWatch({ control: form.control, name: "endDateInput" });
  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedFormat = useWatch({ control: form.control, name: "format" });
  const watchedSport = useWatch({ control: form.control, name: "sport" });
  const watchedSeasonLabel = useWatch({ control: form.control, name: "seasonLabel" });
  const participantTeamIds = useWatch({ control: form.control, name: "participantTeamIds" }) ?? [];
  const pitchNames = useWatch({ control: form.control, name: "pitchNames" }) ?? ["Teren 1"];
  const generationMatchDurations = useWatch({ control: form.control, name: "generationMatchDurations" }) ?? [];
  const scheduleDays =
    useWatch({ control: form.control, name: "scheduleDays" }) ??
    [{ dayLabel: "Dan 1", dayDate: new Date().toISOString().slice(0, 10), generationLabel: ALL_GENERATIONS_LABEL, stageScope: "ALL", pitchId: null, startTime: "09:00", endTime: "19:00" }];
  const [teamSearch, setTeamSearch] = useState("");
  const pitchOptions = useMemo(
    () =>
      (venuesQuery.data ?? []).flatMap((venue) =>
        venue.pitches.map((pitch) => ({
          id: pitch.id,
          venueId: venue.id,
          venueName: venue.name,
          pitchName: pitch.name,
          generationLabel: pitch.generationLabel,
          label: `${venue.name} - ${pitch.name} (${pitch.fieldLengthMeters}x${pitch.fieldWidthMeters} m, ${pitch.playerFormat})`,
        }))
      ),
    [venuesQuery.data]
  );
  const selectedVenueSet = useMemo(() => new Set(selectedVenueIds), [selectedVenueIds]);
  const filteredPitchOptions = useMemo(
    () =>
      pitchOptions.filter((pitch) => (selectedVenueSet.size ? selectedVenueSet.has(pitch.venueId) : true)),
    [pitchOptions, selectedVenueSet]
  );
  const primaryVenue = useMemo(
    () => (venuesQuery.data ?? []).find((venue) => venue.id === selectedVenueIds[0]) ?? null,
    [venuesQuery.data, selectedVenueIds]
  );
  const primaryVenuePitches = primaryVenue?.pitches ?? [];

  useEffect(() => {
    if (!venuesQuery.data?.length) return;
    if (!selectedVenueIds.length) {
      setSelectedVenueIds([venuesQuery.data[0].id]);
    }
  }, [venuesQuery.data, selectedVenueIds.length]);

  useEffect(() => {
    const encoded = encodeStadiumBlocks(stadiumBlocks);
    form.setValue("stadiumName", encoded.stadiumName, { shouldDirty: true, shouldValidate: true });
    form.setValue("pitchNames", encoded.pitchNames, { shouldDirty: true, shouldValidate: true });
  }, [form, stadiumBlocks]);

  const availableTeams = (teamsQuery.data ?? []).filter(
    (team) => team.sport === watchedSport && team.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const reviewItems = [
    ["Name", watchedName],
    ["Type", t(`competition.type.${competitionType}`)],
    ["Season", watchedSeasonLabel],
    ["Location", watchedLocation || "TBD"],
    ["Dates", `${watchedStartDate || "?"} - ${watchedEndDate || "?"}`],
    ["Status", t(`competition.status.${watchedStatus}`)],
    ["Format", watchedFormat || "TBD"],
    ["Match Duration", `${form.getValues("matchDurationMinutes")} min`],
    [
      "Generation Duration Overrides",
      generationMatchDurations.length
        ? generationMatchDurations.map((item) => `${item.generationLabel}: ${item.matchDurationMinutes} min`).join(" | ")
        : "Global duration only",
    ],
    ["Participants", participantTeamIds.length ? `${participantTeamIds.length} selected` : "None"],
    ["Stadium", form.getValues("stadiumName") || "N/A"],
    ["Pitches", pitchNames.join(", ")],
                    ["Schedule Days", scheduleDays.map((d) => `${d.dayDate} · ${d.generationLabel} · ${d.startTime}-${d.endTime}`).join(" | ")],
  ];

  const templateOptions = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        type: CompetitionType;
        sport: SportType;
        seasonLabel?: string | null;
        status: CompetitionStatus;
        location: string;
        format?: string | null;
        matchDurationMinutes: number;
        generationMatchDurations?: Array<{ generationLabel: string; matchDurationMinutes: number }>;
        stadiumName?: string | null;
        pitchNames?: string[];
        scheduleDays?: Array<{
          dayLabel: string;
          dayDate?: string;
          generationLabel?: string;
          stageScope?: "ALL" | "GROUP_STAGE" | "KNOCKOUT";
          pitchId?: string | null;
          startTime: string;
          endTime: string;
        }> | null;
      }
    >();
    for (const competition of templatesQuery.data ?? []) {
      const key = `${competition.name}__${competition.type}__${competition.sport}`;
      if (!grouped.has(key)) grouped.set(key, competition);
    }
    return Array.from(grouped.values());
  }, [templatesQuery.data]);

  function toggleParticipant(teamId: string) {
    const current = form.getValues("participantTeamIds") ?? [];
    if (current.includes(teamId)) {
      form.setValue(
        "participantTeamIds",
        current.filter((id) => id !== teamId),
        { shouldDirty: true }
      );
      return;
    }
    form.setValue("participantTeamIds", [...current, teamId], { shouldDirty: true });
  }

  const onSubmit = form.handleSubmit(
    async (values) => {
      setFormError(null);
      const derivedTournamentPitchNames = Array.from(
        new Set(
          filteredPitchOptions
            .map((item) => `${item.venueName} - ${item.pitchName}`)
            .concat(selectedPrimaryPitchName && primaryVenue ? [`${primaryVenue.name} - ${selectedPrimaryPitchName}`] : [])
            .filter(Boolean)
        )
      );
      const fallbackTournamentPitchNames = (values.pitchNames ?? []).filter((item) => item.trim().length > 0);

      const payload = createCompetitionSchema.parse({
        ...values,
        stadiumName:
          values.type === CompetitionType.LEAGUE ? null : (primaryVenue?.name ?? values.stadiumName ?? "Stadion"),
        pitchNames:
          values.type === CompetitionType.LEAGUE
            ? []
            : (derivedTournamentPitchNames.length ? derivedTournamentPitchNames : fallbackTournamentPitchNames),
        startDate: toIsoDate(values.startDateInput),
        endDate: toIsoDate(values.endDateInput),
        registrationDeadline: toIsoDate(values.registrationDeadlineInput),
        description: values.description || null,
        notes: values.notes || null,
        location: values.location || null,
        visibility: values.visibility || "public",
        format: values.format || null,
        entryFee: values.entryFee ?? 0,
      });

      await createCompetition.mutateAsync(payload);
      router.push("/tournaments");
    },
    (errors) => {
      if (errors.name || errors.type || errors.location || errors.startDateInput || errors.endDateInput) {
        setStep(0);
      } else if (
        errors.format ||
        errors.teamCount ||
        errors.maxTeams ||
        errors.teamSize ||
        errors.substitutions ||
        errors.matchDurationMinutes ||
        errors.status
      ) {
        setStep(1);
      } else {
        setStep(2);
      }

      setFormError("Provjeri unesena polja. Neka vrijednost nije validna.");
    }
  );

  if (!canManageTournaments(user?.role)) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        {t("common.forbidden", "You do not have permission to create competitions.")}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("createCompetition.title")} description={t("createCompetition.description")} />
      <Card className="p-6">
        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          {steps.map((stepKey, index) => (
            <button
              key={stepKey}
              type="button"
              className="rounded-xl border px-3 py-2 text-center text-sm"
              style={
                index <= step
                  ? { borderColor: "var(--primary)", color: "var(--primary)", backgroundColor: "color-mix(in srgb,var(--primary) 10%, transparent)" }
                  : { borderColor: "var(--border)", color: "var(--text-secondary)" }
              }
              onClick={() => setStep(index)}
            >
              {index + 1}. {t(stepKey)}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {step === 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Kopiraj iz postojećeg takmičenja" tooltip="Izaberite ranije takmičenje kao template.">
                <Select
                  value={selectedTemplateCompetitionId}
                  onChange={(event) => {
                    const templateId = event.currentTarget.value;
                    setSelectedTemplateCompetitionId(templateId);
                    if (!templateId) return;
                    const template = (templatesQuery.data ?? []).find((item) => item.id === templateId);
                    if (!template) return;

                    form.setValue("name", template.name, { shouldDirty: true });
                    form.setValue("type", template.type, { shouldDirty: true });
                    form.setValue("sport", template.sport, { shouldDirty: true });
                    form.setValue("location", template.location === "TBD" ? "" : template.location, { shouldDirty: true });
                    form.setValue("status", template.status, { shouldDirty: true });
                    form.setValue("matchDurationMinutes", template.matchDurationMinutes, { shouldDirty: true });
                    form.setValue("generationMatchDurations", template.generationMatchDurations ?? [], { shouldDirty: true });
                    form.setValue("stadiumName", template.stadiumName ?? "Stadion", { shouldDirty: true });
                    form.setValue("pitchNames", template.pitchNames?.length ? template.pitchNames : ["Teren 1"], { shouldDirty: true });

                    if (template.scheduleDays?.length) {
                      form.setValue("scheduleDays", template.scheduleDays.map((day, index) => ({
                        dayLabel: day.dayLabel || `Dan ${index + 1}`,
                        dayDate: day.dayDate ?? new Date().toISOString().slice(0, 10),
                        generationLabel: day.generationLabel ?? ALL_GENERATIONS_LABEL,
                        stageScope: day.stageScope ?? "ALL",
                        pitchId: day.pitchId ?? null,
                        startTime: day.startTime,
                        endTime: day.endTime,
                      })), { shouldDirty: true });
                    }

                    if (template.pitchNames?.length && venuesQuery.data?.length) {
                      const resolvedVenueIds = Array.from(
                        new Set(
                          template.pitchNames
                            .map((name) => {
                              const venueName = name.split(" - ")[0]?.trim();
                              if (!venueName) return null;
                              return venuesQuery.data.find((venue) => venue.name === venueName)?.id ?? null;
                            })
                            .filter((id): id is string => Boolean(id))
                        )
                      );
                      if (resolvedVenueIds.length) setSelectedVenueIds(resolvedVenueIds);
                    }
                  }}
                >
                  <option value="">Bez template-a</option>
                  {templateOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} • {item.type} • {item.seasonLabel ?? "N/A"}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div />
              <FormField
                label="Competition Name"
                tooltip="Official competition title shown across matches, standings, and exports."
                required
                error={form.formState.errors.name?.message}
              >
                <Input placeholder="Competition name" {...form.register("name")} />
              </FormField>
              <FormField label="Competition Type" tooltip="Choose whether this is a tournament, league, or a friendly match." required>
                <Select {...form.register("type")}>
                  <option value={CompetitionType.TOURNAMENT}>{t("competition.type.TOURNAMENT")}</option>
                  <option value={CompetitionType.LEAGUE}>{t("competition.type.LEAGUE")}</option>
                  <option value={CompetitionType.FRIENDLY_MATCH}>{t("competition.type.FRIENDLY_MATCH")}</option>
                </Select>
              </FormField>
              <FormField label="Location" tooltip="City, stadium zone, or region where competition is hosted.">
                <Input placeholder="Location" {...form.register("location")} />
              </FormField>
              <FormField label="Sport" tooltip="Sport category for this competition.">
                <Select {...form.register("sport")}>
                  {SPORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Season"
                tooltip="Defines the season/edition of this competition, for example 2025/2026."
                required
                error={form.formState.errors.seasonLabel?.message}
              >
                <Input placeholder="e.g. 2026/2027" {...form.register("seasonLabel")} />
              </FormField>
              <FormField label="Start Date" tooltip="Competition start date.">
                <Input type="date" {...form.register("startDateInput")} />
              </FormField>
              <FormField label="End Date" tooltip="Competition expected end date.">
                <Input type="date" {...form.register("endDateInput")} />
              </FormField>
              {competitionType !== CompetitionType.LEAGUE ? (
              <>
              <FormField label="Stadion" tooltip="Glavni stadion za takmičenje." required>
                <Select
                  value={selectedVenueIds[0] ?? ""}
                  onChange={(event) => {
                    const nextPrimary = event.currentTarget.value;
                    const rest = selectedVenueIds.filter((id) => id !== nextPrimary);
                    const nextIds = nextPrimary ? [nextPrimary, ...rest] : rest;
                    setSelectedVenueIds(nextIds);
                    const venue = (venuesQuery.data ?? []).find((item) => item.id === nextPrimary);
                    if (venue) {
                      form.setValue("stadiumName", venue.name, { shouldDirty: true, shouldValidate: true });
                      const defaultPitch = venue.pitches[0]?.name ?? "";
                      setSelectedPrimaryPitchName(defaultPitch);
                    }
                  }}
                >
                  <option value="">Izaberi stadion</option>
                  {(venuesQuery.data ?? []).map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Teren" tooltip="Teren u okviru izabranog stadiona." required>
                <Select
                  value={selectedPrimaryPitchName}
                  onChange={(event) => {
                    setSelectedPrimaryPitchName(event.currentTarget.value);
                  }}
                >
                  <option value="">Izaberi teren</option>
                  {primaryVenuePitches.map((pitch) => (
                    <option key={pitch.id} value={pitch.name}>
                      {pitch.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="space-y-2 md:col-span-2">
                <FormField label="Dodatni stadioni" tooltip="Opcionalno dodaj još stadiona za turnir.">
                  <div className="grid gap-2 md:grid-cols-2">
                    {(venuesQuery.data ?? []).map((venue) => {
                      const checked = selectedVenueIds.includes(venue.id);
                      return (
                        <label key={venue.id} className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                          <span>{venue.name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedVenueIds((current) => {
                                if (checked) {
                                  const next = current.filter((id) => id !== venue.id);
                                  return next.length ? next : current;
                                }
                                return [...current, venue.id];
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </FormField>
              </div>
              </>
              ) : null}
              <div className="space-y-2" style={{ display: "none" }}>
                <FormField
                  label="Stadioni i tereni"
                  tooltip="Dodaj jedan ili više stadiona i njihove terene."
                  required
                  error={form.formState.errors.pitchNames?.message as string | undefined}
                >
                  <div className="space-y-2">
                    {stadiumBlocks.map((stadium, stadiumIndex) => (
                      <div key={`stadium-${stadiumIndex}`} className="space-y-2 rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder={`Stadion ${stadiumIndex + 1}`}
                            value={stadium.stadiumName}
                            onChange={(event) => {
                              const next = [...stadiumBlocks];
                              next[stadiumIndex] = { ...next[stadiumIndex], stadiumName: event.currentTarget.value };
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
                                nextPitches[pitchIndex] = event.currentTarget.value;
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
                      onClick={() => setStadiumBlocks((current) => [...current, { stadiumName: `Stadion ${current.length + 1}`, pitchNames: ["Teren 1"] }])}
                    >
                      Dodaj stadion
                    </Button>
                  </div>
                </FormField>
              </div>
              {competitionType === CompetitionType.LEAGUE ? (
                <div className="space-y-2 md:col-span-2">
                  <FormField label="Participants" tooltip="Select existing teams for the chosen sport. These teams become official competition participants.">
                    <Input placeholder="Search teams..." value={teamSearch} onChange={(event) => setTeamSearch(event.currentTarget.value)} />
                  </FormField>
                  <div className="max-h-44 space-y-1 overflow-auto rounded-xl border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                    {availableTeams.map((team) => (
                      <label key={team.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                        <span>{team.name}</span>
                        <input
                          type="checkbox"
                          checked={participantTeamIds.includes(team.id)}
                          onChange={() => toggleParticipant(team.id)}
                        />
                      </label>
                    ))}
                    {!availableTeams.length ? (
                      <p className="px-2 py-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        No teams available for selected sport.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Format" tooltip="Competition bracket or round-robin format.">
                <Select {...form.register("format")}>
                  {competitionType === CompetitionType.LEAGUE ? (
                    <>
                      <option value="Round Robin">Round Robin</option>
                      <option value="Double Round Robin">Double Round Robin</option>
                    </>
                  ) : competitionType === CompetitionType.FRIENDLY_MATCH ? (
                    <option value="Single Match">Single Match</option>
                  ) : (
                    <>
                      <option value="Knockout">Knockout</option>
                      <option value="Knockout + Group Stage">Knockout + Group Stage</option>
                    </>
                  )}
                </Select>
              </FormField>
              <FormField label="Planned Teams" tooltip="Expected participating teams.">
                <Input
                  type="number"
                  min={2}
                  placeholder="Planned teams"
                  {...form.register("teamCount", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                  disabled={competitionType === CompetitionType.FRIENDLY_MATCH}
                />
              </FormField>
              <FormField label="Max Teams" tooltip="Upper registration limit for teams.">
                <Input
                  type="number"
                  min={2}
                  placeholder="Max teams"
                  {...form.register("maxTeams", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                  disabled={competitionType === CompetitionType.FRIENDLY_MATCH}
                />
              </FormField>
              <FormField label="Team Size" tooltip="Default matchday team size for this competition.">
                <Input
                  type="number"
                  min={5}
                  placeholder="Team size"
                  {...form.register("teamSize", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                />
              </FormField>
              <FormField label="Substitutions" tooltip="Allowed substitutions per team.">
                <Input
                  type="number"
                  min={0}
                  placeholder="Substitutions"
                  {...form.register("substitutions", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                />
              </FormField>
              <FormField
                label="Match Duration"
                tooltip="Defines the regular duration of matches in this competition. Stoppage time is calculated separately."
                required
                error={form.formState.errors.matchDurationMinutes?.message}
              >
                <Input
                  type="number"
                  min={1}
                  max={240}
                  placeholder="e.g. 90"
                  {...form.register("matchDurationMinutes", { setValueAs: (value) => Number(value) })}
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
                            form.setValue("generationMatchDurations", next, { shouldDirty: true, shouldValidate: true });
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
                            form.setValue("generationMatchDurations", next, { shouldDirty: true, shouldValidate: true });
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const next = generationMatchDurations.filter((_, rowIndex) => rowIndex !== index);
                            form.setValue("generationMatchDurations", next, { shouldDirty: true, shouldValidate: true });
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
                        form.setValue(
                          "generationMatchDurations",
                          [...generationMatchDurations, { generationLabel: nextGeneration, matchDurationMinutes: form.getValues("matchDurationMinutes") ?? 90 }],
                          { shouldDirty: true, shouldValidate: true }
                        );
                      }}
                    >
                      Dodaj generaciju
                    </Button>
                  </div>
                </FormField>
              </div>
              <FormField label="Status" tooltip="Current lifecycle state of this competition.">
                <Select {...form.register("status")}>
                  <option value={CompetitionStatus.DRAFT}>{t("competition.status.DRAFT")}</option>
                  <option value={CompetitionStatus.UPCOMING}>{t("competition.status.UPCOMING")}</option>
                  <option value={CompetitionStatus.ONGOING}>{t("competition.status.ONGOING")}</option>
                </Select>
              </FormField>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Description" tooltip="Short overview displayed for admins and participants." className="md:col-span-2">
                <Textarea placeholder="Description" className="md:col-span-2" {...form.register("description")} />
              </FormField>
              <FormField label="Entry Fee" tooltip="Registration fee per team (if applicable).">
                <Input
                  type="number"
                  min={0}
                  placeholder="Entry fee"
                  {...form.register("entryFee", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
                />
              </FormField>
              <FormField label="Registration Deadline" tooltip="Last day teams can register.">
                <Input type="date" {...form.register("registrationDeadlineInput")} />
              </FormField>
              <FormField label="Visibility" tooltip="Public competitions are visible to all; private ones are restricted.">
                <Select {...form.register("visibility")}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </Select>
              </FormField>
              <FormField label="Notes" tooltip="Internal notes for organizers." className="md:col-span-2">
                <Textarea placeholder="Optional notes" className="md:col-span-2" {...form.register("notes")} />
              </FormField>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              {reviewItems.map(([label, value]) => (
                <p key={label}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{label}:</span> {value || "-"}
                </p>
              ))}
            </div>
          )}

          {formError ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{formError}</p>
          ) : null}

          {createCompetition.isError ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{(createCompetition.error as Error).message}</p>
          ) : null}

          <div className="mt-6 flex justify-between">
            <Button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || createCompetition.isPending}>
              {t("common.back")}
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" variant="primary" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>
                {t("common.next")}
              </Button>
            ) : (
              <Button variant="primary" type="submit" disabled={createCompetition.isPending}>
                {createCompetition.isPending ? t("common.loading") : t("common.create")}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
