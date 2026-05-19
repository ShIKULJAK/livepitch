import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreatePlayers } from "@/lib/permissions";
import { deletePlayer, updatePlayer } from "@/lib/repositories/players";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { playerUpdateSchema } from "@/lib/validation/player";

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
    };
  } else {
    payload = await request.json();
  }

  const parsed = playerUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;

  try {
    const data = await updatePlayer(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id, parsed.data);
    if (!data) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
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
