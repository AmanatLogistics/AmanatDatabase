/**
 * Apply pending migrations.
 *
 * Run with `npm run db:migrate`. It is safe to run twice: Drizzle records what
 * it has already applied and skips those.
 *
 * It also runs on every deploy, from `vercel-build`, so nobody has to remember
 * to create the tables by hand after connecting a database. That is what
 * `--optional` is for: on a build with no connection string configured — a
 * local `next build`, a CI check — it says so loudly and lets the build carry
 * on, rather than failing over a database that was never meant to be there.
 * With a connection string present, a failure is a real failure and stops the
 * deploy: shipping an app whose tables do not exist helps nobody.
 */

import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  DIRECT_URL_VARS,
  describeUrl,
  explainConnectionError,
  findMigrationUrl,
  missingUrlMessage,
} from "../src/db/url.ts";

const optional = process.argv.includes("--optional");

/*
 * Preview deploys share the production database — there is only one. Left
 * unguarded, opening a pull request that adds a migration would apply it to
 * production before anybody had reviewed it, from a branch that might never be
 * merged. Schema changes belong to the deploy that ships them.
 *
 * `VERCEL_ENV` is "production", "preview" or "development"; it is unset
 * anywhere that is not Vercel, where this is somebody running it deliberately.
 */
const vercelEnv = process.env.VERCEL_ENV;
if (optional && vercelEnv && vercelEnv !== "production") {
  console.log(
    [
      "",
      `  Skipping migrations: this is a ${vercelEnv} deploy.`,
      "",
      "  Preview builds share the production database, so they do not change",
      "  its shape. Migrations run when the change reaches production.",
      "  To apply one by hand: npm run db:migrate",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const found = findMigrationUrl();
if (!found) {
  if (optional) {
    console.log(
      [
        "",
        "  ─────────────────────────────────────────────────────────────",
        "  Skipping migrations: no database connection string is set.",
        "",
        "  The build continues, but the deployed app will have no tables",
        "  and will not work until one is configured.",
        "",
        `  Looked for: ${DIRECT_URL_VARS.join(", ")}`,
        "  ─────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }
  console.error(missingUrlMessage(DIRECT_URL_VARS));
  process.exit(1);
}

console.log(`Using ${found.name} -> ${describeUrl(found.url)}`);

/*
 * Supabase shows the transaction pooler (6543) most prominently, so that is
 * usually what ends up in DATABASE_URL — and if it is the only variable set,
 * this script gets it too. It works, but only with prepared statements off:
 * the pooler is free to hand a later statement to a different backend, which
 * has never seen the statement we prepared. Left on, migrating fails with
 * "prepared statement does not exist".
 */
const pooled = /:6543|pooler/.test(found.url);
if (pooled) {
  console.log(
    "\nThis looks like the pooled connection. It will work, but the direct\n" +
      "one (port 5432) is the right tool for migrations — set it as\n" +
      "DIRECT_DATABASE_URL if you hit trouble.",
  );
}

const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
) as { entries: { tag: string }[] };

console.log(`\n${journal.entries.length} migration(s) on disk:`);
journal.entries.forEach((e) => console.log(`  - ${e.tag}`));

const sql = postgres(found.url, { max: 1, prepare: false, onnotice: () => {} });

/**
 * Deliberately no advisory lock.
 *
 * This used to take `pg_advisory_lock` so two deploys building at once could
 * not create the same tables twice. Over a transaction pooler that is not just
 * useless, it is a trap: the pooler routes each statement to whichever backend
 * is free, so the lock is taken on one server session and the unlock is asked
 * of a different one, which does not own it and refuses — Postgres even says
 * so, "you don't own a lock of type ExclusiveLock". The lock is then held for
 * good by a pooled backend nobody can reach, and every later build blocks on
 * `pg_advisory_lock` forever. A hung build applies no migrations, which leaves
 * exactly the empty database this script exists to prevent.
 *
 * Concurrency is handled where it is actually safe instead: Drizzle runs the
 * migration inside a transaction, so of two racing builds one commits and the
 * other rolls back whole and retries, finding nothing left to do.
 */
const RETRIES = 5;

try {
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
      break;
    } catch (error) {
      const applied = await sql<{ present: string | null }[]>`
        SELECT to_regclass('public.staff')::text AS present`;
      if (applied[0]?.present) break;
      if (attempt >= RETRIES) throw error;
      console.log(`  Migration attempt ${attempt} lost a race; retrying.`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  const [{ count }] = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`;
  console.log(`\nDone. ${count} migration(s) recorded as applied.`);
} catch (error) {
  console.error(`\nMigration failed.\n\n${explainConnectionError(error, found.url)}`);
  /*
   * Deliberately fatal even under --optional. A connection string was
   * configured, so somebody meant this to work; carrying on would deploy an
   * app that cannot read its own data.
   */
  await sql.end({ timeout: 5 });
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
