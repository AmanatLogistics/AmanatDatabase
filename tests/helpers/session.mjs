import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

/**
 * A signed-in staff member, made directly in the database.
 *
 * Every admin route needs a session now, so a test that wants to look at one
 * has to have an account. Going through the login form for each case would test
 * the login form over and over; this writes the same two rows the login form
 * writes and hands back the cookie.
 *
 * The token hashing must match `src/lib/auth/session.ts` — the cookie carries
 * the token, the database stores its SHA-256.
 */

export const SESSION_COOKIE = "amanat_session";

export async function signInDirectly(
  databaseUrl,
  { name = "Test Owner", email = `owner-${randomUUID()}@example.test` } = {},
) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const staffId = randomUUID();
    await sql`
      INSERT INTO staff (id, name, email, role, password_hash, active)
      VALUES (${staffId}, ${name}, ${email}, 'owner', 'scrypt$16384$8$1$AAAA$BBBB', true)`;

    const token = randomBytes(32).toString("base64url");
    await sql`
      INSERT INTO sessions (token_hash, staff_id, expires_at)
      VALUES (${createHash("sha256").update(token).digest("hex")}, ${staffId},
              ${new Date(Date.now() + 86_400_000)})`;

    return { staffId, email, name, token };
  } finally {
    await sql.end();
  }
}

/** Empty the staff table, and every session hanging off it. */
export async function clearStaff(databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`TRUNCATE staff CASCADE`;
  } finally {
    await sql.end();
  }
}
