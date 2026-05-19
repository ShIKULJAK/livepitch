import { prisma } from "@/lib/db/prisma";

export type GlobalSearchResultType = "COMPETITION" | "TEAM" | "MATCH" | "PLAYER" | "VENUE";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle: string;
  link: string;
};

export async function globalSearch(organizationId: string, rawQuery: string) {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const [competitions, teams, players, matches, venues] = await Promise.all([
    prisma.competition.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { season: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { season: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.team.findMany({
      where: {
        organizationId,
        OR: [{ name: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }],
      },
      orderBy: { name: "asc" },
      take: 4,
    }),
    prisma.player.findMany({
      where: {
        team: { organizationId },
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { team: { select: { name: true } } },
      orderBy: { fullName: "asc" },
      take: 4,
    }),
    prisma.match.findMany({
      where: {
        competition: { organizationId },
        OR: [
          { homeTeam: { name: { contains: query, mode: "insensitive" } } },
          { awayTeam: { name: { contains: query, mode: "insensitive" } } },
          { competition: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 4,
    }),
    prisma.venue.findMany({
      where: {
        organizationId,
        OR: [{ name: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }],
      },
      orderBy: { name: "asc" },
      take: 3,
    }),
  ]);

  const results: GlobalSearchResult[] = [
    ...competitions.map((competition) => ({
      id: competition.id,
      type: "COMPETITION" as const,
      title: competition.name,
      subtitle: `${competition.type}${competition.season?.name ? ` • ${competition.season.name}` : ""}`,
      link: `/draws/${competition.id}`,
    })),
    ...teams.map((team) => ({
      id: team.id,
      type: "TEAM" as const,
      title: team.name,
      subtitle: [team.city, team.country].filter(Boolean).join(", ") || team.sport,
      link: `/teams/${team.id}`,
    })),
    ...matches.map((match) => ({
      id: match.id,
      type: "MATCH" as const,
      title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      subtitle: `${match.status}${match.homeScore !== null && match.awayScore !== null ? ` • ${match.homeScore}:${match.awayScore}` : ""}`,
      link: `/matches/${match.id}`,
    })),
    ...players.map((player) => ({
      id: player.id,
      type: "PLAYER" as const,
      title: player.fullName,
      subtitle: `${player.position} • ${player.team.name}`,
      link: `/players/${player.id}`,
    })),
    ...venues.map((venue) => ({
      id: venue.id,
      type: "VENUE" as const,
      title: venue.name,
      subtitle: [venue.city, venue.country].filter(Boolean).join(", "),
      link: "/venues",
    })),
  ];

  return results.slice(0, 12);
}
