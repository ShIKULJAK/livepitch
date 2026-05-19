import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  callbackUrl: z.string().optional(),
});

function collectSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") return getSetCookie.call(headers);

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function relativeRedirect(path: string, status = 303) {
  return new NextResponse(null, {
    status,
    headers: { location: path },
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJsonRequest = contentType.includes("application/json");

  const body = isJsonRequest
    ? await request.json().catch(() => null)
    : (() => null)();

  const formParsed = !isJsonRequest
    ? await request
        .formData()
        .then((form) => ({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          callbackUrl: String(form.get("callbackUrl") ?? ""),
        }))
        .catch(() => null)
    : null;

  const parsed = payloadSchema.safeParse(isJsonRequest ? body : formParsed);

  if (!parsed.success) {
    if (!isJsonRequest) {
      return relativeRedirect("/login?error=InvalidInput");
    }
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const callbackValue = parsed.data.callbackUrl?.trim() ?? "";
  const callbackPath = callbackValue.startsWith("/") ? callbackValue : "/dashboard";
  const origin = new URL(request.url).origin;
  const callbackUrl = callbackValue.startsWith("http") ? callbackValue : `${origin}${callbackPath}`;

  const csrfResponse = await fetch(`${origin}/api/auth/csrf`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    return NextResponse.json({ error: "Unable to initialize auth session." }, { status: 500 });
  }

  const csrfJson = (await csrfResponse.json().catch(() => null)) as { csrfToken?: string } | null;
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) {
    return NextResponse.json({ error: "Missing CSRF token." }, { status: 500 });
  }

  const csrfCookies = collectSetCookies(csrfResponse.headers);
  const cookieHeader = csrfCookies
    .map((item) => item.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const form = new URLSearchParams({
    csrfToken,
    email: parsed.data.email,
    password: parsed.data.password,
    callbackUrl,
  });

  const callbackResponse = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
    },
    body: form.toString(),
    redirect: "manual",
    cache: "no-store",
  });

  const callbackJson = (await callbackResponse.json().catch(() => null)) as
    | { ok?: boolean; url?: string | null; error?: string }
    | null;
  const locationHeader = callbackResponse.headers.get("location");
  const redirectedTo = locationHeader
    ? new URL(locationHeader, origin).toString()
    : callbackJson?.url ?? callbackUrl;
  const hasAuthError = redirectedTo.includes("error=") || Boolean(callbackJson?.error);

  // NextAuth credentials callback may return either:
  // - 200 JSON with { ok: true, url }
  // - 302/303 redirect with Location header
  // Both are valid success responses unless they point to an auth error.
  const isRedirectSuccess = callbackResponse.status === 302 || callbackResponse.status === 303;
  const isJsonSuccess = callbackResponse.ok && callbackJson?.ok !== false;
  if ((!isRedirectSuccess && !isJsonSuccess) || hasAuthError) {
    if (!isJsonRequest) {
      return relativeRedirect("/login?error=CredentialsSignin");
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!isJsonRequest) {
    const safeLocation = redirectedTo.startsWith("http")
      ? new URL(redirectedTo).pathname + (new URL(redirectedTo).search || "")
      : redirectedTo;
    const redirectResponse = relativeRedirect(safeLocation || "/dashboard");
    for (const cookie of collectSetCookies(callbackResponse.headers)) {
      redirectResponse.headers.append("set-cookie", cookie);
    }
    return redirectResponse;
  }

  const response = NextResponse.json({
    ok: true,
    url: redirectedTo,
  });

  for (const cookie of collectSetCookies(callbackResponse.headers)) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
