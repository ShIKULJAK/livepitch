import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOCALE_PREFIX = /^\/([a-z]{2}(?:-[A-Za-z]{4})?)(\/|$)/;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const match = pathname.match(LOCALE_PREFIX);

  if (!match) return NextResponse.next();

  const strippedPath = pathname.replace(LOCALE_PREFIX, "/");
  const normalizedPath = strippedPath === "" ? "/" : strippedPath;
  const url = new URL(`${normalizedPath}${search}`, request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
