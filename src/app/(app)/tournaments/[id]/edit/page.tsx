"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CompetitionStatus, CompetitionType, SportType } from "@prisma/client";
import { useCompetition, useTeams, useUpdateCompetition } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { canCreateCompetitions } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toIsoDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;
}

export default function EditCompetitionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const competitionQuery = useCompetition(params.id);
  const teamsQuery = useTeams();
  const updateCompetition = useUpdateCompetition(params.id);
  const [teamSearch, setTeamSearch] = useState("");
  const [draft, setDraft] = useState<{
    name?: string;
    type?: CompetitionType;
    sport?: SportType;
    location?: string;
    startDate?: string;
    endDate?: string;
    registrationDeadline?: string;
    matchDurationMinutes?: string;
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
  }>({});

  const canEditByRole = canCreateCompetitions(user?.role);
  const competition = competitionQuery.data;
  const canEdit = canEditByRole && Boolean(competition?.canEdit);
  const participantTeamIds = draft.participantTeamIds ?? competition?.teams.map((entry) => entry.teamId) ?? [];
  const selectedSport = draft.sport ?? competition?.sport ?? SportType.FOOTBALL;

  const availableTeams = useMemo(
    () =>
      (teamsQuery.data ?? []).filter((team) => team.sport === selectedSport && team.name.toLowerCase().includes(teamSearch.toLowerCase())),
    [teamsQuery.data, selectedSport, teamSearch]
  );

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
      type: draft.type ?? competition.type,
      sport: selectedSport,
      location: (draft.location ?? competition.location ?? "") || null,
      startDate: toIsoDate(draft.startDate ?? toDateInput(competition.startDate)),
      endDate: toIsoDate(draft.endDate ?? toDateInput(competition.endDate)),
      registrationDeadline: toIsoDate(draft.registrationDeadline ?? toDateInput(competition.registrationDeadline)),
      matchDurationMinutes: Number(draft.matchDurationMinutes ?? String(competition.matchDurationMinutes)),
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

  if (competitionQuery.isLoading) {
    return <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading competition...</Card>;
  }

  if (!competition) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Competition not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Edit ${competition.name}`} description="Update competition settings, participants, and duration." />
      <Card className="p-6">
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
              <Input placeholder="Search teams..." value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} />
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
    </div>
  );
}
