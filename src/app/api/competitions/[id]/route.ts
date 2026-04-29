import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageTournaments } from "@/lib/permissions";
import { deleteCompetition, getCompetitionById, updateCompetition } from "@/lib/server/competitions";
import { updateCompetitionSchema } from "@/lib/validation/competition";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id } = await params;

  const competition = await getCompetitionById(currentUser.organizationId, id);
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  return NextResponse.json({ data: competition });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  if (!canManageTournaments(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateCompetitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await updateCompetition(id, currentUser.organizationId, parsed.data);
  if (!updated) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  if (!canManageTournaments(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await deleteCompetition(id, currentUser.organizationId);
  if (!deleted) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
