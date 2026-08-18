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
  findDatabaseUrl,
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
console.log(`\nThe app would use: ${found.name}\n`);

const sql = postgres(found.url, { max: 1, prepare: false, onnotice: () => {} });

try {
  const [{ version }] = await sql<{ version: string }[]>`SELECT version()`;
  console.log(`Connected.  ${version.split(" on ")[0]}`);
} catch (error) {
  console.error(`\nCould not connect: ${(error as Error).message}`);
  console.error(
    "\nCommon causes: the password still says [YOUR-PASSWORD], the project is\n" +
      "paused in Supabase, or this network cannot reach that host.",
  );
  await sql.end();
  process.exit(1);
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
