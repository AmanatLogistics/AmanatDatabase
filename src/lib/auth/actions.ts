"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { eq, sql as raw } from "drizzle-orm";

import { db } from "@/db";
import { staff } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordProblem } from "@/lib/auth/policy";
import { createSession, destroySession, requireStaff } from "@/lib/auth/session";

/**
 * Signing in, signing out, and creating the very first account.
 *
 * Everything a browser can reach lives here, and every one of these is a public
 * POST endpoint whether or not a form is rendered for it — the `use server`
 * directive turns each into a URL anyone can call. They validate their own
 * input and check their own permissions; the login page rendering or not
 * rendering proves nothing.
 */

export interface FormResult {
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Signing in                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

/**
 * One message for every failure.
 *
 * "No such account" and "wrong password" told apart is a way to ask the server
 * which of your staff emails are real. It answers the same either way.
 */
const REFUSED = "That email and password do not match an account.";

export async function signIn(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const [person] = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email))
    .limit(1);

  /*
   * Hash anyway when the account does not exist. Returning early would make a
   * missing account answer in a millisecond and a real one in a hundred, which
   * is the same disclosure the shared message above is there to prevent.
   */
  if (!person) {
    await verifyPassword(password, await hashPassword("no such account"));
    return { error: REFUSED };
  }

  if (person.lockedUntil && person.lockedUntil > new Date()) {
    const minutes = Math.ceil(
      (person.lockedUntil.getTime() - Date.now()) / 60_000,
    );
    return {
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  if (!person.active) return { error: REFUSED };

  if (!(await verifyPassword(password, person.passwordHash))) {
    const attempts = person.failedAttempts + 1;
    await db
      .update(staff)
      .set({
        failedAttempts: attempts,
        lockedUntil:
          attempts >= MAX_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
      })
      .where(eq(staff.id, person.id));
    return { error: REFUSED };
  }

  await db
    .update(staff)
    .set({ failedAttempts: 0, lockedUntil: null, lastSignedInAt: new Date() })
    .where(eq(staff.id, person.id));

  await createSession(person.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/* -------------------------------------------------------------------------- */
/* The first account                                                           */
/* -------------------------------------------------------------------------- */

/** Is there nobody at all yet? Decides whether /setup is open. */
export async function needsFirstOwner(): Promise<boolean> {
  const [row] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(staff);
  return (row?.count ?? 0) === 0;
}

/**
 * Create the owner account, once.
 *
 * Open to anyone while the staff table is empty, which is the only moment it
 * can be — after this there is no way in without a password. The advisory lock
 * closes the window where two people submitting the form at the same moment
 * both read a count of zero and both become owner.
 */
export async function createFirstOwner(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const passwordHash = await hashPassword(password);
  let ownerId: string | null = null;

  await db.transaction(async (tx) => {
    // Any concurrent call blocks here until this transaction ends.
    await tx.execute(raw`SELECT pg_advisory_xact_lock(hashtext('amanat:first-owner'))`);

    const [row] = await tx
      .select({ count: raw<number>`count(*)::int` })
      .from(staff);
    if ((row?.count ?? 0) > 0) return;

    ownerId = randomUUID();
    await tx.insert(staff).values({
      id: ownerId,
      name,
      email,
      role: "owner",
      passwordHash,
      active: true,
    });
  });

  if (!ownerId) {
    return { error: "An account already exists. Sign in instead." };
  }

  await createSession(ownerId);
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Who am I                                                                    */
/* -------------------------------------------------------------------------- */

/** For client components that need the signed-in person after first render. */
export async function whoAmI() {
  return requireStaff();
}
