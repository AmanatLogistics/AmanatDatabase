/**
 * Finding the connection string, whatever it happens to be called.
 *
 * Every managed Postgres names these differently, and some name them several
 * ways at once. Neon's Vercel integration sets `DATABASE_URL` and
 * `DATABASE_URL_UNPOOLED`; Supabase's sets `POSTGRES_URL` and
 * `POSTGRES_URL_NON_POOLING` and never `DATABASE_URL` at all. Reading only
 * `DATABASE_URL` meant a correctly connected project still came up with
 * "DATABASE_URL is not set", which looks like the integration failed when it
 * did not.
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
  "POSTGRES_URL", // set by both the Neon and Supabase integrations
  "SUPABASE_DATABASE_URL",
] as const;

/**
 * For migrations. Prefers the **direct** connection: creating tables and taking
 * the migrator's advisory lock both want a connection that stays put, which a
 * transaction pooler is free to swap underneath you.
 *
 * Preference, not requirement — see `findMigrationUrl`. On Vercel the direct
 * host cannot be reached at all, and a connection that works beats one that
 * would have been marginally better.
 */
export const DIRECT_URL_VARS = [
  "DIRECT_DATABASE_URL",
  "DATABASE_URL_UNPOOLED", // Neon/Vercel integration, direct
  "POSTGRES_URL_NON_POOLING", // Supabase/Vercel integration, direct
  ...APP_URL_VARS,
] as const;

export interface FoundUrl {
  /** Which environment variable it came from, for error messages. */
  name: string;
  url: string;
}

export type EnvLike = Record<string, string | undefined>;

export function findDatabaseUrl(
  names: readonly string[] = APP_URL_VARS,
  env: EnvLike = process.env,
): FoundUrl | null {
  for (const name of names) {
    const url = env[name];
    if (url && url.trim()) return { name, url: url.trim() };
  }
  return null;
}

/**
 * The connection to migrate over.
 *
 * The obvious order — direct first, pooled as a fallback — is wrong on Vercel.
 * Supabase's integration sets `POSTGRES_URL_NON_POOLING` to the direct host,
 * which is IPv6-only, and Vercel is IPv4-only: preferring it there picks the
 * one string guaranteed not to work, and the deploy fails on a database that
 * is perfectly reachable through the pooler sitting right next to it.
 *
 * So: prefer direct, unless direct means a host this platform cannot resolve.
 * Migrating over the transaction pooler is fine — Drizzle runs each migration
 * in a transaction, and the pooler pins a connection for a transaction's
 * lifetime.
 */
export function findMigrationUrl(env: EnvLike = process.env): FoundUrl | null {
  const preferred = findDatabaseUrl(DIRECT_URL_VARS, env);
  if (!preferred) return null;

  if (onVercel(env) && isDirectSupabaseHost(preferred.url)) {
    const reachable = findDatabaseUrl(
      DIRECT_URL_VARS.filter((name) => {
        const url = env[name];
        return url && !isDirectSupabaseHost(url);
      }),
      env,
    );
    if (reachable) return reachable;
  }

  return preferred;
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

/* -------------------------------------------------------------------------- */
/* Diagnosing a connection that will not open                                  */
/* -------------------------------------------------------------------------- */

/**
 * Supabase's direct host, `db.<ref>.supabase.co`.
 *
 * On projects created since early 2024 it resolves to an IPv6 address only.
 * Vercel's functions are IPv4-only, so a lookup there finds no A record and
 * fails with ENOTFOUND — which reads as "that host does not exist" when the
 * host is perfectly real and the app simply cannot get to it.
 *
 * The pooler host (`*.pooler.supabase.com`) is IPv4 and is what Supabase
 * intends for exactly this.
 */
export function isDirectSupabaseHost(url: string): boolean {
  try {
    return /^db\.[a-z0-9]+\.supabase\.co$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Are we running on Vercel, where IPv4-only applies? */
export function onVercel(env: EnvLike = process.env): boolean {
  return Boolean(env.VERCEL);
}

/**
 * Turn a driver error into something worth reading.
 *
 * `getaddrinfo ENOTFOUND db.xxxx.supabase.co` is technically accurate and
 * completely unhelpful — it sends you looking for a typo in a hostname that is
 * correct. This says what to change instead.
 */
export function explainConnectionError(error: unknown, url: string): string {
  const cause = (error as { cause?: unknown }).cause ?? error;
  const code = (cause as { code?: string })?.code;
  const message = (cause as Error)?.message ?? String(error);

  if (code === "ENOTFOUND" && isDirectSupabaseHost(url)) {
    return [
      `Cannot reach ${describeUrl(url)}`,
      "",
      "This is Supabase's DIRECT connection, which resolves to an IPv6",
      "address only. Vercel's functions are IPv4-only, so the lookup finds",
      "nothing and reports ENOTFOUND — the host is fine, it just cannot be",
      "reached from there.",
      "",
      "Use the POOLER connection string instead. In Supabase:",
      "  Project Settings -> Database -> Connection string -> Transaction pooler",
      "",
      "It looks like this — note the different host AND username:",
      "  postgresql://postgres.<project-ref>:<password>",
      "      @aws-0-<region>.pooler.supabase.com:6543/postgres",
      "",
      "Set that as DATABASE_URL in Vercel and redeploy.",
    ].join("\n");
  }

  if (code === "ENOTFOUND") {
    return `Cannot reach ${describeUrl(url)} — that hostname does not resolve.`;
  }

  if (code === "ETIMEDOUT" || code === "ECONNREFUSED") {
    return [
      `Cannot connect to ${describeUrl(url)} (${code}).`,
      "The host resolved but refused or ignored the connection. Common causes:",
      "the Supabase project is paused, or the port is wrong (6543 pooled,",
      "5432 direct or session pooler).",
    ].join("\n");
  }

  if (/password authentication failed/i.test(message)) {
    return [
      `Wrong password for ${describeUrl(url)}.`,
      "If you reset it in Supabase, update DATABASE_URL in Vercel to match.",
      "Note the pooler username is postgres.<project-ref>, not plain postgres.",
    ].join("\n");
  }

  return message;
}
