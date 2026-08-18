/**
 * Finding the connection string, whatever it happens to be called.
 *
 * Supabase's Vercel integration does not create `DATABASE_URL`. It creates
 * `POSTGRES_URL` (pooled) and `POSTGRES_URL_NON_POOLING` (direct), among
 * others. Reading only `DATABASE_URL` meant a correctly connected project
 * still came up with "DATABASE_URL is not set", which looks like the
 * integration failed when it did not.
 *
 * So: look for the names that actually turn up, in order, and say which one
 * was used when something goes wrong.
 */

/**
 * For the app. Wants the **pooled** connection — every request can arrive on
 * its own serverless instance, and each opening a direct connection exhausts
 * Postgres long before the traffic warrants it.
 */
export const APP_URL_VARS = [
  "DATABASE_URL", // set by hand, wins if present
  "POSTGRES_URL", // Supabase/Vercel integration, pooled
  "SUPABASE_DATABASE_URL",
] as const;

/**
 * For migrations. Wants the **direct** connection: creating tables and taking
 * the migrator's advisory lock both need a connection that stays put, which a
 * transaction pooler is free to swap underneath you.
 */
export const DIRECT_URL_VARS = [
  "DIRECT_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING", // Supabase/Vercel integration, direct
  ...APP_URL_VARS,
] as const;

export interface FoundUrl {
  /** Which environment variable it came from, for error messages. */
  name: string;
  url: string;
}

export function findDatabaseUrl(
  names: readonly string[] = APP_URL_VARS,
  env: NodeJS.ProcessEnv = process.env,
): FoundUrl | null {
  for (const name of names) {
    const url = env[name];
    if (url && url.trim()) return { name, url: url.trim() };
  }
  return null;
}

/** Everything except the password, for printing. */
export function describeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const user = parsed.username ? `${parsed.username}@` : "";
    return `${parsed.protocol}//${user}${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
}

export function missingUrlMessage(names: readonly string[]): string {
  return [
    `No database connection string found. Looked for: ${names.join(", ")}.`,
    "",
    "If you connected Supabase through Vercel, the integration creates",
    "POSTGRES_URL and POSTGRES_URL_NON_POOLING rather than DATABASE_URL —",
    "both of those are read automatically, so check they are present on this",
    "environment (Vercel -> Settings -> Environment Variables).",
    "",
    "Locally: copy .env.example to .env.local and put a connection string in it.",
  ].join("\n");
}
