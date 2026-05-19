import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreateCompetitions } from "@/lib/permissions";
import { getSeasonTeamPlayerRegistrations, saveSeasonTeamPlayerRegistrations } from "@/lib/server/competitions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id } = await params;
  const data = await getSeasonTeamPlayerRegistrations(currentUser.organizationId, id);
  if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateCompetitions(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { teamId?: string; playerIds?: string[] };
  if (!body.teamId || !Array.isArray(body.playerIds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const data = await saveSeasonTeamPlayerRegistrations(
      currentUser.organizationId,
      id,
      { id: currentUser.id, role: currentUser.role },
      body.teamId,
      body.playerIds
    );
    if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 400 });
  }
}
