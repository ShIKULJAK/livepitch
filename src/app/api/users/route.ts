import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { listUsersByOrganization, updateUserRole } from "@/lib/repositories/users";

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER", "EDITOR", "VIEWER"]),
});

export async function GET() {
  const currentUser = await requireAuth();
  const users = await listUsersByOrganization(currentUser.organizationId);
  return NextResponse.json({ data: users });
}

export async function PATCH(request: Request) {
  await requireAdmin();
  const body = await request.json();
  const parsed = updateRoleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const user = await updateUserRole(parsed.data.userId, parsed.data.role);
  return NextResponse.json({ data: user });
}
