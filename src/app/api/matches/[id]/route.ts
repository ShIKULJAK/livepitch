import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreateMatches } from "@/lib/permissions";
import { deleteMatch, updateMatch } from "@/lib/repositories/matches";
import { matchUpdateSchema } from "@/lib/validation/match";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreateMatches(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = matchUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  let data = null;
  try {
    data = await updateMatch(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreateMatches(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let data = null;
  try {
    data = await deleteMatch(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

