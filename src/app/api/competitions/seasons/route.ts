import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listCompetitionSeasons } from "@/lib/server/competitions";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listCompetitionSeasons(currentUser.organizationId);
  return NextResponse.json({ data });
}
