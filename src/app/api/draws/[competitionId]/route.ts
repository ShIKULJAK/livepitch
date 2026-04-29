import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateDraw, getDrawByCompetition, resetDraw } from "@/lib/repositories/draws";
import { canManageTournaments } from "@/lib/permissions";
import { drawConfigSchema } from "@/lib/validation/draw";

export async function GET(_: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  const { competitionId } = await params;
  const data = await getDrawByCompetition(currentUser.organizationId, competitionId);

  if (!data) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canManageTournaments(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = drawConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { competitionId } = await params;
  try {
    const draw = await generateDraw(currentUser.organizationId, competitionId, parsed.data);
    if (!draw) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    return NextResponse.json({ data: draw }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  return POST(request, { params });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canManageTournaments(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { competitionId } = await params;
  const data = await resetDraw(currentUser.organizationId, competitionId);
  if (!data) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
