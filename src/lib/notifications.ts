import { FavoriteTargetType, NotificationEntityType, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatGoalMinute } from "@/lib/constants/match";

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  dedupeKey?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  } catch {
    // Avoid breaking core user actions on duplicate/edge notification failures.
    return null;
  }
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function getUserNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true } });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function notifyMessageReceived(input: {
  senderId: string;
  senderName: string;
  threadId: string;
  recipientUserIds: string[];
}) {
  const uniqueRecipients = Array.from(new Set(input.recipientUserIds.filter((id) => id && id !== input.senderId)));
  if (!uniqueRecipients.length) return;

  await Promise.all(
    uniqueRecipients.map((userId) =>
      createNotification({
        userId,
        type: NotificationType.MESSAGE_RECEIVED,
        title: "New message",
        body: `You received a new message from ${input.senderName}`,
        link: `/messages?threadId=${input.threadId}`,
        entityType: NotificationEntityType.MESSAGE_THREAD,
        entityId: input.threadId,
      })
    )
  );
}

export async function notifyFavoriteMatchFinished(input: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}) {
  const favorites = await prisma.favorite.findMany({
    where: {
      targetType: FavoriteTargetType.MATCH,
      targetId: input.matchId,
    },
    select: { userId: true },
  });

  if (!favorites.length) return;

  const bodyScore =
    input.homeScore !== null && input.awayScore !== null
      ? `${input.homeTeam} ${input.homeScore} : ${input.awayScore} ${input.awayTeam}`
      : `${input.homeTeam} vs ${input.awayTeam}`;

  await Promise.all(
    favorites.map((favorite) =>
      createNotification({
        userId: favorite.userId,
        type: NotificationType.FAVORITE_MATCH_FINISHED,
        title: "Favorite match finished",
        body: bodyScore,
        link: `/matches/${input.matchId}`,
        entityType: NotificationEntityType.MATCH,
        entityId: input.matchId,
        dedupeKey: `match-finished:${input.matchId}`,
      })
    )
  );
}

export async function notifyFavoriteMatchGoal(input: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  teamName: string;
  scorerName: string;
  minuteBase: number;
  minuteExtra?: number | null;
  regularTimeMinutes?: number;
  dedupeSuffix: string;
}) {
  const favorites = await prisma.favorite.findMany({
    where: {
      targetType: FavoriteTargetType.MATCH,
      targetId: input.matchId,
    },
    select: { userId: true },
  });

  if (!favorites.length) return;

  const minute = `${formatGoalMinute(input.minuteBase, input.minuteExtra, input.regularTimeMinutes ?? 90)}'`;
  const body = `${input.scorerName} scored for ${input.teamName} in ${input.homeTeam} vs ${input.awayTeam} at ${minute}`;

  await Promise.all(
    favorites.map((favorite) =>
      createNotification({
        userId: favorite.userId,
        type: NotificationType.FAVORITE_MATCH_GOAL,
        title: "Goal in favorite match",
        body,
        link: `/matches/${input.matchId}`,
        entityType: NotificationEntityType.MATCH,
        entityId: input.matchId,
        dedupeKey: `match-goal:${input.matchId}:${input.dedupeSuffix}`,
      })
    )
  );
}
