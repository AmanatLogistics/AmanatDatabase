import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

import { sql as raw } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, explainDbFailure } from "@/db";
import { withDeadline } from "@/db/deadline";

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
 * How long the whole thing may take, and how many goes it gets.
 *
 * Both exist because this runs inside a serverless function, which is killed
 * without ceremony when its time is up — ten seconds on Vercel's Hobby plan.
 * The first version had neither: five migration attempts, each able to sit on a
 * cold database for as long as it liked, with two and a half seconds of sleeps
 * between them. Against a suspended compute that ran past the limit, the
 * function was killed mid-migration, the cached promise was cleared because it
 * had failed, and the next request started the whole thing over. From outside
 * that looks like a page that spins and then dies, over and over — which is
 * exactly what it was.
 *
 * So: finish inside the budget or say so. A clear error beats being killed
 * silently, because only one of the two tells you what to do next.
 */
const BUDGET_MS = 8_000;
const ATTEMPTS = 3;

async function run(): Promise<void> {
  const startedAt = Date.now();
  const remaining = () => BUDGET_MS - (Date.now() - startedAt);

  if (await withDeadline(schemaExists(), "looking for the tables", remaining()))
    return;

  console.warn(
    "[amanat] The database has no tables. Applying migrations now — this " +
      "normally happens at build time.",
  );

  const folder = migrationsFolder();

  for (let attempt = 1; ; attempt++) {
    try {
      /*
       * The deadline goes around the migration itself, not merely between
       * tries. Checking the clock between attempts bounds nothing when it is a
       * single call that hangs — and a migration blocked behind a lock left by
       * an earlier killed request hangs exactly once, for ever.
       */
      await withDeadline(
        migrate(db, { migrationsFolder: folder }),
        "creating the schema",
        Math.max(1_000, remaining()),
      );
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
       * This is not an advisory lock, which cannot work here: see the note in
       * `scripts/migrate.mts`.
       */
      if (
        remaining() > 0 &&
        (await withDeadline(
          schemaExists(),
          "looking for the tables",
          Math.max(500, remaining()),
        ).catch(() => false))
      ) {
        return;
      }

      if (attempt >= ATTEMPTS || remaining() <= 0) {
        console.error(
          `[amanat] Could not create the schema.\n\n${outOfTime(remaining())}` +
            `\n\n${explainDbFailure(error)}`,
        );
        throw error;
      }

      // Never sleep past the budget — the nap would be all that is left of it.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Math.min(150 * attempt, remaining()))),
      );
    }
  }
}

/** Said only when the clock, rather than the database, is what stopped us. */
function outOfTime(left: number): string {
  if (left > 0) return "";
  return [
    "This request ran out of time before the tables were finished.",
    "",
    "Creating the schema on a cold database can take longer than a serverless",
    "function is allowed to live. Apply the migrations once from your machine",
    "and the app will never need to do it during a request:",
    "",
    "  npx vercel env pull .env.local && npm run db:migrate",
  ].join("\n");
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
