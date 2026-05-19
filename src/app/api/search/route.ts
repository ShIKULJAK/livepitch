import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { globalSearch } from "@/lib/server/search";

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const data = await globalSearch(currentUser.organizationId, q);
  return NextResponse.json({ data });
}
