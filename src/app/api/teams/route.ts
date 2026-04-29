import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageTeams } from "@/lib/permissions";
import { createTeam as createTeamRecord } from "@/lib/repositories/teams";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { listTeams } from "@/lib/server/competitions";
import { teamInputSchema } from "@/lib/validation/team";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listTeams(currentUser.organizationId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();

  if (!canManageTeams(currentUser.role)) {
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
        const processed = await processAndStoreProfileImage(image, "teams");
        profileImageUrl = processed.url;
      } catch (error) {
        if (error instanceof ImageProcessingError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    payload = {
      sport: formData.get("sport"),
      name: formData.get("name"),
      shortName: formData.get("shortName") || null,
      city: formData.get("city") || null,
      country: formData.get("country") || null,
      coach: formData.get("coach") || null,
      profileImageUrl,
    };
  } else {
    payload = await request.json();
  }

  const parsed = teamInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = await createTeamRecord(currentUser.organizationId, parsed.data);
  return NextResponse.json({ data }, { status: 201 });
}

