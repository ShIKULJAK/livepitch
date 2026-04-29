import { prisma } from "@/lib/db/prisma";
import { notifyMessageReceived } from "@/lib/notifications";

export async function listMessageThreads(userId: string) {
  const threads = await prisma.messageThread.findMany({
    include: {
      messages: {
        include: {
          sender: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return threads.map((thread) => {
    const last = thread.messages[thread.messages.length - 1];
    return {
      id: thread.id,
      name: thread.subject,
      preview: last?.body ?? "No messages yet",
      updatedAt: (last?.createdAt ?? thread.updatedAt).toISOString(),
      unread: 0,
      messages: thread.messages.map((message) => ({
        id: message.id,
        sender: message.sender?.name ?? "Unknown",
        content: message.body,
        timestamp: message.createdAt.toISOString(),
        mine: message.senderId === userId,
      })),
    };
  });
}

export async function sendMessage(input: { threadId: string; senderId: string; body: string }) {
  const [message, sender] = await Promise.all([
    prisma.message.create({
      data: {
        threadId: input.threadId,
        senderId: input.senderId,
        body: input.body,
      },
    }),
    prisma.user.findUnique({ where: { id: input.senderId }, select: { id: true, name: true, organizationId: true } }),
  ]);

  await prisma.messageThread.update({
    where: { id: input.threadId },
    data: { updatedAt: new Date() },
  });

  if (sender) {
    const recipients = await prisma.user.findMany({
      where: { organizationId: sender.organizationId, id: { not: sender.id } },
      select: { id: true },
    });

    await notifyMessageReceived({
      senderId: sender.id,
      senderName: sender.name,
      threadId: input.threadId,
      recipientUserIds: recipients.map((item) => item.id),
    });
  }

  return message;
}
