import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const publicRoutes = ["/", "/login", "/signup", "/forgot-password", "/check-email", "/api/auth", "/icon.svg"];
const adminOnlyRoutes = ["/settings/roles", "/settings/billing", "/settings/security", "/settings/integrations", "/api/users"];

export default async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });

  if (!token && !isPublic) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  if (token && (pathname === "/login" || pathname === "/signup")) {
    return Response.redirect(new URL("/dashboard", nextUrl.origin));
  }

  const isAdminOnly = adminOnlyRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (token && isAdminOnly && token.role !== "ADMIN") {
    return Response.redirect(new URL("/forbidden", nextUrl.origin));
  }

  return undefined;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
