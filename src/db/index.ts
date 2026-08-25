import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  APP_URL_VARS,
  explainConnectionError,
  findDatabaseUrl,
  isDirectSupabaseHost,
  missingUrlMessage,
  onVercel,
  type FoundUrl,
} from "@/db/url";

/**
 * The database connection.
 *
 * `server-only` at the top is the guard that matters: importing this from a
 * client component is a build error rather than a connection string shipped to
 * a browser.
 *
 * One client per process, cached across hot reloads in development — Next
 * re-evaluates modules on every change, and without this each edit would open
 * another pool until Postgres refused new connections.
 */

declare global {
  var __amanatDb: Database | undefined;
}

type Database = ReturnType<typeof connect>;

function connect() {
  const url = findDatabaseUrl(APP_URL_VARS);
  if (!url) throw new Error(missingUrlMessage(APP_URL_VARS));
  found = url;

  /*
   * `max: 1` is not a typo. On Vercel every request can land in its own short
   * lived instance, and a pool of ten per instance exhausts Postgres long
   * before the traffic justifies it. The provider's transaction pooler — Neon's
   * `-pooler` endpoint, Supabase's port 6543 — does the real pooling; this side
   * only needs one connection each.
   *
   * `prepare: false` is required by that pooler — prepared statements are bound
   * to a backend connection it is free to swap underneath us.
   */
  /*
   * Said once, at startup, where somebody reading the runtime logs will find
   * it. The alternative is what this replaces: every request failing with
   * "getaddrinfo ENOTFOUND db.xxxx.supabase.co", which sends you hunting for a
   * typo in a hostname that is spelled correctly.
   */
  if (onVercel() && isDirectSupabaseHost(url.url)) {
    console.error(
      [
        "",
        "  ╭──────────────────────────────────────────────────────────╮",
        `  │ ${url.name} is Supabase's DIRECT connection, which is       `,
        "  │ IPv6-only. Vercel's functions are IPv4-only, so every query  ",
        "  │ here will fail with ENOTFOUND.                               ",
        "  │                                                              ",
        "  │ Use the transaction pooler string instead:                   ",
        "  │   postgres.<ref>:<password>@aws-0-<region>.pooler            ",
        "  │       .supabase.com:6543/postgres                            ",
        "  ╰──────────────────────────────────────────────────────────╯",
        "",
      ].join("\n"),
    );
  }

  /*
   * Assigned to the module-level binding rather than a local, so `closeDb`
   * below has something to close. Both halves of this are wanted: the warning
   * came from the IPv6 fix, the assignment from making tests able to exit.
   */
  client = postgres(url.url, {
    max: 1,
    prepare: false,
    /*
     * Both of these are about failing out loud. postgres.js waits 30 seconds
     * for a connection by default, which is longer than a serverless function
     * is allowed to live: an unreachable database produced a request that was
     * killed by the platform mid-wait, so the log said nothing at all.
     *
     * Five, not ten. A Vercel Hobby function gets ten seconds in total, so a
     * ten second connect timeout consumes the entire budget and leaves nothing
     * with which to report what went wrong — the failure that says nothing,
     * again. Five leaves room for the error to be logged and a real page to be
     * rendered, and is still far longer than a healthy database ever needs.
     */
    connect_timeout: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });
  return drizzle(client, { schema });
}

/**
 * Connected on first use, not on import.
 *
 * This module is imported (transitively) by pages Next evaluates at build time,
 * where DATABASE_URL is deliberately absent — a build must not need production
 * credentials. Connecting eagerly turned that into "Failed to collect page data
 * for /setup". The proxy defers it to the first query, which only ever happens
 * while a request is being served.
 */
let instance: Database | undefined;
let client: ReturnType<typeof postgres> | undefined;
let found: FoundUrl | undefined;

/**
 * Turn a driver error into something worth reading, without ever handing the
 * connection string — password and all — to the caller.
 *
 * `explainConnectionError` knows what ENOTFOUND against Supabase's direct host
 * really means, and what a rejected password looks like. That knowledge used to
 * live only in the CLI scripts, so the running app answered a misconfigured
 * database with the driver's own unhelpful text. This is how it reaches the
 * runtime logs, which is where somebody debugging a deployment actually looks.
 */
export function explainDbFailure(error: unknown): string {
  if (!found) return (error as Error)?.message ?? String(error);
  return explainConnectionError(error, found.url);
}

function resolve(): Database {
  instance ??= globalThis.__amanatDb ?? connect();
  if (process.env.NODE_ENV !== "production") globalThis.__amanatDb = instance;
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(resolve(), property, receiver);
  },
  has(_target, property) {
    return Reflect.has(resolve(), property);
  },
});

/**
 * Close the connection.
 *
 * Nothing in the app calls this — a serverless instance is torn down, not shut
 * down politely. It exists for tests, which otherwise hang forever after the
 * last assertion because an open socket keeps Node's event loop alive, and the
 * failure reads as "the test timed out" rather than "the test finished".
 */
export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
  instance = undefined;
  found = undefined;
  globalThis.__amanatDb = undefined;
}

export { schema };
