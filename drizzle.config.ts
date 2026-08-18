import type { Config } from "drizzle-kit";

/**
 * Migrations are generated, reviewed and committed — never applied by guessing
 * at the difference on a live database. `drizzle-kit generate` writes the SQL
 * into `drizzle/`; that SQL is what runs, and what you can read in a diff.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
} satisfies Config;
