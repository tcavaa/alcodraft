import { type NextRequest, NextResponse } from "next/server";

import { LOGIN_PATH, SESSION_COOKIE, SESSION_TTL_MS } from "@/server/auth/constants";

/**
 * Optimistic gate for /admin: no session cookie → login page.
 * The real check (session in the DB, store access) happens in the Data Access
 * Layer on every page and action; this only avoids rendering for anonymous visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token && pathname !== LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  if (token) {
    // Keep the cookie alive as long as the user keeps using the app (DB expiry slides too).
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + SESSION_TTL_MS),
    });
  }
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
