import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreatePlayers } from "@/lib/permissions";
import { createPlayer as createPlayerRecord } from "@/lib/repositories/players";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { listPlayers } from "@/lib/server/competitions";
import { playerInputSchema } from "@/lib/validation/player";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listPlayers(currentUser.organizationId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();

  if (!canCreatePlayers(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let payload: unknown;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const image = formData.get("profileImage");
    let profileImageUrl: string | null = null;

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
    payload = {
      sport: formData.get("sport"),
      teamId: formData.get("teamId"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      position: formData.get("position"),
      number: Number(formData.get("number")),
      dateOfBirth: formData.get("dateOfBirth"),
      placeOfBirth: formData.get("placeOfBirth"),
      nationalities: typeof rawNationalities === "string" ? rawNationalities.split("|").filter(Boolean) : [],
      heightCm: Number(formData.get("heightCm")),
      weightKg: Number(formData.get("weightKg")),
      status: formData.get("status"),
      dominantFoot: formData.get("dominantFoot"),
      profileImageUrl,
      bio: formData.get("bio") || null,
      radarDefending: formData.get("radarDefending") ? Number(formData.get("radarDefending")) : null,
      radarPhysical: formData.get("radarPhysical") ? Number(formData.get("radarPhysical")) : null,
      radarSpeed: formData.get("radarSpeed") ? Number(formData.get("radarSpeed")) : null,
      radarPassing: formData.get("radarPassing") ? Number(formData.get("radarPassing")) : null,
      radarGameIQ: formData.get("radarGameIQ") ? Number(formData.get("radarGameIQ")) : null,
      achievements: typeof rawAchievements === "string" ? rawAchievements.split("|").map((item) => item.trim()).filter(Boolean) : [],
      strengths: typeof rawStrengths === "string" ? rawStrengths.split("|").map((item) => item.trim()).filter(Boolean) : [],
      improvements: typeof rawImprovements === "string" ? rawImprovements.split("|").map((item) => item.trim()).filter(Boolean) : [],
      coachNote: formData.get("coachNote") || null,
    };
  } else {
    payload = await request.json();
  }

  const parsed = playerInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = await createPlayerRecord(currentUser.organizationId, currentUser.id, parsed.data);
  return NextResponse.json({ data }, { status: 201 });
}
