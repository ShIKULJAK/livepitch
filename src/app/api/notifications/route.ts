import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUnreadNotificationCount, getUserNotifications, markAllNotificationsRead } from "@/lib/notifications";

function isNotificationsStorageMissing(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("notification") && (message.includes("does not exist") || message.includes("not found") || message.includes("p2021"));
}

export async function GET() {
  try {
    const currentUser = await requireAuth();
    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(currentUser.id, 40),
      getUnreadNotificationCount(currentUser.id),
    ]);

    return NextResponse.json({ data: { notifications, unreadCount } });
  } catch (error) {
    if (isNotificationsStorageMissing(error)) {
      return NextResponse.json({ data: { notifications: [], unreadCount: 0 } });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load notifications" }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const currentUser = await requireAuth();
    await markAllNotificationsRead(currentUser.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotificationsStorageMissing(error)) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to mark notifications read" }, { status: 500 });
  }
}
