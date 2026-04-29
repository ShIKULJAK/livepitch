import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { listMessageThreads, sendMessage } from "@/lib/server/messages";

const sendMessageSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listMessageThreads(currentUser.id);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();
  const body = await request.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = await sendMessage({
    threadId: parsed.data.threadId,
    senderId: currentUser.id,
    body: parsed.data.body,
  });

  return NextResponse.json({ data }, { status: 201 });
}

