"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useCompetitionDraw, useGenerateDraw, useResetDraw } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageTournaments } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const roundLabels: Record<string, string> = {
  ROUND_OF_16: "Round of 16",
  QUARTERFINAL: "Quarterfinals",
  SEMIFINAL: "Semifinals",
  FINAL: "Final",
  THIRD_PLACE: "3rd Place",
};

export default function CompetitionDrawPage() {
  const params = useParams<{ competitionId: string }>();
  const { user } = useCurrentUser();
  const canManage = canManageTournaments(user?.role);
  const drawQuery = useCompetitionDraw(params.competitionId);
  const generateDraw = useGenerateDraw(params.competitionId);
  const resetDraw = useResetDraw(params.competitionId);

  const [draftConfig, setDraftConfig] = useState<{
    groupStageEnabled?: boolean;
    groupsCount?: number;
    roundOf16Enabled?: boolean;
    quarterfinalsEnabled?: boolean;
    thirdPlaceMatchEnabled?: boolean;
  }>({});

  if (drawQuery.isLoading) {
    return <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading draw...</Card>;
  }

  if (!drawQuery.data) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Competition not found.</Card>;
  }

  const { competition, draw } = drawQuery.data;
  const isTournament = competition.type === "TOURNAMENT";

  const currentConfig = {
    groupStageEnabled: draftConfig.groupStageEnabled ?? draw?.groupStageEnabled ?? true,
    groupsCount: draftConfig.groupsCount ?? draw?.groupsCount ?? 4,
    roundOf16Enabled: draftConfig.roundOf16Enabled ?? draw?.roundOf16Enabled ?? false,
    quarterfinalsEnabled: draftConfig.quarterfinalsEnabled ?? draw?.quarterfinalsEnabled ?? true,
    thirdPlaceMatchEnabled: draftConfig.thirdPlaceMatchEnabled ?? draw?.thirdPlaceMatchEnabled ?? false,
  };

  async function onGenerate() {
    await generateDraw.mutateAsync(currentConfig);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Izvlacenje - ${competition.name}`} description={`Participants: ${competition.participants.length} - Match duration: ${competition.matchDurationMinutes} min`} />

      <Card className="space-y-3 p-5">
        <h3 className="text-lg font-semibold">Participants</h3>
        <div className="flex flex-wrap gap-2">
          {competition.participants.map((team) => (
            <span key={team.id} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
              {team.name}
            </span>
          ))}
        </div>
      </Card>

      {!isTournament ? (
        <Card className="p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          League competitions do not use draw, groups, or knockout phases. Ranking is determined by league standings and points.
        </Card>
      ) : null}

      {isTournament ? (
        <>
          <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold">Draw Configuration</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Group Stage" tooltip="Enable random group-stage draw before knockout.">
                <Select
                  value={currentConfig.groupStageEnabled ? "yes" : "no"}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftConfig((current) => ({ ...current, groupStageEnabled: value === "yes" }));
                  }}
                  disabled={!canManage}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </Select>
              </FormField>
              <FormField label="Groups Count" tooltip="Number of groups when group stage is enabled." readOnly={!currentConfig.groupStageEnabled || !canManage}>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={currentConfig.groupsCount}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftConfig((current) => ({ ...current, groupsCount: Number(value) }));
                  }}
                  readOnly={!currentConfig.groupStageEnabled || !canManage}
                />
              </FormField>
              <FormField label="Knockout Starts" tooltip="Choose if knockout starts from Round of 16 or Quarterfinals.">
                <Select
                  value={currentConfig.roundOf16Enabled ? "r16" : "qf"}
                  onChange={(event) => {
                    const useR16 = event.target.value === "r16";
                    setDraftConfig((current) => ({ ...current, roundOf16Enabled: useR16, quarterfinalsEnabled: true }));
                  }}
                  disabled={!canManage}
                >
                  <option value="r16">Round of 16</option>
                  <option value="qf">Quarterfinal</option>
                </Select>
              </FormField>
              <FormField label="Third Place Match" tooltip="Enable optional match for 3rd place." readOnly={!canManage}>
                <Select
                  value={currentConfig.thirdPlaceMatchEnabled ? "yes" : "no"}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftConfig((current) => ({ ...current, thirdPlaceMatchEnabled: value === "yes" }));
                  }}
                  disabled={!canManage}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </Select>
              </FormField>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {canManage ? (
                <>
                  <Button variant="danger" onClick={() => resetDraw.mutate()} disabled={resetDraw.isPending}>
                    {resetDraw.isPending ? "Resetting..." : "Reset Draw"}
                  </Button>
                  <Button variant="primary" onClick={() => void onGenerate()} disabled={generateDraw.isPending || competition.participants.length < 2}>
                    {generateDraw.isPending ? "Generating..." : "Kreiraj zrijeb"}
                  </Button>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Read-only access.
                </p>
              )}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">Groups</h3>
            {draw?.groups.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {draw.groups.map((group) => (
                  <div key={group.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                    <p className="mb-2 font-semibold">Group {group.name}</p>
                    <div className="space-y-1 text-sm">
                      {group.teams.map((entry) => (
                        <p key={entry.id}>
                          {entry.position ? `${entry.position}. ` : ""}
                          {entry.team.name}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No groups generated yet.</p>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-semibold">Knockout Bracket</h3>
            {draw?.knockoutRounds.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {draw.knockoutRounds.map((round) => (
                  <div key={round.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                    <p className="mb-2 font-semibold">{roundLabels[round.roundType] ?? round.roundType}</p>
                    <div className="space-y-2">
                      {round.matches.map((match) => (
                        <div key={match.id} className="rounded-lg border p-2 text-sm" style={{ borderColor: "var(--border)" }}>
                          <p>
                            {match.homeTeam?.name ?? match.homeSourceValue} vs {match.awayTeam?.name ?? match.awaySourceValue}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            Match {match.order}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No knockout structure generated yet.</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
