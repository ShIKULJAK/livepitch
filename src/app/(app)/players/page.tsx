"use client";

import Link from "next/link";
import { useDeletePlayer, usePlayers, useTeams } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { canCreatePlayers, canEditEntity } from "@/lib/permissions";

function getPlayerInitials(firstName?: string | null, lastName?: string | null, fullName?: string | null) {
  const fn = firstName?.trim();
  const ln = lastName?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();

  const parts = (fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return "IG";
}

export default function PlayersPage() {
  const { t } = useI18n();
  const playersQuery = usePlayers();
  const teamsQuery = useTeams();
  const { user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const canCreate = canCreatePlayers(user?.role);
  const deletePlayer = useDeletePlayer();

  const teamOptions = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .map((team) => ({ id: team.id, name: team.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQuery.data]
  );

  const positionOptions = useMemo(
    () =>
      Array.from(
        new Set((playersQuery.data ?? []).map((player) => player.position.trim()).filter((position) => position.length > 0))
      ).sort((a, b) => a.localeCompare(b)),
    [playersQuery.data]
  );

  const rows = useMemo(
    () =>
      (playersQuery.data ?? []).filter((player) => {
        const matchesQuery = player.fullName.toLowerCase().includes(query.toLowerCase().trim());
        const matchesTeam = teamFilter === "ALL" || player.teamId === teamFilter;
        const matchesPosition = positionFilter === "ALL" || player.position === positionFilter;
        return matchesQuery && matchesTeam && matchesPosition;
      }),
    [playersQuery.data, query, teamFilter, positionFilter, teamsQuery.data]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("players.title")}
        description={t("players.description")}
        actions={
          canCreate ? (
            <Link href="/players/create">
              <Button variant="primary">Create Player</Button>
            </Link>
          ) : null
        }
      />
      <FilterBar>
        <Input placeholder={t("common.search")} className="max-w-sm" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <Select className="w-44" value={teamFilter} onChange={(event) => setTeamFilter(event.currentTarget.value)}>
          <option value="ALL">All Teams</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
        <Select className="w-44" value={positionFilter} onChange={(event) => setPositionFilter(event.currentTarget.value)}>
          <option value="ALL">All Positions</option>
          {positionOptions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto lp-scrollbar">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>{["Player", "Team", "Pos", "Age", "Number", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((player) => (
                (() => {
                  const canEditRow = canEditEntity(user, player);
                  return (
                <tr key={player.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {player.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.profileImageUrl}
                          alt={player.fullName}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full border object-cover"
                          style={{ borderColor: "var(--border)" }}
                        />
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                        >
                          {getPlayerInitials(player.firstName, player.lastName, player.fullName)}
                        </span>
                      )}
                      <span className="font-medium">{player.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{player.team}</td>
                  <td className="px-4 py-3">{player.position}</td>
                  <td className="px-4 py-3">{player.age ?? ""}</td>
                  <td className="px-4 py-3">{player.number ?? ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/players/${player.id}`} style={{ color: "var(--primary)" }}>{t("common.open")}</Link>
                      {canEditRow ? (
                        <>
                          <Link href={`/players/${player.id}/edit`} style={{ color: "var(--info)" }}>
                            Edit
                          </Link>
                          <button
                            type="button"
                            style={{ color: "var(--danger)" }}
                            onClick={() => {
                              if (!window.confirm(`Delete ${player.fullName}?`)) return;
                              deletePlayer.mutate(player.id);
                            }}
                            disabled={deletePlayer.isPending}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {playersQuery.isLoading ? <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>{t("players.loading")}</Card> : null}
      {playersQuery.isError ? <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>{(playersQuery.error as Error).message}</Card> : null}
    </div>
  );
}
