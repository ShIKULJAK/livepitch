import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { canCreateTeams } from "@/lib/permissions";
import { createTeam as createTeamRecord } from "@/lib/repositories/teams";
import { ImageProcessingError, processAndStoreProfileImage } from "@/lib/server/image-processing";
import { createVenue, listTeams } from "@/lib/server/competitions";
import { teamInputSchema } from "@/lib/validation/team";

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

  return null;
}

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listTeams(currentUser.organizationId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();

  if (!canCreateTeams(currentUser.role)) {
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

    const homeVenueId = (formData.get("homeVenueId") as string | null)?.trim() || null;
    const newVenueName = (formData.get("newVenueName") as string | null)?.trim() || null;
    const newVenueCity = (formData.get("newVenueCity") as string | null)?.trim() || null;
    const newVenueCountry = (formData.get("newVenueCountry") as string | null)?.trim() || null;

    payload = {
      sport: formData.get("sport"),
      name: formData.get("name"),
      shortName: formData.get("shortName") || null,
      place: formData.get("place") || null,
      city: formData.get("city") || null,
      country: formData.get("country") || null,
      coach: formData.get("coach") || null,
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

  const parsed = teamInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = await createTeamRecord(currentUser.organizationId, currentUser.id, parsed.data);
  return NextResponse.json({ data }, { status: 201 });
}
