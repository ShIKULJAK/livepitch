import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listApplicableCompetitions,
  listCompetitionTeamGenerationParticipants,
  listTeamApplicationsForCompetition,
  submitTeamApplication,
} from "@/lib/server/team-applications";
import { teamApplicationInputSchema, teamApplicationQuerySchema } from "@/lib/validation/team-application";

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const competitionId = searchParams.get("competitionId") ?? undefined;
  const mode = searchParams.get("mode") ?? undefined;

  if (mode === "participants" && competitionId) {
    const data = await listCompetitionTeamGenerationParticipants(currentUser.organizationId, competitionId);
    if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    return NextResponse.json({ data });
  }

  if (competitionId) {
    const data = await listTeamApplicationsForCompetition(currentUser.organizationId, competitionId);
    if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    return NextResponse.json({ data });
  }

  const parsed = teamApplicationQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    sport: searchParams.get("sport") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filters", issues: parsed.error.issues }, { status: 400 });
  }
  const data = await listApplicableCompetitions(currentUser.organizationId, parsed.data);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();
  const body = await request.json();
  const parsed = teamApplicationInputSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: firstIssue, issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const data = await submitTeamApplication(currentUser.organizationId, currentUser.id, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
