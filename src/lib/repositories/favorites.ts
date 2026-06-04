import { FavoriteTargetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function listFavorites(userId: string, organizationId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const teamIds = favorites.filter((f) => f.targetType === FavoriteTargetType.TEAM).map((f) => f.targetId);
  const matchIds = favorites.filter((f) => f.targetType === FavoriteTargetType.MATCH).map((f) => f.targetId);
  const competitionIds = favorites.filter((f) => f.targetType === FavoriteTargetType.COMPETITION).map((f) => f.targetId);

  const [teams, matches, competitions] = await Promise.all([
    teamIds.length
      ? prisma.team.findMany({
          where: { id: { in: teamIds }, organizationId },
          select: { id: true, name: true, profileImageUrl: true },
        })
      : Promise.resolve([]),
    matchIds.length
      ? prisma.match.findMany({
          where: { id: { in: matchIds }, competition: { organizationId } },
          include: {
            competition: { select: { id: true, name: true } },
            homeTeam: { select: { id: true, name: true, profileImageUrl: true } },
            awayTeam: { select: { id: true, name: true, profileImageUrl: true } },
          },
        })
      : Promise.resolve([]),
    competitionIds.length
      ? prisma.competition.findMany({
          where: { id: { in: competitionIds }, organizationId },
          select: { id: true, name: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  const teamMap = new Map(teams.map((item) => [item.id, item]));
  const matchMap = new Map(matches.map((item) => [item.id, item]));
  const competitionMap = new Map(competitions.map((item) => [item.id, item]));

  return {
    teams: favorites
      .filter((item) => item.targetType === FavoriteTargetType.TEAM)
      .map((item) => teamMap.get(item.targetId))
      .filter(Boolean),
    matches: favorites
      .filter((item) => item.targetType === FavoriteTargetType.MATCH)
      .map((item) => matchMap.get(item.targetId))
      .filter(Boolean),
    competitions: favorites
      .filter((item) => item.targetType === FavoriteTargetType.COMPETITION)
      .map((item) => competitionMap.get(item.targetId))
      .filter(Boolean),
  };
}

export async function listFavoriteKeys(userId: string) {
  const favorites = await prisma.favorite.findMany({ where: { userId }, select: { targetType: true, targetId: true } });
  return favorites.map((item) => ({ targetType: item.targetType, targetId: item.targetId }));
}

export async function toggleFavorite(userId: string, targetType: FavoriteTargetType, targetId: string) {
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_targetType_targetId: {
        userId,
        targetType,
        targetId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favorite.create({ data: { userId, targetType, targetId } });
  return { favorited: true };
}
