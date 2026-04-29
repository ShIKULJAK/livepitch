import { FavoriteTargetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { listFavoriteKeys, listFavorites, toggleFavorite } from "@/lib/repositories/favorites";

function isFavoritesStorageMissing(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("favorite") && (message.includes("does not exist") || message.includes("not found") || message.includes("p2021"));
}

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  try {
    if (mode === "keys") {
      const data = await listFavoriteKeys(currentUser.id);
      return NextResponse.json({ data });
    }

    const data = await listFavorites(currentUser.id, currentUser.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    if (isFavoritesStorageMissing(error)) {
      if (mode === "keys") return NextResponse.json({ data: [] });
      return NextResponse.json({ data: { teams: [], matches: [], competitions: [] } });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load favorites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();
  const body = (await request.json()) as { targetType?: FavoriteTargetType; targetId?: string };

  if (!body.targetType || !body.targetId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Ensure target belongs to current organization scope.
  if (body.targetType === FavoriteTargetType.TEAM) {
    const team = await prisma.team.findFirst({ where: { id: body.targetId, organizationId: currentUser.organizationId }, select: { id: true } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (body.targetType === FavoriteTargetType.MATCH) {
    const match = await prisma.match.findFirst({ where: { id: body.targetId, competition: { organizationId: currentUser.organizationId } }, select: { id: true } });
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (body.targetType === FavoriteTargetType.COMPETITION) {
    const competition = await prisma.competition.findFirst({ where: { id: body.targetId, organizationId: currentUser.organizationId }, select: { id: true } });
    if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  try {
    const data = await toggleFavorite(currentUser.id, body.targetType, body.targetId);
    return NextResponse.json({ data });
  } catch (error) {
    if (isFavoritesStorageMissing(error)) {
      return NextResponse.json(
        { error: "Favorites storage is not initialized yet. Run Prisma migration for favorites." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to toggle favorite" }, { status: 500 });
  }
}
