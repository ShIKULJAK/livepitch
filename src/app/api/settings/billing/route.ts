import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canAccessBilling } from "@/lib/permissions";
import { getBillingSnapshot } from "@/lib/server/billing";

export async function GET() {
  const currentUser = await requireAuth();

  if (!canAccessBilling(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getBillingSnapshot(currentUser.organizationId);
  return NextResponse.json({ data });
}

