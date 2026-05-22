"use client";

import { useMemo, useState } from "react";
import { MatchStatus } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import { useCompetitions, useMatchDetails, useTeams, useUpdateMatch, useVenues } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canCreateMatches } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

function toDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function toTimeInput(value: string) {
  return new Date(value).toISOString().slice(11, 16);
}

function toIsoDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function EditMatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManageByRole = canCreateMatches(user?.role);
  const matchDetailsQuery = useMatchDetails(params.id);
  const competitionsQuery = useCompetitions({ type: "ALL", status: "ALL" });
  const teamsQuery = useTeams();
  const venuesQuery = useVenues();
  const updateMatch = useUpdateMatch(params.id);

  const [draft, setDraft] = useState<{
    competitionId?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    venueId?: string;
    venueLabel?: string;
    pitchName?: string;
    date?: string;
    time?: string;
    status?: MatchStatus;
  }>({});

  const match = matchDetailsQuery.data;
  const canManage = canManageByRole && Boolean(match?.canEdit);
  const selectedCompetitionId = draft.competitionId ?? match?.competitionId ?? "";
  const selectedHomeTeamId = draft.homeTeamId ?? match?.homeTeam.id ?? "";

  const teams = useMemo(() => {
    const competition = (competitionsQuery.data ?? []).find((item) => item.id === selectedCompetitionId);
    if (!competition) return teamsQuery.data ?? [];
    return (teamsQuery.data ?? []).filter((team) => team.sport === competition.sport);
  }, [selectedCompetitionId, competitionsQuery.data, teamsQuery.data]);
  const selectedCompetition = useMemo(
    () => (competitionsQuery.data ?? []).find((item) => item.id === selectedCompetitionId),
    [selectedCompetitionId, competitionsQuery.data]
  );
  const availablePitches = selectedCompetition?.pitchNames?.length ? selectedCompetition.pitchNames : ["Teren 1"];
  const stadiumPitchOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; venueId: string; stadium: string; pitch: string }> = [];
    for (const venue of venuesQuery.data ?? []) {
      for (const pitch of venue.pitches) {
        if (availablePitches.length && !availablePitches.includes(pitch.name)) continue;
        options.push({
          value: `${venue.id}||${venue.name}||${pitch.name}`,
          label: `${venue.name} - ${pitch.name}`,
          venueId: venue.id,
          stadium: venue.name,
          pitch: pitch.name,
        });
      }
    }
    return options;
  }, [venuesQuery.data, availablePitches]);
  const selectedStadiumPitchValue = useMemo(() => {
    const currentStadium = draft.venueLabel ?? match?.venueLabel?.split(" - ")[0] ?? selectedCompetition?.stadiumName ?? "";
    const currentPitch = draft.pitchName ?? match?.pitchName ?? availablePitches[0];
    const currentVenueId = draft.venueId ?? match?.venueId ?? "";
    if (!currentStadium || !currentPitch) return "";
    return `${currentVenueId}||${currentStadium}||${currentPitch}`;
  }, [draft.venueLabel, draft.pitchName, draft.venueId, match?.venueLabel, match?.pitchName, match?.venueId, selectedCompetition?.stadiumName, availablePitches]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match) return;

    const date = draft.date ?? toDateInput(match.scheduledAt);
    const time = draft.time ?? toTimeInput(match.scheduledAt);
    const effectivePitch = draft.pitchName ?? match.pitchName ?? availablePitches[0];
    const effectiveStadium = draft.venueLabel ?? match.venueLabel ?? selectedCompetition?.stadiumName ?? "";

    await updateMatch.mutateAsync({
      competitionId: draft.competitionId ?? match.competitionId,
      homeTeamId: draft.homeTeamId ?? match.homeTeam.id,
      awayTeamId: draft.awayTeamId ?? match.awayTeam.id,
      venueId: draft.venueId ?? match.venueId ?? null,
      venueLabel: effectiveStadium ? `${effectiveStadium} - ${effectivePitch}` : null,
      pitchName: effectivePitch,
      round: match.round ?? null,
      scheduledAt: toIsoDate(date, time),
      status: draft.status ?? match.status,
    });
    router.push("/matches");
  }

  if (!canManage) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You can only edit matches that you created.
      </Card>
    );
  }

  if (matchDetailsQuery.isLoading) {
    return <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading match...</Card>;
  }

  if (!match) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Match not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Edit Match" description="Update schedule and core match metadata." />
      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Competition" tooltip="Competition for this match." required>
            <Select
              value={selectedCompetitionId}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, competitionId: value }));
              }}
              required
            >
              {(competitionsQuery.data ?? []).map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Round / Stage" tooltip="Round stage se podešava kroz Izvlačenje." readOnly>
            <Input value={match.round ?? ""} readOnly />
          </FormField>
          <FormField label="Home Team" tooltip="Home side for this fixture." required>
            <Select
              value={selectedHomeTeamId}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, homeTeamId: value }));
              }}
              required
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Away Team" tooltip="Away side for this fixture." required>
            <Select
              value={draft.awayTeamId ?? match.awayTeam.id}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, awayTeamId: value }));
              }}
              required
            >
              {teams
                .filter((team) => team.id !== selectedHomeTeamId)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Date" tooltip="Match date." required>
            <Input
              type="date"
              value={draft.date ?? toDateInput(match.scheduledAt)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, date: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Kickoff Time" tooltip="Local kickoff time." required>
            <Input
              type="time"
              value={draft.time ?? toTimeInput(match.scheduledAt)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, time: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Stadium" tooltip="Izaberi stadion i teren za utakmicu.">
            <Select
              value={selectedStadiumPitchValue}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setDraft((current) => ({ ...current, venueId: "", venueLabel: "", pitchName: "" }));
                  return;
                }
                const [venueId, stadium, pitch] = value.split("||");
                setDraft((current) => ({ ...current, venueId, venueLabel: stadium, pitchName: pitch }));
              }}
            >
              <option value="">Izaberi stadion - teren</option>
              {stadiumPitchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Pitch" tooltip="Pitch inside selected stadium.">
            <Select
              value={draft.pitchName ?? match.pitchName ?? availablePitches[0]}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, pitchName: value }));
              }}
            >
              {availablePitches.map((pitch) => (
                <option key={pitch} value={pitch}>
                  {pitch}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Venue" tooltip="Match venue.">
            <Select
              value={draft.venueId ?? match.venueId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, venueId: value }));
              }}
            >
              <option value="">No venue</option>
              {(venuesQuery.data ?? []).map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" tooltip="Current status of this match.">
            <Select
              value={draft.status ?? match.status}
              onChange={(event) => {
                const value = event.target.value as MatchStatus;
                setDraft((current) => ({ ...current, status: value }));
              }}
            >
              <option value={MatchStatus.SCHEDULED}>Scheduled</option>
              <option value={MatchStatus.LIVE}>Live</option>
              <option value={MatchStatus.FINISHED}>Finished</option>
              <option value={MatchStatus.POSTPONED}>Postponed</option>
              <option value={MatchStatus.CANCELED}>Canceled</option>
            </Select>
          </FormField>
          {updateMatch.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {(updateMatch.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button type="button" onClick={() => router.push("/matches")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateMatch.isPending}>
              {updateMatch.isPending ? "Saving..." : "Save Match"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
