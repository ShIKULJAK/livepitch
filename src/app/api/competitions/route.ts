import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageTournaments } from "@/lib/permissions";
import { createCompetition, listCompetitions } from "@/lib/server/competitions";
import { competitionQuerySchema, createCompetitionSchema } from "@/lib/validation/competition";

export async function GET(request: Request) {
  const currentUser = await requireAuth();

  const { searchParams } = new URL(request.url);
  const parsed = competitionQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filters", issues: parsed.error.issues }, { status: 400 });
  }

  const data = await listCompetitions(currentUser.organizationId, parsed.data);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canManageTournaments(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCompetitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
    }

    const created = await createCompetition(currentUser.organizationId, parsed.data);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
