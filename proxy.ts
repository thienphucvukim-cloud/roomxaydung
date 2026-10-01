import { NextRequest, NextResponse } from "next/server";
import { GUEST_ID_PATTERN, MEMBER_SESSION_COOKIE } from "./lib/session-cookie";

// Establish one private identity before the page starts making API requests.
export function proxy(request: NextRequest) {
  if (/^\/(?:_next|@|node_modules|avatars|fonts|signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(request.nextUrl.pathname)
    || /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|css|js)$/.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const existing = request.cookies.get(MEMBER_SESSION_COOKIE)?.value ?? "";
  if (GUEST_ID_PATTERN.test(existing)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const userId = "guest_" + crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  const cookies = (requestHeaders.get("cookie") ?? "").split(";")
    .filter(value => value.trim() && !value.trim().startsWith(MEMBER_SESSION_COOKIE + "="));
  cookies.push(`${MEMBER_SESSION_COOKIE}=${userId}`);
  requestHeaders.set("cookie", cookies.join("; "));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(MEMBER_SESSION_COOKIE, userId, {
    path: "/", maxAge: 31_536_000, httpOnly: true, sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
