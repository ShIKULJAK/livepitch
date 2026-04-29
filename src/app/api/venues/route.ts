import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listVenues } from "@/lib/server/competitions";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await listVenues(currentUser.organizationId);
  return NextResponse.json({ data });
}
