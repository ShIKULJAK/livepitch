import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listDrawCompetitions } from "@/lib/repositories/draws";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listDrawCompetitions(currentUser.organizationId);
  return NextResponse.json({ data });
}
