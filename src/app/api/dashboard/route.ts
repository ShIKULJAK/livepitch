import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/server/competitions";

export async function GET() {
  const currentUser = await requireAuth();
  const data = await getDashboardSnapshot(currentUser.organizationId);
  return NextResponse.json({ data });
}
