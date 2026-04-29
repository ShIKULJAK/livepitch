import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import type { Role } from "@/lib/permissions";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role as Role)) throw new Error("Forbidden");
  return user;
}

export async function requireAdmin() {
  return requireRole(["ADMIN"]);
}
