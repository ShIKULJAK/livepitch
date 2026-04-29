import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    await markNotificationRead(id, currentUser.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("notification")) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to mark notification read" }, { status: 500 });
  }
}
