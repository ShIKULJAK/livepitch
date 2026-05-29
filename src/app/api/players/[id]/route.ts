import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreatePlayers } from "@/lib/permissions";
import { deletePlayer, updatePlayer, updatePlayerClubHistory } from "@/lib/repositories/players";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { playerHistoryPatchSchema, playerUpdateSchema } from "@/lib/validation/player";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreatePlayers(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let payload: unknown;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const image = formData.get("profileImage");
    let profileImageUrl: string | undefined;

    if (image instanceof File && image.size > 0) {
      try {
        const processed = await processAndStoreProfileImage(image, "players");
        profileImageUrl = processed.url;
      } catch (error) {
        if (error instanceof ImageProcessingError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const rawNationalities = formData.get("nationalities");
    const rawAchievements = formData.get("achievements");
    const rawStrengths = formData.get("strengths");
    const rawImprovements = formData.get("improvements");
    const rawClubHistory = formData.get("clubHistory");
    let parsedClubHistory: unknown = undefined;
    if (typeof rawClubHistory === "string" && rawClubHistory.trim().length) {
      try {
        parsedClubHistory = JSON.parse(rawClubHistory);
      } catch {
        parsedClubHistory = undefined;
      }
    }
    payload = {
      sport: formData.get("sport") || undefined,
      teamId: formData.get("teamId") || undefined,
      firstName: formData.get("firstName") || undefined,
      lastName: formData.get("lastName") || undefined,
      position: formData.get("position") || undefined,
      number: formData.get("number") ? Number(formData.get("number")) : undefined,
      dateOfBirth: formData.get("dateOfBirth") || undefined,
      placeOfBirth: formData.get("placeOfBirth") || undefined,
      nationalities:
        typeof rawNationalities === "string" ? rawNationalities.split("|").map((item) => item.trim()).filter(Boolean) : undefined,
      heightCm: formData.get("heightCm") ? Number(formData.get("heightCm")) : undefined,
      weightKg: formData.get("weightKg") ? Number(formData.get("weightKg")) : undefined,
      status: formData.get("status") || undefined,
      dominantFoot: formData.get("dominantFoot") || undefined,
      profileImageUrl,
      bio: formData.get("bio") || undefined,
      radarDefending: formData.get("radarDefending") ? Number(formData.get("radarDefending")) : undefined,
      radarPhysical: formData.get("radarPhysical") ? Number(formData.get("radarPhysical")) : undefined,
      radarSpeed: formData.get("radarSpeed") ? Number(formData.get("radarSpeed")) : undefined,
      radarPassing: formData.get("radarPassing") ? Number(formData.get("radarPassing")) : undefined,
      radarGameIQ: formData.get("radarGameIQ") ? Number(formData.get("radarGameIQ")) : undefined,
      achievements:
        typeof rawAchievements === "string" ? rawAchievements.split("|").map((item) => item.trim()).filter(Boolean) : undefined,
      strengths:
        typeof rawStrengths === "string" ? rawStrengths.split("|").map((item) => item.trim()).filter(Boolean) : undefined,
      improvements:
        typeof rawImprovements === "string" ? rawImprovements.split("|").map((item) => item.trim()).filter(Boolean) : undefined,
      coachNote: formData.get("coachNote") || undefined,
      clubHistory: parsedClubHistory,
    };
  } else {
    payload = await request.json();
  }

  const parsedPlayer = playerUpdateSchema.safeParse(payload);
  const parsedHistory = playerHistoryPatchSchema.safeParse(payload);
  if (!parsedPlayer.success || !parsedHistory.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: [...(parsedPlayer.success ? [] : parsedPlayer.error.issues), ...(parsedHistory.success ? [] : parsedHistory.error.issues)],
      },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const data = await updatePlayer(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id, parsedPlayer.data);
    if (!data) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (parsedHistory.data.clubHistory?.length) {
      await updatePlayerClubHistory(
        currentUser.organizationId,
        { id: currentUser.id, role: currentUser.role },
        id,
        parsedHistory.data.clubHistory
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreatePlayers(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let data = null;
  try {
    data = await deletePlayer(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  if (!data) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
