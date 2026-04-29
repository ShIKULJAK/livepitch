import { MatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageMatches } from "@/lib/permissions";
import { createMatch as createMatchRecord } from "@/lib/repositories/matches";
import { listMatches } from "@/lib/server/competitions";
import { matchInputSchema } from "@/lib/validation/match";

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const requestUrl = new URL(request.url);
  const rawStatus = requestUrl.searchParams.get("status");
  const status = rawStatus && rawStatus in MatchStatus ? (rawStatus as MatchStatus) : null;
  const competitionId = requestUrl.searchParams.get("competitionId");

  const data = await listMatches(currentUser.organizationId, {
    status: status ?? undefined,
    competitionId: competitionId ?? undefined,
  });

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();

  if (!canManageMatches(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = matchInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = await createMatchRecord(currentUser.organizationId, parsed.data);
  return NextResponse.json({ data }, { status: 201 });
}

