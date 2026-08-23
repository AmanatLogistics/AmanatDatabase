import "server-only";

import { sql as raw } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db } from "@/db";

/**
 * Make sure the tables exist before anything tries to read them.
 *
 * Creating the schema was a step somebody had to remember: connect a database,
 * then run the migrations. Miss the second half and every page answers with
 * `relation "staff" does not exist` — a 500 with no clue in it, on the very
 * first visit, before there is even an account to sign in with.
 *
 * The build already migrates on a production deploy. This is the safety net for
 * when that did not happen: the connection string arrived after the build, the
 * database was swapped, the deploy was promoted from a preview. The app brings
 * its own schema up rather than asking a person to.
 *
 * Once per process. The first caller runs it; everyone else waits on the same
 * promise and, from then on, on a promise that has already resolved — so the
 * check costs one query per cold start, not one per request.
 */
let inFlight: Promise<void> | undefined;

export function ensureSchema(): Promise<void> {
  inFlight ??= run().catch((error) => {
    /*
     * Not cached on failure. A database that was briefly unreachable would
     * otherwise stay "broken" for the life of the instance, long after it came
     * back.
     */
    inFlight = undefined;
    throw error;
  });
  return inFlight;
}

async function run(): Promise<void> {
  if (await schemaExists()) return;

  console.warn(
    "[amanat] The database has no tables. Applying migrations now — this " +
      "normally happens at build time.",
  );

  /*
   * Serialised across every instance. On a cold start several functions can
   * wake at once, and all of them would otherwise try to create the same
   * tables. The lock is released when the connection returns to the pool.
   */
  await db.execute(raw`SELECT pg_advisory_lock(hashtext('amanat:migrate'))`);
  try {
    // Checked again inside the lock: whoever held it before us may have just
    // done the work.
    if (!(await schemaExists())) {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.warn("[amanat] Migrations applied.");
    }
  } finally {
    await db.execute(raw`SELECT pg_advisory_unlock(hashtext('amanat:migrate'))`);
  }
}

/**
 * Is the schema there?
 *
 * `to_regclass` returns null rather than raising when the table is absent,
 * which is what makes it usable as a question instead of an error to catch.
 */
async function schemaExists(): Promise<boolean> {
  const rows = await db.execute<{ present: string | null }>(
    raw`SELECT to_regclass('public.staff')::text AS present`,
  );
  const row = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
  return Boolean((row as { present?: string | null } | undefined)?.present);
}
