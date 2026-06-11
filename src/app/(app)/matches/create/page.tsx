"use client";

import { useMemo, useState } from "react";
import { MatchStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCompetitions, useCreateMatch, useTeams, useVenues } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageMatches } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

function toIsoDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function minutesBetweenTimes(beginTime: string, endTime: string) {
  const [beginHours, beginMinutes] = beginTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const beginTotal = beginHours * 60 + beginMinutes;
  const endTotal = endHours * 60 + endMinutes;
  return endTotal - beginTotal;
}

const FRIENDLY_COMPETITION_OPTION = "__friendly_game__";

export default function CreateMatchPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManage = canManageMatches(user?.role);
  const competitionsQuery = useCompetitions({ type: "ALL", status: "ALL" });
  const teamsQuery = useTeams();
  const venuesQuery = useVenues();
  const createMatch = useCreateMatch();

  const [competitionId, setCompetitionId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [round, setRound] = useState("");
  const [date, setDate] = useState("");
  const [beginTime, setBeginTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");
  const [stadiumName, setStadiumName] = useState("");
  const [pitchName, setPitchName] = useState("Teren 1");
  const [status, setStatus] = useState<MatchStatus>(MatchStatus.SCHEDULED);
  const [formError, setFormError] = useState<string | null>(null);

  const teams = useMemo(() => {
    if (competitionId === FRIENDLY_COMPETITION_OPTION) return teamsQuery.data ?? [];
    const competition = (competitionsQuery.data ?? []).find((item) => item.id === competitionId);
    if (!competition) return teamsQuery.data ?? [];
    return (teamsQuery.data ?? []).filter((team) => team.sport === competition.sport);
  }, [competitionId, competitionsQuery.data, teamsQuery.data]);
  const selectedCompetition = useMemo(
    () => (competitionsQuery.data ?? []).find((item) => item.id === competitionId),
    [competitionId, competitionsQuery.data]
  );
  const availablePitches = selectedCompetition?.pitchNames?.length ? selectedCompetition.pitchNames : ["Teren 1"];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const effectiveStadiumName = stadiumName || selectedCompetition?.stadiumName || "";
    const regularTimeMinutes = minutesBetweenTimes(beginTime, endTime);
    if (regularTimeMinutes <= 0) {
      setFormError("Time (end) mora biti poslije Time (begin).");
      return;
    }
    await createMatch.mutateAsync({
      competitionId,
      homeTeamId,
      awayTeamId,
      venueId: venueId || null,
      venueLabel: effectiveStadiumName ? `${effectiveStadiumName} - ${pitchName}` : null,
      pitchName: pitchName || null,
      round: round || null,
      scheduledAt: toIsoDate(date, beginTime),
      status,
      homeScore: null,
      awayScore: null,
      liveMinute: null,
      regularTimeMinutes,
    });
    router.push("/matches");
  }

  if (!canManage) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You do not have permission to create matches.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Create Match" description="Schedule a new match for selected competition." />
      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Competition" tooltip="Competition this match belongs to." required>
            <Select value={competitionId} onChange={(event) => setCompetitionId(event.currentTarget.value)} required>
              <option value="">Select competition</option>
              <option value={FRIENDLY_COMPETITION_OPTION}>Friendly Game</option>
              {(competitionsQuery.data ?? []).map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Round / Stage" tooltip="Round or stage label (optional).">
            <Input value={round} onChange={(event) => setRound(event.currentTarget.value)} />
          </FormField>
          <FormField label="Home Team" tooltip="Team playing as home side." required>
            <Select value={homeTeamId} onChange={(event) => setHomeTeamId(event.currentTarget.value)} required>
              <option value="">Select home team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Away Team" tooltip="Team playing as away side." required>
            <Select value={awayTeamId} onChange={(event) => setAwayTeamId(event.currentTarget.value)} required>
              <option value="">Select away team</option>
              {teams
                .filter((team) => team.id !== homeTeamId)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Date" tooltip="Match date." required>
            <Input type="date" value={date} onChange={(event) => setDate(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Time (begin)" tooltip="Local match start time." required>
            <Input type="time" value={beginTime} onChange={(event) => setBeginTime(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Time (end)" tooltip="Local match end time." required>
            <Input type="time" value={endTime} onChange={(event) => setEndTime(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Stadium" tooltip="Main stadium for this match venue label.">
            <Input
              value={stadiumName || selectedCompetition?.stadiumName || ""}
              onChange={(event) => setStadiumName(event.currentTarget.value)}
              placeholder="Stadium name"
            />
          </FormField>
          <FormField label="Pitch" tooltip="Pitch inside selected stadium.">
            <Select value={pitchName} onChange={(event) => setPitchName(event.currentTarget.value)}>
              {availablePitches.map((pitch) => (
                <option key={pitch} value={pitch}>
                  {pitch}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Venue" tooltip="Venue where match is played.">
            <Select value={venueId} onChange={(event) => setVenueId(event.currentTarget.value)}>
              <option value="">No venue</option>
              {(venuesQuery.data ?? []).map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" tooltip="Initial match status.">
            <Select value={status} onChange={(event) => setStatus(event.currentTarget.value as MatchStatus)}>
              <option value={MatchStatus.SCHEDULED}>Scheduled</option>
              <option value={MatchStatus.LIVE}>Live</option>
              <option value={MatchStatus.FINISHED}>Finished</option>
              <option value={MatchStatus.POSTPONED}>Postponed</option>
            </Select>
          </FormField>
          {formError || createMatch.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {formError ?? (createMatch.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button type="button" onClick={() => router.push("/matches")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMatch.isPending}>
              {createMatch.isPending ? "Creating..." : "Create Match"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
