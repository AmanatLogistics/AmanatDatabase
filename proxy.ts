import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * Send signed-out visitors to the login page before a protected route renders.
 *
 * This is a redirect for the common case, **not** a security boundary. It only
 * looks at whether a session cookie is present — it does not check that the
 * cookie is valid, that the session still exists, or that the account is still
 * active. Anyone can set a cookie.
 *
 * The real check is `requireStaff()`, called in every protected layout and at
 * the top of every server action that touches data. Next's own guidance is to
 * keep this file free of database work: it runs on every request including
 * prefetches, and it is deployed separately from the render path.
 *
 * Everything is protected unless it appears below.
 */

/** Surfaces a customer must be able to reach without an account. */
const PUBLIC_PREFIXES = [
  "/store", // the shop
  "/track", // where is my order
  "/login",
  "/setup",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  /*
   * Remember where they were going, so signing in lands them there instead of
   * on the dashboard. Only the path and query — never an absolute URL, which
   * would turn this into an open redirect.
   */
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /*
   * Skip Next's own assets and the favicon. Everything else — including routes
   * that do not exist — goes through, so a typo cannot accidentally land
   * outside the guard.
   */
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
