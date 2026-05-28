import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { canCreateTeams } from "@/lib/permissions";
import { deleteTeam, updateTeam } from "@/lib/repositories/teams";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { createVenue } from "@/lib/server/competitions";
import { teamUpdateSchema } from "@/lib/validation/team";

async function resolveHomeVenueId(
  organizationId: string,
  params: {
    homeVenueId?: string | null;
    newVenueName?: string | null;
    newVenueCity?: string | null;
    newVenueCountry?: string | null;
  }
) {
  if (params.homeVenueId) {
    const existing = await prisma.venue.findFirst({ where: { id: params.homeVenueId, organizationId }, select: { id: true } });
    if (!existing) throw new Error("Selected stadium not found.");
    return existing.id;
  }

  if (params.newVenueName?.trim()) {
    const created = await createVenue(organizationId, {
      name: params.newVenueName.trim(),
      city: params.newVenueCity?.trim() || null,
      country: params.newVenueCountry?.trim() || null,
    });
    return created.id;
  }

  return undefined;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreateTeams(currentUser.role)) {
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

    const homeVenueId = (formData.get("homeVenueId") as string | null)?.trim() || null;
    const newVenueName = (formData.get("newVenueName") as string | null)?.trim() || null;
    const newVenueCity = (formData.get("newVenueCity") as string | null)?.trim() || null;
    const newVenueCountry = (formData.get("newVenueCountry") as string | null)?.trim() || null;

    payload = {
      sport: formData.get("sport") || undefined,
      name: formData.get("name") || undefined,
      shortName: formData.get("shortName") || undefined,
      place: formData.get("place") || undefined,
      city: formData.get("city") || undefined,
      country: formData.get("country") || undefined,
      coach: formData.get("coach") || undefined,
      homeVenueId: await resolveHomeVenueId(currentUser.organizationId, {
        homeVenueId,
        newVenueName,
        newVenueCity,
        newVenueCountry,
      }),
      profileImageUrl,
    };
  } else {
    const body = (await request.json()) as Record<string, unknown>;
    payload = {
      ...body,
      homeVenueId: await resolveHomeVenueId(currentUser.organizationId, {
        homeVenueId: typeof body.homeVenueId === "string" ? body.homeVenueId : null,
        newVenueName: typeof body.newVenueName === "string" ? body.newVenueName : null,
        newVenueCity: typeof body.newVenueCity === "string" ? body.newVenueCity : null,
        newVenueCountry: typeof body.newVenueCountry === "string" ? body.newVenueCountry : null,
      }),
    };
  }

  const parsed = teamUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  let data = null;
  try {
    data = await updateTeam(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreateTeams(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let data = null;
  try {
    data = await deleteTeam(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
