import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { PUBLIC_TRACKING_ENABLED, SHOP_ENABLED } from "@/lib/constants";

/**
 * Send signed-out visitors somewhere sensible before a protected route renders.
 *
 * **Location matters.** This has to sit beside `app`, which in this project
 * means `src/proxy.ts`. It lived at the repository root, where `app` is not,
 * and Next never loaded it — so none of this ran, and the redirect people saw
 * came from `requireStaff()` in the layout instead. That was invisible because
 * the outcome looked similar: signed out, you ended up at the login page either
 * way. The tell was the missing `?next=`.
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

  /*
   * A stranger at the front door wants to track a parcel, not sign in.
   *
   * With the shop switched off, `/` is the operations dashboard and every
   * public way into the tracking page went with the storefront's header. A
   * customer opening the site was shown a staff login form and no hint that the
   * thing they came for exists.
   *
   * So an unauthenticated visit to the root goes to tracking instead. Staff are
   * unaffected: they carry a session cookie and never reach this line, and the
   * tracking page carries a quiet way in for them when they do not.
   *
   * Only the root. A signed-out visit to `/orders` still goes to the login page
   * with `?next=`, because someone typing that URL meant to sign in.
   */
  if (pathname === "/" && PUBLIC_TRACKING_ENABLED && !SHOP_ENABLED) {
    return NextResponse.redirect(new URL("/track", request.url));
  }

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
