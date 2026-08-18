/**
 * Apply pending migrations.
 *
 * Run with `npm run db:migrate`, against whatever DATABASE_URL points at. It is
 * safe to run twice: Drizzle records what it has already applied in a
 * `__drizzle_migrations` table and skips those.
 *
 * Use the *session* connection string here, not the transaction pooler — DDL
 * and the advisory lock the migrator takes both need a connection that stays
 * put for the whole run.
 */

import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  DIRECT_URL_VARS,
  describeUrl,
  findDatabaseUrl,
  missingUrlMessage,
} from "../src/db/url.ts";

const found = findDatabaseUrl(DIRECT_URL_VARS);
if (!found) {
  console.error(missingUrlMessage(DIRECT_URL_VARS));
  process.exit(1);
}

console.log(`Using ${found.name} -> ${describeUrl(found.url)}\n`);

const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
) as { entries: { tag: string }[] };

console.log(`${journal.entries.length} migration(s) on disk:`);
journal.entries.forEach((e) => console.log(`  - ${e.tag}`));

const sql = postgres(found.url, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`;
  console.log(`\nDone. ${count} migration(s) recorded as applied.`);
} finally {
  await sql.end();
}
