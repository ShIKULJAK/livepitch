import { NextResponse } from "next/server";

const AUTH_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "__Host-authjs.csrf-token",
  "authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.csrf-token",
  "next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
];

const AUTH_COOKIE_PREFIXES = [
  "authjs.session-token.",
  "__Secure-authjs.session-token.",
  "next-auth.session-token.",
  "__Secure-next-auth.session-token.",
];

function getCookieNamesFromHeader(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  if (!raw) return [];

  return raw
    .split(";")
    .map((part) => part.trim())
    .map((part) => part.split("=")[0]?.trim())
    .filter(Boolean) as string[];
}

function resolveRedirectOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();

  const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "http";
  const rawHost = forwardedHost || hostHeader || requestUrl.host || "localhost:3000";
  const host = rawHost.startsWith("0.0.0.0") ? rawHost.replace(/^0\.0\.0\.0/, "localhost") : rawHost;

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", resolveRedirectOrigin(request)));
  const presentCookies = getCookieNamesFromHeader(request);
  const dynamicAuthCookies = presentCookies.filter((name) =>
    AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
  const cookiesToClear = new Set([...AUTH_COOKIES, ...dynamicAuthCookies]);

  for (const cookieName of cookiesToClear) {
    response.cookies.set(cookieName, "", {
      expires: new Date(0),
      path: "/",
    });
  }

  return response;
}
