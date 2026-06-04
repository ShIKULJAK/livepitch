"use client";

import Link from "next/link";
import { useDeleteTeam, useTeams } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { canCreateTeams, canEditEntity } from "@/lib/permissions";
import { FavoriteTargetType } from "@prisma/client";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { TeamAvatar } from "@/components/teams/team-identity";

export default function TeamsPage() {
  const { t } = useI18n();
  const teamsQuery = useTeams();
  const { user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const canCreate = canCreateTeams(user?.role);
  const deleteTeam = useDeleteTeam();

  const rows = useMemo(
    () => (teamsQuery.data ?? []).filter((team) => team.name.toLowerCase().includes(query.toLowerCase())),
    [teamsQuery.data, query]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("teams.title")}
        description={t("teams.description")}
        actions={
          canCreate ? (
            <Link href="/teams/create">
              <Button variant="primary">Create Team</Button>
            </Link>
          ) : null
        }
      />
      <FilterBar>
        <Input placeholder={t("common.search")} className="max-w-sm" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto lp-scrollbar">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>{["#", t("table.team"), t("table.tournament"), t("table.played"), "W/D/L", t("table.goals"), t("table.points"), t("table.action")].map((h) => <th key={h} className="px-4 py-3 text-center text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((team, index) => (
                (() => {
                  const canEditRow = canEditEntity(user, team);
                  return (
                <tr key={team.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 text-center">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FavoriteButton targetType={FavoriteTargetType.TEAM} targetId={team.id} />
                      <TeamAvatar name={team.name} profileImageUrl={team.profileImageUrl} size="sm" />
                      <span className="font-medium">{team.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{team.competition ?? "-"}</td>
                  <td className="px-4 py-3 text-center">{team.played}</td>
                  <td className="px-4 py-3 text-center">{team.wins}/{team.draws}/{team.losses}</td>
                  <td className="px-4 py-3 text-center">{team.goalsFor}:{team.goalsAgainst}</td>
                  <td className="px-4 py-3 text-center" style={{ color: "var(--primary)" }}>{team.points}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3">
                      <Link href={`/teams/${team.id}`} style={{ color: "var(--primary)" }}>{t("common.open")}</Link>
                      {canEditRow ? (
                        <>
                          <Link href={`/teams/${team.id}/edit`} style={{ color: "var(--info)" }}>
                            Edit
                          </Link>
                          <button
                            type="button"
                            style={{ color: "var(--danger)" }}
                            onClick={() => {
                              if (!window.confirm(`Delete ${team.name}?`)) return;
                              deleteTeam.mutate(team.id);
                            }}
                            disabled={deleteTeam.isPending}
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

      {teamsQuery.isLoading ? <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>{t("teams.loading")}</Card> : null}
      {teamsQuery.isError ? <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>{(teamsQuery.error as Error).message}</Card> : null}
    </div>
  );
}
