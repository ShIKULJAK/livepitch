import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageTeams } from "@/lib/permissions";
import { deleteTeam, updateTeam } from "@/lib/repositories/teams";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { teamUpdateSchema } from "@/lib/validation/team";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canManageTeams(currentUser.role)) {
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
      sport: formData.get("sport") || undefined,
      name: formData.get("name") || undefined,
      shortName: formData.get("shortName") || undefined,
      city: formData.get("city") || undefined,
      country: formData.get("country") || undefined,
      coach: formData.get("coach") || undefined,
      profileImageUrl,
    };
  } else {
    payload = await request.json();
  }

  const parsed = teamUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const data = await updateTeam(currentUser.organizationId, id, parsed.data);

  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canManageTeams(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const data = await deleteTeam(currentUser.organizationId, id);

  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
