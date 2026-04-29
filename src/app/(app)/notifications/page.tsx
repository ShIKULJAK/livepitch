"use client";

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatDateTimeStable } from "@/lib/utils/date";

export default function NotificationsPage() {
  const router = useRouter();
  const notificationsQuery = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="All your notifications in one place."
        actions={
          <Button onClick={() => markAll.mutate()} disabled={markAll.isPending || (notificationsQuery.data?.unreadCount ?? 0) === 0}>
            Mark all as read
          </Button>
        }
      />

      <Card className="space-y-2 p-4">
        {notificationsQuery.data?.notifications.length ? (
          notificationsQuery.data.notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className="w-full rounded-xl border p-3 text-left"
              style={{
                borderColor: "var(--border)",
                backgroundColor: notification.isRead
                  ? "var(--surface-1)"
                  : "color-mix(in srgb, var(--primary) 10%, var(--surface-2))",
              }}
              onClick={async () => {
                if (!notification.isRead) await markOne.mutateAsync(notification.id);
                router.push(notification.link);
              }}
            >
              <p className="font-semibold">{notification.title}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {notification.body}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {formatDateTimeStable(notification.createdAt)}
              </p>
            </button>
          ))
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No notifications yet.
          </p>
        )}
      </Card>
    </div>
  );
}
