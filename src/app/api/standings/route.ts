import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listStandings } from "@/lib/server/competitions";

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const competitionId = searchParams.get("competitionId") ?? undefined;
  const data = await listStandings(currentUser.organizationId, competitionId);
  return NextResponse.json({ data });
}
