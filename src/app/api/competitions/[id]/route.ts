import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreateCompetitions, canEditEntity } from "@/lib/permissions";
import { deleteCompetition, getCompetitionById, updateCompetition } from "@/lib/server/competitions";
import { updateCompetitionSchema } from "@/lib/validation/competition";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id } = await params;

  const competition = await getCompetitionById(currentUser.organizationId, id);
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      ...competition,
      canEdit: canEditEntity({ id: currentUser.id, role: currentUser.role }, competition),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateCompetitions(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateCompetitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  let updated = null;
  try {
    updated = await updateCompetition(id, currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  if (!updated) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateCompetitions(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let deleted = null;
  try {
    deleted = await deleteCompetition(id, currentUser.organizationId, { id: currentUser.id, role: currentUser.role });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  if (!deleted) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
