"use client";

import Link from "next/link";
import { useFavorites } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export default function FavoritesPage() {
  const favoritesQuery = useFavorites();

  return (
    <div className="space-y-4">
      <PageHeader title="Favorites" description="Your favorite teams, matches, and competitions." />

      {favoritesQuery.isLoading ? (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading favorites...
        </Card>
      ) : null}

      {favoritesQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(favoritesQuery.error as Error).message}
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h3 className="text-lg font-semibold">Favorite Teams</h3>
        <div className="space-y-2">
          {favoritesQuery.data?.teams.length ? (
            favoritesQuery.data.teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`} className="block rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                {team.name}
              </Link>
            ))
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No favorite teams yet.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-lg font-semibold">Favorite Matches</h3>
        <div className="space-y-2">
          {favoritesQuery.data?.matches.length ? (
            favoritesQuery.data.matches.map((match) => (
              <Link key={match.id} href={`/matches/${match.id}`} className="block rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                {match.homeTeam.name} vs {match.awayTeam.name} - {match.competition.name}
              </Link>
            ))
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No favorite matches yet.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-lg font-semibold">Favorite Competitions</h3>
        <div className="space-y-2">
          {favoritesQuery.data?.competitions.length ? (
            favoritesQuery.data.competitions.map((competition) => (
              <Link key={competition.id} href={`/matches?competitionId=${competition.id}`} className="block rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                {competition.name}
              </Link>
            ))
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No favorite competitions yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
