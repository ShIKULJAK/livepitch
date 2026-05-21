import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { approveTeamApplicationGenerations } from "@/lib/server/team-applications";
import { approveTeamApplicationSchema } from "@/lib/validation/team-application";

export async function POST(request: Request) {
  const currentUser = await requireAuth();
  const body = await request.json();
  const parsed = approveTeamApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const competitionId = new URL(request.url).searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId is required" }, { status: 400 });
  }

  try {
    const data = await approveTeamApplicationGenerations(
      currentUser.organizationId,
      { id: currentUser.id, role: currentUser.role },
      competitionId,
      parsed.data
    );
    if (!data) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
