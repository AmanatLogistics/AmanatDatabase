/**
 * Is the database reachable, and are the tables there?
 *
 * Run `npm run db:check`. It answers the three questions worth asking in order,
 * and stops at the first one that fails — a connection error and a missing
 * table need different fixes, and one message covering both helps nobody.
 */

import postgres from "postgres";

import {
  APP_URL_VARS,
  DIRECT_URL_VARS,
  describeUrl,
  explainConnectionError,
  findDatabaseUrl,
  isDirectSupabaseHost,
} from "../src/db/url.ts";

const CANDIDATES = [...new Set([...APP_URL_VARS, ...DIRECT_URL_VARS])];

console.log("Connection strings in this environment");
console.log("─".repeat(60));
let anyPresent = false;
for (const name of CANDIDATES) {
  const value = process.env[name];
  if (value?.trim()) {
    anyPresent = true;
    console.log(`  ${name.padEnd(26)} ${describeUrl(value.trim())}`);
  } else {
    console.log(`  ${name.padEnd(26)} —`);
  }
}

if (!anyPresent) {
  console.log(
    "\nNone are set here.\n" +
      "On Vercel: Settings → Environment Variables.\n" +
      "Locally:   copy .env.example to .env.local.\n" +
      "\nIf you connected Supabase through Vercel, it creates POSTGRES_URL and\n" +
      "POSTGRES_URL_NON_POOLING rather than DATABASE_URL. Both are read.\n" +
      "\nTo run this against your deployment's values:\n" +
      "  npx vercel env pull .env.local && npm run db:check",
  );
  process.exit(1);
}

const found = findDatabaseUrl(APP_URL_VARS)!;
console.log(`\nThe app would use: ${found.name}`);

if (isDirectSupabaseHost(found.url)) {
  console.log(
    "\n  WARNING: that is Supabase's direct connection, which is IPv6-only.\n" +
      "  It may work from here and still fail on Vercel, whose functions are\n" +
      "  IPv4-only. Prefer the transaction pooler string for DATABASE_URL.",
  );
}
console.log("");

const sql = postgres(found.url, { max: 1, prepare: false, onnotice: () => {} });

try {
  const [{ version }] = await sql<{ version: string }[]>`SELECT version()`;
  console.log(`Connected.  ${version.split(" on ")[0]}`);
} catch (error) {
  console.error(`\n${explainConnectionError(error, found.url)}`);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}

/*
 * A stuck advisory lock, checked before the tables — because the symptom it
 * causes is "there are no tables and nothing will create them".
 *
 * Earlier versions of this project took `pg_advisory_lock` around migrations.
 * Over Supabase's transaction pooler the unlock is asked of a different backend
 * than the one holding it, so it is refused and the lock survives on a pooled
 * session forever. Nothing takes that lock any more, so a leftover is now
 * harmless — but it will sit in the database until somebody clears it, and it
 * explains any build or request that hung with no error at all.
 */
const stuck = await sql<{ pid: number; state: string | null; seconds: number }[]>`
  SELECT l.pid,
         a.state,
         COALESCE(EXTRACT(EPOCH FROM (now() - a.state_change)), 0)::int AS seconds
  FROM pg_locks l
  LEFT JOIN pg_stat_activity a USING (pid)
  WHERE l.locktype = 'advisory' AND l.granted`;

if (stuck.length > 0) {
  console.log(`\n${stuck.length} advisory lock(s) still held:`);
  stuck.forEach((l) =>
    console.log(`  pid ${l.pid}  ${l.state ?? "unknown"}  for ${l.seconds}s`),
  );
  if (process.argv.includes("--clear-locks")) {
    const cleared = await sql<{ pid: number }[]>`
      SELECT pg_terminate_backend(l.pid), l.pid
      FROM pg_locks l WHERE l.locktype = 'advisory' AND l.granted`;
    console.log(`\nCleared. Terminated ${cleared.length} session(s).`);
  } else {
    console.log(
      "\n  Nothing in this app takes an advisory lock any more, so these are\n" +
        "  leftovers from an older deploy. They are what makes a migration\n" +
        "  hang with no error. To end the sessions holding them:\n" +
        "    npm run db:check -- --clear-locks",
    );
  }
}

const tables = await sql<{ table_name: string }[]>`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name`;

if (tables.length === 0) {
  console.log(
    "\nNo tables yet. The database is reachable but empty — run:\n" +
      "  npm run db:migrate",
  );
  await sql.end();
  process.exit(1);
}

console.log(`\n${tables.length} table(s): ${tables.map((t) => t.table_name).join(", ")}`);

const [staff] = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM staff`;
console.log(
  Number(staff.count) === 0
    ? "\nNo staff account yet. Open the app and it will take you to /setup."
    : `\n${staff.count} staff account(s). Sign in at /login.`,
);

console.log("\nAll good.");
await sql.end();
