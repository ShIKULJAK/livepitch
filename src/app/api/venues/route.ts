import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createPitch, createVenue, deletePitch, deleteVenue, listVenues, updatePitch, updateVenue } from "@/lib/server/competitions";
import { pitchInputSchema, pitchUpdateSchema } from "@/lib/validation/pitch";
import { venueCreateSchema } from "@/lib/validation/venue-create";
import { venueUpdateSchema } from "@/lib/validation/venue-update";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listVenues(currentUser.organizationId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const currentUser = await requireAuth();
  const body = await request.json();

  if (body?.kind === "venue") {
    const parsedVenue = venueCreateSchema.safeParse(body);
    if (!parsedVenue.success) {
      return NextResponse.json({ error: "Invalid venue payload", issues: parsedVenue.error.issues }, { status: 400 });
    }
    const data = await createVenue(currentUser.organizationId, parsedVenue.data);
    return NextResponse.json({ data }, { status: 201 });
  }

  const parsed = pitchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const data = await createPitch(currentUser.organizationId, parsed.data);
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const currentUser = await requireAuth();
  const body = await request.json();

  if (body?.kind === "venue") {
    const venueId = typeof body?.id === "string" ? body.id : null;
    if (!venueId) return NextResponse.json({ error: "Venue id is required." }, { status: 400 });
    const parsedVenue = venueUpdateSchema.safeParse(body);
    if (!parsedVenue.success) {
      return NextResponse.json({ error: "Invalid venue payload", issues: parsedVenue.error.issues }, { status: 400 });
    }
    const data = await updateVenue(currentUser.organizationId, venueId, parsedVenue.data);
    if (!data) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
    return NextResponse.json({ data });
  }

  const pitchId = typeof body?.id === "string" ? body.id : null;
  if (!pitchId) return NextResponse.json({ error: "Pitch id is required." }, { status: 400 });
  const parsed = pitchUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const data = await updatePitch(currentUser.organizationId, pitchId, parsed.data);
  if (!data) return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id is required." }, { status: 400 });
  if (kind === "venue") {
    const data = await deleteVenue(currentUser.organizationId, id);
    if (!data) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const data = await deletePitch(currentUser.organizationId, id);
  if (!data) return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
