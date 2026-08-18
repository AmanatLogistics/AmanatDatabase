import "server-only";

import { cache } from "react";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { sessions, staff } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import type { TeamRole } from "@/lib/types";

/**
 * Who is signed in.
 *
 * Sessions live in the database rather than inside a signed cookie, so signing
 * somebody out actually signs them out — deleting the row ends every browser
 * holding that token immediately. A self-contained token cannot be withdrawn
 * before it expires, which is the wrong property for a shop where somebody
 * leaves and their access should stop that afternoon.
 *
 * The cookie carries a random token. The database stores only its SHA-256, so
 * a leaked dump of the sessions table cannot be replayed as anybody's login.
 */

export { SESSION_COOKIE };

const SESSION_DAYS = 30;

export interface SignedInStaff {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(staffId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db
    .insert(sessions)
    .values({ tokenHash: hashToken(token), staffId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript on the page can never read it
    sameSite: "lax", // not sent on cross-site POSTs
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  // Opportunistic tidy-up. Cheap, indexed, and saves ever needing a cron.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * Read the session, if there is a valid one.
 *
 * Wrapped in React's `cache` so a page that checks in the layout, again in the
 * page, and again in three server actions still costs one query per request.
 *
 * Returns null rather than redirecting: some callers want to render a public
 * page differently for a signed-in operator, not bounce them.
 */
export const readSession = cache(async (): Promise<SignedInStaff | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      active: staff.active,
    })
    .from(sessions)
    .innerJoin(staff, eq(sessions.staffId, staff.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const found = rows[0];
  // A deactivated account keeps its rows but stops being able to do anything.
  if (!found || !found.active) return null;

  return {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
  };
});

/**
 * The session, or off to the login page.
 *
 * Every protected layout and every server action calls this. The check in
 * `proxy.ts` only looks at whether a cookie is present — it is a redirect for
 * the common case, not a security boundary, and must never be the only check.
 */
export async function requireStaff(): Promise<SignedInStaff> {
  const person = await readSession();
  if (!person) redirect("/login");
  return person;
}

/** Roles that may do a thing only an owner or manager should. */
export async function requireRole(
  ...allowed: TeamRole[]
): Promise<SignedInStaff> {
  const person = await requireStaff();
  if (!allowed.includes(person.role)) {
    throw new Error("You do not have permission to do that.");
  }
  return person;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Compare two secrets without leaking how much of them matched.
 *
 * Exported because the first-run setup key uses it too.
 */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
