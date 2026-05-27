import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listDrawCompetitions } from "@/lib/repositories/draws";

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const url = new URL(request.url);
  const seasonYear = url.searchParams.get("seasonYear") ?? undefined;
  const data = await listDrawCompetitions(currentUser.organizationId, seasonYear);
  return NextResponse.json({ data });
}
