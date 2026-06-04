"use client";

import { useMemo, useState } from "react";
import { GoalType } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMatchDetails, useResetMatchDetails, useUpdateMatchDetails } from "@/hooks/use-competitions";
import { canCreateMatches } from "@/lib/permissions";
import { GOAL_TYPE_OPTIONS, TEAM_STAT_FIELDS, calculatePossessionPercentages, formatGoalMinute } from "@/lib/constants/match";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDateTimeDDMMYYYY } from "@/lib/utils/date";

type GoalForm = {
  id?: string;
  teamId: string;
  playerId?: string | null;
  scorerName: string;
  minuteBase: number;
  minuteExtra?: number | null;
  goalType: GoalType;
};

type StatsForm = {
  teamId: string;
  teamName: string;
  possessionPercent: number;
  possessionSeconds: number;
  totalShots: number;
  shotsOnTarget: number;
  shotsOffTarget: number;
  totalPasses: number;
  accuratePasses: number;
  inaccuratePasses: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
};

type MatchForm = {
  homeScore: number;
  awayScore: number;
  regularTimeMinutes: number;
  goalEvents: GoalForm[];
  teamStats: StatsForm[];
};

function buildDefaultStats(teamId: string, teamName: string): StatsForm {
  return {
    teamId,
    teamName,
    possessionPercent: 50,
    possessionSeconds: 0,
    totalShots: 0,
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    totalPasses: 0,
    accuratePasses: 0,
    inaccuratePasses: 0,
    corners: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function getStatusVariant(status: string) {
  if (status === "LIVE") return "live" as const;
  if (status === "FINISHED") return "completed" as const;
  if (status === "POSTPONED") return "inactive" as const;
  return "upcoming" as const;
}

function calculateBarWidths(home: number, away: number) {
  const total = Math.max(1, home + away);
  return { home: (home / total) * 100, away: (away / total) * 100 };
}

const statTooltips: Record<string, string> = {
  totalShots: "All shot attempts, including on/off target.",
  shotsOnTarget: "Shots that would enter the goal without a block by outfield players.",
  shotsOffTarget: "Shots that miss the goal frame.",
  totalPasses: "All attempted passes.",
  accuratePasses: "Completed passes reaching a teammate.",
  inaccuratePasses: "Unsuccessful passes.",
  corners: "Corner kicks won.",
  fouls: "Committed fouls / prekrsaji.",
  yellowCards: "Yellow cards received.",
  redCards: "Red cards received.",
};

export default function MatchDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const canEditByRole = canCreateMatches(user?.role);
  const matchDetailsQuery = useMatchDetails(params.id);
  const updateMatchDetails = useUpdateMatchDetails(params.id);
  const resetMatchDetails = useResetMatchDetails(params.id);
  const [draftForm, setDraftForm] = useState<MatchForm | null>(null);

  const initialForm = useMemo<MatchForm | null>(() => {
    if (!matchDetailsQuery.data) return null;
    const homeTeamStats = matchDetailsQuery.data.teamStats.find((item) => item.teamId === matchDetailsQuery.data.homeTeam.id);
    const awayTeamStats = matchDetailsQuery.data.teamStats.find((item) => item.teamId === matchDetailsQuery.data.awayTeam.id);
    return {
      homeScore: matchDetailsQuery.data.homeTeam.score,
      awayScore: matchDetailsQuery.data.awayTeam.score,
      regularTimeMinutes: matchDetailsQuery.data.regularTimeMinutes,
      goalEvents: matchDetailsQuery.data.goalEvents.map((goal) => ({
        id: goal.id,
        teamId: goal.teamId,
        playerId: goal.playerId,
        scorerName: goal.scorerName,
        minuteBase: goal.minuteBase,
        minuteExtra: goal.minuteExtra,
        goalType: goal.goalType,
      })),
      teamStats: [
        homeTeamStats ?? buildDefaultStats(matchDetailsQuery.data.homeTeam.id, matchDetailsQuery.data.homeTeam.name),
        awayTeamStats ?? buildDefaultStats(matchDetailsQuery.data.awayTeam.id, matchDetailsQuery.data.awayTeam.name),
      ],
    };
  }, [matchDetailsQuery.data]);

  const form = draftForm ?? initialForm;

  function mutateForm(updater: (current: MatchForm) => MatchForm) {
    setDraftForm((current) => {
      const base = current ?? initialForm;
      if (!base) return current;
      return updater(base);
    });
  }

  const allPlayers = useMemo(() => {
    if (!matchDetailsQuery.data) return [];
    return [...matchDetailsQuery.data.homeTeam.players, ...matchDetailsQuery.data.awayTeam.players];
  }, [matchDetailsQuery.data]);

  if (matchDetailsQuery.isLoading) {
    return <LoadingSkeleton />;
  }
  if (!matchDetailsQuery.data || !form) {
    return (
      <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
        Match not found.
      </Card>
    );
  }

  const canEdit = canEditByRole && Boolean(matchDetailsQuery.data.canEdit);

  const homeTeam = matchDetailsQuery.data.homeTeam;
  const awayTeam = matchDetailsQuery.data.awayTeam;
  const homeStats = form.teamStats.find((stats) => stats.teamId === homeTeam.id) ?? buildDefaultStats(homeTeam.id, homeTeam.name);
  const awayStats = form.teamStats.find((stats) => stats.teamId === awayTeam.id) ?? buildDefaultStats(awayTeam.id, awayTeam.name);
  const possession = calculatePossessionPercentages(homeStats.possessionSeconds, awayStats.possessionSeconds);

  function setTeamStat(teamId: string, key: keyof StatsForm, value: number) {
    mutateForm((current) => ({
      ...current,
      teamStats: (() => {
        const hasTeam = current.teamStats.some((stats) => stats.teamId === teamId);
        if (!hasTeam) {
          const teamName = teamId === homeTeam.id ? homeTeam.name : awayTeam.name;
          return [...current.teamStats, { ...buildDefaultStats(teamId, teamName), [key]: value }];
        }
        return current.teamStats.map((stats) => (stats.teamId === teamId ? { ...stats, [key]: value } : stats));
      })(),
    }));
  }

  async function saveDetails() {
    if (!form) return;
    await updateMatchDetails.mutateAsync({
      homeScore: form.homeScore,
      awayScore: form.awayScore,
      regularTimeMinutes: Number(form.regularTimeMinutes),
      goalEvents: form.goalEvents.map((goal) => ({
        teamId: goal.teamId,
        playerId: goal.playerId || null,
        scorerName: goal.scorerName || null,
        minuteBase: Number(goal.minuteBase),
        minuteExtra: goal.minuteExtra ? Number(goal.minuteExtra) : null,
        goalType: goal.goalType,
      })),
      teamStats: form.teamStats.map((stats) => ({
        ...stats,
        possessionSeconds: Number(stats.possessionSeconds),
      })),
    });
    setDraftForm(null);
    router.push("/matches");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Match Details"
        description={
          matchDetailsQuery.data.competitionType === "LEAGUE"
            ? `${matchDetailsQuery.data.competition} - League Match`
            : `${matchDetailsQuery.data.competition} - ${matchDetailsQuery.data.round ?? "Round"}`
        }
      />

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xl font-semibold">
              {homeTeam.name} vs {awayTeam.name}
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {formatDateTimeDDMMYYYY(matchDetailsQuery.data.scheduledAt)} - {matchDetailsQuery.data.venue}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canEdit ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-20 text-center"
                  value={form.homeScore}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    mutateForm((current) => ({ ...current, homeScore: Number(value) }));
                  }}
                />
                <span className="text-2xl font-semibold">:</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20 text-center"
                  value={form.awayScore}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    mutateForm((current) => ({ ...current, awayScore: Number(value) }));
                  }}
                />
              </div>
            ) : (
              <p className="text-4xl font-semibold">
                {form.homeScore} : {form.awayScore}
              </p>
            )}
            <Badge variant={getStatusVariant(matchDetailsQuery.data.status)}>{matchDetailsQuery.data.status}</Badge>
          </div>
        </div>

        <FormField
          label="Regular Time Minutes"
          tooltip="Duration used for this specific match. Can be adjusted manually if needed."
          helperText={`Competition default: ${matchDetailsQuery.data.competitionMatchDurationMinutes} min.`}
          readOnly={!canEdit}
        >
          <Input
            type="number"
            min={1}
            max={240}
            value={String(form.regularTimeMinutes)}
            readOnly={!canEdit}
            onChange={(event) => {
              const value = event.currentTarget.value;
              mutateForm((current) => ({ ...current, regularTimeMinutes: Number(value || 0) }));
            }}
          />
        </FormField>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Goal Timeline</h3>
          {canEdit ? (
            <Button
              onClick={() =>
                mutateForm((current) => ({
                  ...current,
                  goalEvents: [
                    ...current.goalEvents,
                    { teamId: homeTeam.id, scorerName: "", minuteBase: 1, minuteExtra: null, goalType: GoalType.OPEN_PLAY },
                  ],
                }))
              }
            >
              Add Goal
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          {form.goalEvents.map((goal, index) => (
            <div key={`${goal.id ?? "new"}-${index}`} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              {canEdit ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FormField label="Team" tooltip="Select the team credited for this goal.">
                    <Select
                      value={goal.teamId}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.map((item, itemIndex) => (itemIndex === index ? { ...item, teamId: value } : item)),
                        }));
                      }}
                    >
                      <option value={homeTeam.id}>{homeTeam.name}</option>
                      <option value={awayTeam.id}>{awayTeam.name}</option>
                    </Select>
                  </FormField>
                  <FormField label="Scorer" tooltip="Player who scored the goal. Choose from roster or enter a manual scorer name.">
                    <Select
                      value={goal.playerId ?? ""}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, playerId: value || null } : item
                          ),
                        }));
                      }}
                    >
                      <option value="">Manual scorer</option>
                      {allPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.fullName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Scorer Name" tooltip="Use this when scorer is not in player list or when manual correction is needed.">
                    <Input
                      placeholder="e.g. Marko Jovanovic"
                      value={goal.scorerName}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, scorerName: value } : item
                          ),
                        }));
                      }}
                    />
                  </FormField>
                  <FormField label="Goal Type / Reason" tooltip="How the goal was scored: open play, penalty, own goal, free kick, etc.">
                    <Select
                      value={goal.goalType}
                      onChange={(event) => {
                        const value = event.currentTarget.value as GoalType;
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, goalType: value } : item
                          ),
                        }));
                      }}
                    >
                      {GOAL_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Minute" tooltip="Regular in-play minute when the goal happened.">
                    <Input
                      type="number"
                      min={1}
                      value={goal.minuteBase}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, minuteBase: Number(value) } : item
                          ),
                        }));
                      }}
                    />
                  </FormField>
                  <FormField label="Extra Minute" tooltip="Stoppage/injury time minute added to base minute, e.g. 45+2 or 90+4.">
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 2"
                      value={goal.minuteExtra ?? ""}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, minuteExtra: value ? Number(value) : null } : item
                          ),
                        }));
                      }}
                    />
                  </FormField>
                  <div className="flex items-end">
                    <Button
                      variant="danger"
                      onClick={() =>
                        mutateForm((current) => ({
                          ...current,
                          goalEvents: current.goalEvents.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="font-medium">
                    {formatGoalMinute(goal.minuteBase, goal.minuteExtra, form.regularTimeMinutes)}
                    {"' "}
                    {goal.scorerName}
                  </p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    {goal.teamId === homeTeam.id ? homeTeam.name : awayTeam.name} - {GOAL_TYPE_OPTIONS.find((option) => option.value === goal.goalType)?.label}
                  </p>
                </div>
              )}
            </div>
          ))}
          {!form.goalEvents.length ? <p style={{ color: "var(--text-secondary)" }}>No goals recorded.</p> : null}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h3 className="text-lg font-semibold">Team Statistics</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField label={`${homeTeam.name} Possession Time (sec)`} tooltip="Raw controlled possession time in seconds. Final percentages are auto-calculated from both teams." readOnly={!canEdit}>
            <Input
              type="number"
              min={0}
              value={homeStats.possessionSeconds}
              readOnly={!canEdit}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setTeamStat(homeTeam.id, "possessionSeconds", Number(value));
              }}
            />
          </FormField>
          <FormField label={`${awayTeam.name} Possession Time (sec)`} tooltip="Raw controlled possession time in seconds. Final percentages are auto-calculated from both teams." readOnly={!canEdit}>
            <Input
              type="number"
              min={0}
              value={awayStats.possessionSeconds}
              readOnly={!canEdit}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setTeamStat(awayTeam.id, "possessionSeconds", Number(value));
              }}
            />
          </FormField>
        </div>

        <div className="space-y-3">
          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="text-right font-semibold">{possession.home}%</div>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                <span className="inline-flex items-center gap-1">
                  Possession (%)
                  <Tooltip content="Computed automatically from possession time values entered above." />
                </span>
              </p>
              <div className="font-semibold">{possession.away}%</div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="h-2 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}>
                <div className="h-2 rounded-full" style={{ width: `${possession.home}%`, marginLeft: `${100 - possession.home}%`, backgroundColor: "var(--primary)" }} />
              </div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                auto
              </span>
              <div className="h-2 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--info) 20%, transparent)" }}>
                <div className="h-2 rounded-full" style={{ width: `${possession.away}%`, backgroundColor: "var(--info)" }} />
              </div>
            </div>
          </div>

          {TEAM_STAT_FIELDS.map((field) => {
            const homeValue = Number(homeStats[field.key]);
            const awayValue = Number(awayStats[field.key]);
            const bars = calculateBarWidths(homeValue, awayValue);

            return (
              <div key={field.key} className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        min={0}
                        value={homeValue}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setTeamStat(homeTeam.id, field.key, Number(value));
                        }}
                        className="ml-auto w-24 text-right"
                      />
                    ) : (
                      <span className="font-semibold">{homeValue}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    <span className="inline-flex items-center gap-1">
                      {field.label}
                      <Tooltip content={statTooltips[field.key] ?? "Statistic value for this team."} />
                    </span>
                  </p>
                  <div>
                    {canEdit ? (
                      <Input
                        type="number"
                        min={0}
                        value={awayValue}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setTeamStat(awayTeam.id, field.key, Number(value));
                        }}
                        className="w-24"
                      />
                    ) : (
                      <span className="font-semibold">{awayValue}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="h-2 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${bars.home}%`, marginLeft: `${100 - bars.home}%`, backgroundColor: "var(--primary)" }} />
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    vs
                  </span>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--info) 20%, transparent)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${bars.away}%`, backgroundColor: "var(--info)" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {canEdit ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm("Reset all match statistics and goal timeline?")) return;
              resetMatchDetails.mutate();
            }}
            disabled={resetMatchDetails.isPending}
          >
            {resetMatchDetails.isPending ? "Resetting..." : "Reset Stats"}
          </Button>
          <Button variant="primary" onClick={() => void saveDetails()} disabled={updateMatchDetails.isPending}>
            {updateMatchDetails.isPending ? "Saving..." : "Save Match Stats"}
          </Button>
        </div>
      ) : (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          You have read-only access for this match.
        </Card>
      )}
    </div>
  );
}
