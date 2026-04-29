"use client";

import { useState } from "react";
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
import { useCreateCompetition, useTeams } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createCompetitionSchema } from "@/lib/validation/competition";
import { useI18n } from "@/lib/i18n";
import { canManageTournaments } from "@/lib/permissions";
import { SPORT_OPTIONS } from "@/lib/constants/sports";

const steps = ["createCompetition.step.basic", "createCompetition.step.format", "createCompetition.step.details", "createCompetition.step.review"];

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
  participantTeamIds: [],
  format: "Knockout + Group Stage",
  visibility: "public",
  status: CompetitionStatus.DRAFT,
  entryFee: 0,
};

function toIsoDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

export default function CreateTournamentPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const createCompetition = useCreateCompetition();
  const teamsQuery = useTeams();

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
  const participantTeamIds = useWatch({ control: form.control, name: "participantTeamIds" }) ?? [];
  const [teamSearch, setTeamSearch] = useState("");

  const availableTeams = (teamsQuery.data ?? []).filter(
    (team) => team.sport === watchedSport && team.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const reviewItems = [
    ["Name", watchedName],
    ["Type", t(`competition.type.${competitionType}`)],
    ["Location", watchedLocation || "TBD"],
    ["Dates", `${watchedStartDate || "?"} - ${watchedEndDate || "?"}`],
    ["Status", t(`competition.status.${watchedStatus}`)],
    ["Format", watchedFormat || "TBD"],
    ["Match Duration", `${form.getValues("matchDurationMinutes")} min`],
    ["Participants", participantTeamIds.length ? `${participantTeamIds.length} selected` : "None"],
  ];

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
      const payload = createCompetitionSchema.parse({
        ...values,
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
              <FormField label="Start Date" tooltip="Competition start date.">
                <Input type="date" {...form.register("startDateInput")} />
              </FormField>
              <FormField label="End Date" tooltip="Competition expected end date.">
                <Input type="date" {...form.register("endDateInput")} />
              </FormField>
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
