import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateDraw, getDrawByCompetition, resetDraw } from "@/lib/repositories/draws";
import { canCreateDraws, canEditEntity } from "@/lib/permissions";
import { drawConfigSchema } from "@/lib/validation/draw";

export async function GET(_: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  const { competitionId } = await params;
  const data = await getDrawByCompetition(currentUser.organizationId, competitionId);

  if (!data) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...data,
      canManage: canEditEntity({ id: currentUser.id, role: currentUser.role }, data.competition),
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateDraws(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = drawConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { competitionId } = await params;
  try {
    const draw = await generateDraw(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, competitionId, parsed.data);
    if (!draw) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    return NextResponse.json({ data: draw }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  return POST(request, { params });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateDraws(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { competitionId } = await params;
  let data = null;
  try {
    data = await resetDraw(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, competitionId);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  if (!data) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
