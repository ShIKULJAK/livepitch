import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const LOCALE_PREFIX = /^\/([a-z]{2}(?:-[A-Za-z]{4})?)(\/|$)/;
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/check-email"]);
const PUBLIC_PREFIXES = ["/reset-password"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Safety bypass: never run app-auth redirects on API/static/system routes.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const match = pathname.match(LOCALE_PREFIX);

  if (match) {
    const strippedPath = pathname.replace(LOCALE_PREFIX, "/");
    const normalizedPath = strippedPath === "" ? "/" : strippedPath;
    const url = new URL(`${normalizedPath}${search}`, request.url);
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  if (token) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)"],
};
