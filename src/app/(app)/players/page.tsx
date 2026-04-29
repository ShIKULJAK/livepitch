"use client";

import Link from "next/link";
import { useDeletePlayer, usePlayers } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { canEditContent } from "@/lib/permissions";

export default function PlayersPage() {
  const { t } = useI18n();
  const playersQuery = usePlayers();
  const { user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const canCreate = canEditContent(user?.role);
  const deletePlayer = useDeletePlayer();

  const rows = useMemo(
    () => (playersQuery.data ?? []).filter((player) => player.fullName.toLowerCase().includes(query.toLowerCase())),
    [playersQuery.data, query]
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
        <Select className="w-44"><option>All Teams</option></Select>
        <Select className="w-44"><option>All Positions</option></Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto lp-scrollbar">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>{["Player", "Team", "Pos", "Age", "Number", "Action"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((player) => (
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
                          {`${player.firstName?.[0] ?? ""}${player.lastName?.[0] ?? ""}`.toUpperCase() || player.fullName.slice(0, 2).toUpperCase()}
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
                      {canCreate ? (
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
