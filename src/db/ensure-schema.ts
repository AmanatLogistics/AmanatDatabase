import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

import { sql as raw } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, explainDbFailure } from "@/db";

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
  inFlight ??= run().catch((error: unknown) => {
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

/**
 * How many times to re-enter the race before giving up.
 *
 * Losing it is not a failure — it means somebody else is creating the very
 * tables we wanted — so a loser waits and looks again rather than reporting a
 * broken database. Bounded, because a migration that is genuinely wrong fails
 * the same way every time and should say so rather than spin.
 */
const ATTEMPTS = 5;

async function run(): Promise<void> {
  if (await schemaExists()) return;

  console.warn(
    "[amanat] The database has no tables. Applying migrations now — this " +
      "normally happens at build time.",
  );

  const folder = migrationsFolder();

  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(db, { migrationsFolder: folder });
      console.warn("[amanat] Migrations applied.");
      return;
    } catch (error) {
      /*
       * Two instances waking together both try to create the same tables. One
       * wins; the other lands here. Drizzle runs the migration inside a
       * transaction, so the loser rolled back cleanly and the winner's tables
       * are either already visible — in which case there is nothing left to do
       * and this was a success — or still uncommitted, in which case looking
       * again in a moment will find them.
       *
       * This replaces an advisory lock, which cannot work here: see the note in
       * `scripts/migrate.mts`.
       */
      if (await schemaExists()) return;

      if (attempt >= ATTEMPTS) {
        console.error(`[amanat] Could not create the schema.\n\n${explainDbFailure(error)}`);
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
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

/**
 * Where the migration SQL is, on this machine.
 *
 * Drizzle reads the files with plain `fs`, resolved against the working
 * directory — so a hard-coded `"./drizzle"` is a bet on what the working
 * directory happens to be, and a serverless bundle is not obliged to run from
 * the project root. Losing that bet reads as `Can't find meta/_journal.json`,
 * which sounds like the files were never deployed even when they were.
 *
 * So: look, rather than assume. `MIGRATIONS_DIR` is the escape hatch for a
 * layout none of these guesses cover.
 */
function migrationsFolder(): string {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.join(process.cwd(), "drizzle"),
    path.join(process.cwd(), "..", "drizzle"),
    path.join(process.cwd(), "..", "..", "drizzle"),
  ].filter((dir): dir is string => Boolean(dir));

  const found = candidates.find((dir) =>
    existsSync(path.join(dir, "meta", "_journal.json")),
  );
  if (found) return found;

  throw new Error(
    [
      "The migration files are missing from this deployment.",
      "",
      `Working directory: ${process.cwd()}`,
      "Looked in:",
      ...candidates.map((dir) => `  ${dir}`),
      "",
      "`drizzle/` is read from disk at runtime, so nothing imports it and Next",
      "will leave it behind unless it is traced. next.config.ts should have:",
      '  outputFileTracingIncludes: { "/**": ["./drizzle/**"] }',
      "",
      "Or set MIGRATIONS_DIR to wherever the folder ended up.",
    ].join("\n"),
  );
}
